import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

import { evaluatePair, EvaluationError } from "../_shared/ai/evaluate-pair.ts";
import { createOpenAIProvider } from "../_shared/ai/openai-provider.ts";
import { type ApiErrorCode } from "../_shared/contracts/common.ts";
import { EvaluateRequestSchema } from "../_shared/contracts/evaluate.ts";
import { RoundResultSchema, type RoundResult } from "../_shared/contracts/evaluation.ts";
import { PromptSchema } from "../_shared/contracts/game.ts";

type JsonRecord = Record<string, unknown>;
type ProfileRow = { id: string };
type ClaimRow = {
  status: string;
  claimed_round_id: string | null;
  prompt_json: unknown;
  answer_a: string | null;
  answer_b: string | null;
  result_json: unknown;
  automatic_attempts: number;
  manual_retries: number;
};
type PublishRow = { status: string; result_json: unknown };

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function success(requestId: string, data: JsonRecord): Response {
  return jsonResponse({ data, error: null, requestId });
}

function failure(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  status: number,
): Response {
  return jsonResponse(
    { data: null, error: { code, message, retryable }, requestId },
    status,
  );
}

function readInjectedKey(name: string, legacyName: string): string {
  const encodedKeys = Deno.env.get(name);
  if (encodedKeys) {
    const keys = JSON.parse(encodedKeys) as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (key) return key;
  }
  const legacyKey = Deno.env.get(legacyName);
  if (legacyKey) return legacyKey;
  throw new Error(`Missing injected Supabase key: ${name}`);
}

function claimFailure(requestId: string, status: string): Response {
  if (status === "EXPIRED") {
    return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
  }
  if (status === "INVALID_PHASE") {
    return failure(requestId, "INVALID_PHASE", "This round is not ready for evaluation.", false, 409);
  }
  if (status === "NOT_READY") {
    return failure(requestId, "CONFLICT", "Both players must answer before evaluation.", false, 409);
  }
  if (status === "RETRY_EXHAUSTED") {
    return failure(requestId, "EVALUATION_FAILED", "Evaluation could not be completed after the allowed retries.", false, 409);
  }
  return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

async function loadProfile(
  accessToken: string,
): Promise<{ adminClient: SupabaseClient; profile: ProfileRow } | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  const publishableKey = readInjectedKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readInjectedKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user || !user.is_anonymous) {
    return failure(crypto.randomUUID(), "UNAUTHORIZED", "A valid anonymous user session is required.", false, 401);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("active_auth_user_id", user.id)
    .maybeSingle<ProfileRow>();
  if (profileError) throw profileError;
  if (!profile) {
    return failure(crypto.randomUUID(), "UNAUTHORIZED", "Create a profile before evaluating a game.", false, 401);
  }
  return { adminClient, profile };
}

async function markFailed(
  adminClient: SupabaseClient,
  roomId: string,
  roundIndex: number,
  claimToken: string,
): Promise<void> {
  const { error } = await adminClient.rpc("fail_round_evaluation", {
    p_room_id: roomId,
    p_round_index: roundIndex,
    p_claim_token: claimToken,
  });
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  if (request.method !== "POST") {
    return failure(requestId, "INVALID_INPUT", "Only POST requests are supported.", false, 405);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return failure(requestId, "INVALID_INPUT", "Request body must be valid JSON.", false, 400);
  }
  const parsedRequest = EvaluateRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return failure(requestId, "INVALID_INPUT", "Evaluation request is invalid.", false, 400);
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!accessToken) {
    return failure(requestId, "UNAUTHORIZED", "A valid user session is required.", false, 401);
  }

  const { roomId, roundIndex } = parsedRequest.data;
  const claimToken = crypto.randomUUID();
  let claimedAdminClient: SupabaseClient | null = null;
  let claimAcquired = false;
  let manualRetriesRemain = true;
  try {
    const identity = await loadProfile(accessToken);
    if (identity instanceof Response) {
      const body = await identity.json() as JsonRecord;
      body.requestId = requestId;
      return jsonResponse(body, identity.status);
    }
    const { adminClient, profile } = identity;
    const { data, error } = await adminClient.rpc("claim_round_evaluation", {
      p_profile_id: profile.id,
      p_room_id: roomId,
      p_round_index: roundIndex,
      p_claim_token: claimToken,
    }).single<ClaimRow>();
    if (error) throw error;
    if (!data) throw new Error("Evaluation claim returned no data.");

    if (data.status === "READY") {
      const result = RoundResultSchema.parse(data.result_json);
      return success(requestId, { status: "ready", result });
    }
    if (data.status === "PROCESSING") {
      return success(requestId, { status: "processing" });
    }
    if (data.status !== "CLAIMED") {
      return claimFailure(requestId, data.status);
    }
    claimedAdminClient = adminClient;
    claimAcquired = true;
    manualRetriesRemain = data.manual_retries < 2;

    const prompt = PromptSchema.parse(data.prompt_json);
    if (!data.answer_a || !data.answer_b) {
      throw new EvaluationError("INVALID_INPUT");
    }
    const provider = createOpenAIProvider({
      apiKey: Deno.env.get("LLM_API_KEY") ?? "",
      model: Deno.env.get("LLM_MODEL") ?? "",
    });

    let result: RoundResult | null = null;
    let lastError: unknown;
    while (!result) {
      try {
        result = await evaluatePair({
          prompt: prompt.text,
          answers: { a: data.answer_a, b: data.answer_b },
        }, provider);
      } catch (error) {
        lastError = error;
        // Per-attempt log: error code and validation paths only, never answers, evidence or provider payloads.
        console.warn(JSON.stringify({
          requestId,
          category: "EVALUATION_ATTEMPT_FAILED",
          code: error instanceof EvaluationError ? error.code : "INTERNAL_ERROR",
          issues: error instanceof EvaluationError ? error.issues : [],
          durationMs: Date.now() - startedAt,
        }));
        const canAutomaticallyRetry =
          error instanceof EvaluationError &&
          error.code !== "INVALID_CONFIGURATION" &&
          data.automatic_attempts < 2;
        if (!canAutomaticallyRetry) break;
        const { data: retryClaimed, error: retryError } = await adminClient.rpc(
          "retry_round_evaluation",
          {
            p_room_id: roomId,
            p_round_index: roundIndex,
            p_claim_token: claimToken,
          },
        );
        if (retryError) throw retryError;
        if (retryClaimed !== true) {
          return success(requestId, { status: "processing" });
        }
        data.automatic_attempts += 1;
      }
    }

    if (!result) {
      await markFailed(adminClient, roomId, roundIndex, claimToken);
      const category = lastError instanceof EvaluationError ? lastError.code : "INTERNAL_ERROR";
      const issues = lastError instanceof EvaluationError ? lastError.issues : [];
      console.error(JSON.stringify({ requestId, category, issues, durationMs: Date.now() - startedAt }));
      return failure(
        requestId,
        "EVALUATION_FAILED",
        data.manual_retries < 2
          ? "Evaluation failed. Either player can try again."
          : "Evaluation could not be completed after the allowed retries.",
        data.manual_retries < 2,
        502,
      );
    }

    const { data: published, error: publishError } = await adminClient.rpc(
      "publish_round_evaluation",
      {
        p_room_id: roomId,
        p_round_index: roundIndex,
        p_claim_token: claimToken,
        p_result: result,
      },
    ).single<PublishRow>();
    if (publishError) throw publishError;
    if (!published || published.status === "STALE") {
      return success(requestId, { status: "processing" });
    }
    const savedResult = RoundResultSchema.parse(published.result_json);
    console.info(JSON.stringify({
      requestId,
      category: "EVALUATION_READY",
      durationMs: Date.now() - startedAt,
      modelId: savedResult.modelId,
      rubricVersion: savedResult.rubricVersion,
    }));
    return success(requestId, { status: "ready", result: savedResult });
  } catch (error) {
    if (claimAcquired && claimedAdminClient) {
      try {
        await markFailed(claimedAdminClient, roomId, roundIndex, claimToken);
      } catch {
        // The lease will expire safely. Do not expose a database payload while
        // handling the original failure.
      }
    }
    const category = error instanceof EvaluationError ? error.code : "INTERNAL_ERROR";
    const issues = error instanceof EvaluationError ? error.issues : [];
    console.error(JSON.stringify({ requestId, category, issues, durationMs: Date.now() - startedAt }));
    if (claimAcquired) {
      return failure(
        requestId,
        "EVALUATION_FAILED",
        manualRetriesRemain
          ? "Evaluation failed. Either player can try again."
          : "Evaluation could not be completed after the allowed retries.",
        manualRetriesRemain,
        502,
      );
    }
    return failure(requestId, "INTERNAL_ERROR", "Evaluation service is temporarily unavailable.", true, 500);
  }
});
