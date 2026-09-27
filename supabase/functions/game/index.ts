import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

import {
  type ApiErrorCode,
  RequestIdSchema,
} from "../_shared/contracts/common.ts";
import {
  GameRequestSchema,
  GameSnapshotSchema,
  PromptGenerationStatusSchema,
  type Prompt,
  type PromptGenerationStatus,
} from "../_shared/contracts/game.ts";
import { RoundResultSchema } from "../_shared/contracts/evaluation.ts";
import { filterGeneratedPrompts, selectGamePrompts } from "../_shared/content/prompt-pool.ts";
import { generatePromptCandidates } from "../_shared/ai/generate-prompts.ts";
import { createOpenAIQuestionGenerator } from "../_shared/ai/openai-provider.ts";

type JsonRecord = Record<string, unknown>;
type ProfileRow = { id: string };
type CreatedRoomRow = { room_id: string; join_code: string; slot: string };
type JoinedRoomRow = {
  status: string;
  room_id: string | null;
  slot: string | null;
};
type StartedRoomRow = { status: string; started_room_id: string | null };
type RoomRow = {
  id: string;
  join_code: string;
  host_profile_id: string;
  phase: string;
  current_round: number;
  revision: number;
  expires_at: string;
};
type ParticipantRow = {
  profile_id: string;
  slot: "A" | "B";
  nickname_snapshot: string;
};
type RoundRow = {
  id: string;
  round_index: number;
  prompt_json: unknown;
  result_json: unknown;
  evaluation_state: string;
  manual_retries: number;
  continued_a: boolean;
  continued_b: boolean;
};
type SubmissionRow = { round_id: string; profile_id: string; body: string };
type SubmittedRoomRow = { status: string; submitted_room_id: string | null };
type ContinuedRoomRow = { status: string; continued_room_id: string | null };
type StatusRow = { status: string };
type PromptPoolRow = { state: string; candidates: unknown };

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
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

function requestIdFromUnknownBody(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "requestId" in body &&
    typeof body.requestId === "string"
  ) {
    const parsed = RequestIdSchema.safeParse(body.requestId);
    if (parsed.success) return parsed.data;
  }

  return crypto.randomUUID();
}

function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(
    bytes,
    (byte) => joinCodeAlphabet[byte & 31],
  ).join("");
}

/** Uniform in [0, 1) from the platform CSPRNG, for selectGamePrompts. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
}

type GenerationOutcome = {
  state: "ready" | "empty" | "failed";
  candidates: Prompt[];
  reason: string | null;
  generated: number;
};

/**
 * One bounded attempt (C's generator, 8-second limit, no retry) plus the local quality gate.
 * Runs outside any database lock; the result is written back by finish_prompt_generation.
 */
async function generateRoomCandidates(): Promise<GenerationOutcome> {
  let generator;
  try {
    generator = createOpenAIQuestionGenerator({
      apiKey: Deno.env.get("LLM_API_KEY") ?? "",
      model: Deno.env.get("LLM_MODEL") ?? "",
    });
  } catch {
    return { state: "failed", candidates: [], reason: "configuration", generated: 0 };
  }
  const attempt = await generatePromptCandidates(generator);
  if (attempt.status === "failed") {
    return { state: "failed", candidates: [], reason: attempt.reason, generated: 0 };
  }
  const { accepted } = filterGeneratedPrompts(attempt.candidates);
  return {
    state: accepted.length > 0 ? "ready" : "empty",
    candidates: accepted,
    reason: null,
    generated: attempt.candidates.length,
  };
}

async function loadSnapshot(
  adminClient: SupabaseClient,
  profileId: string,
  roomId: string,
): Promise<
  | { ok: true; snapshot: ReturnType<typeof GameSnapshotSchema.parse> }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" }
> {
  const { data: room, error: roomError } = await adminClient
    .from("rooms")
    .select("id,join_code,host_profile_id,phase,current_round,revision,expires_at")
    .eq("id", roomId)
    .maybeSingle<RoomRow>();

  if (roomError) throw roomError;
  if (!room) return { ok: false, code: "NOT_FOUND" };

  const { data: participants, error: participantsError } = await adminClient
    .from("participants")
    .select("profile_id,slot,nickname_snapshot")
    .eq("room_id", roomId)
    .order("slot")
    .returns<ParticipantRow[]>();

  if (participantsError) throw participantsError;
  const viewer = participants?.find((participant) => participant.profile_id === profileId);
  if (!viewer) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (new Date(room.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: "EXPIRED" };
  }

  let rounds: RoundRow[] = [];
  if (room.current_round > 0) {
    const { data, error } = await adminClient
      .from("rounds")
      .select("id,round_index,prompt_json,result_json,evaluation_state,manual_retries,continued_a,continued_b")
      .eq("room_id", roomId)
      .order("round_index")
      .returns<RoundRow[]>();
    if (error) throw error;
    rounds = data ?? [];
  }
  const round = rounds.find((candidate) => candidate.round_index === room.current_round) ?? null;
  if (room.current_round > 0 && !round) throw new Error("The current round is missing.");

  let allSubmissions: SubmissionRow[] = [];
  if (rounds.length > 0) {
    const { data, error } = await adminClient
      .from("submissions")
      .select("round_id,profile_id,body")
      .in("round_id", rounds.map((candidate) => candidate.id))
      .returns<SubmissionRow[]>();
    if (error) throw error;
    allSubmissions = data ?? [];
  }
  const submissions = round
    ? allSubmissions.filter((submission) => submission.round_id === round.id)
    : [];

  const profileBySlot = new Map(
    participants.map((participant) => [participant.slot, participant.profile_id]),
  );
  const ownSubmission = submissions.find(
    (submission) => submission.profile_id === profileId,
  );

  const snapshot = GameSnapshotSchema.parse({
    roomId: room.id,
    viewerSlot: viewer.slot,
    joinCode: room.host_profile_id === profileId ? room.join_code : null,
    phase: room.phase,
    currentRound: room.current_round,
    revision: room.revision,
    expiresAt: room.expires_at,
    players: participants.map((participant) => ({
      slot: participant.slot,
      nickname: participant.nickname_snapshot,
    })),
    currentPrompt: round?.prompt_json ?? null,
    ownAnswer: ownSubmission?.body ?? null,
    submitted: {
      a: submissions.some((submission) => submission.profile_id === profileBySlot.get("A")),
      b: submissions.some((submission) => submission.profile_id === profileBySlot.get("B")),
    },
    continued: {
      a: round?.continued_a ?? false,
      b: round?.continued_b ?? false,
    },
    evaluationState: round?.evaluation_state ?? "idle",
    evaluationRetriesRemaining: round
      ? Math.max(0, 2 - round.manual_retries)
      : null,
    revealedRounds: rounds
      .filter((candidate) => candidate.evaluation_state === "ready" && candidate.result_json)
      .map((candidate) => {
        const roundSubmissions = allSubmissions.filter(
          (submission) => submission.round_id === candidate.id,
        );
        return {
          roundIndex: candidate.round_index,
          prompt: candidate.prompt_json,
          answers: {
            a: roundSubmissions.find(
              (submission) => submission.profile_id === profileBySlot.get("A"),
            )?.body,
            b: roundSubmissions.find(
              (submission) => submission.profile_id === profileBySlot.get("B"),
            )?.body,
          },
          result: candidate.result_json,
        };
      }),
    overall: room.phase === "finished"
      ? (() => {
        const validDistances = rounds
          .filter((candidate) => candidate.evaluation_state === "ready")
          .map((candidate) => RoundResultSchema.parse(candidate.result_json).distance)
          .filter((distance): distance is number => distance !== null);
        return {
          overallDistance: validDistances.length >= 2
            ? Math.round(
              validDistances.reduce((sum, distance) => sum + distance, 0) /
                validDistances.length,
            )
            : null,
          validRounds: validDistances.length,
          totalRounds: 3,
        };
      })()
      : null,
  });

  return { ok: true, snapshot };
}

function joinFailure(requestId: string, status: string): Response {
  if (status === "ROOM_FULL") {
    return failure(requestId, "ROOM_FULL", "This room already has two players.", false, 409);
  }
  if (status === "EXPIRED") {
    return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
  }
  if (status === "INVALID_PHASE") {
    return failure(requestId, "INVALID_PHASE", "This room can no longer be joined.", false, 409);
  }
  return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

function snapshotFailure(
  requestId: string,
  code: "NOT_FOUND" | "EXPIRED",
): Response {
  return code === "EXPIRED"
    ? failure(requestId, "EXPIRED", "This room has expired.", false, 410)
    : failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

function startFailure(requestId: string, status: string): Response {
  if (status === "UNAUTHORIZED") {
    return failure(requestId, "UNAUTHORIZED", "Only the host can start this game.", false, 403);
  }
  if (status === "NOT_READY") {
    return failure(requestId, "CONFLICT", "Both players must join before the host can start.", false, 409);
  }
  if (status === "EXPIRED") {
    return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
  }
  if (status === "INVALID_PHASE") {
    return failure(requestId, "INVALID_PHASE", "This room cannot be started in its current phase.", false, 409);
  }
  if (status === "INVALID_PROMPTS") {
    return failure(requestId, "INTERNAL_ERROR", "The question pool is temporarily unavailable.", true, 500);
  }
  return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

function submitFailure(requestId: string, status: string): Response {
  if (status === "CONFLICT") {
    return failure(requestId, "CONFLICT", "This round already has a different answer from you.", false, 409);
  }
  if (status === "INVALID_PHASE") {
    return failure(requestId, "INVALID_PHASE", "Answers are not accepted in the current phase.", false, 409);
  }
  if (status === "EXPIRED") {
    return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
  }
  return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

function continueFailure(requestId: string, status: string): Response {
  if (status === "INVALID_PHASE") {
    return failure(requestId, "INVALID_PHASE", "This round cannot continue in its current phase.", false, 409);
  }
  if (status === "EXPIRED") {
    return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
  }
  return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const fallbackRequestId = crypto.randomUUID();
  if (request.method !== "POST") {
    return failure(fallbackRequestId, "INVALID_INPUT", "Only POST requests are supported.", false, 405);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return failure(fallbackRequestId, "INVALID_INPUT", "Request body must be valid JSON.", false, 400);
  }

  const requestId = requestIdFromUnknownBody(rawBody);
  const parsedRequest = GameRequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return failure(requestId, "INVALID_INPUT", "Game request is invalid.", false, 400);
  }


  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!accessToken) {
    return failure(requestId, "UNAUTHORIZED", "A valid user session is required.", false, 401);
  }

  try {
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
      return failure(requestId, "UNAUTHORIZED", "A valid anonymous user session is required.", false, 401);
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
      return failure(requestId, "UNAUTHORIZED", "Create a profile before using rooms.", false, 401);
    }

    if (parsedRequest.data.action === "create") {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await adminClient
          .rpc("create_room", {
            p_profile_id: profile.id,
            p_request_id: parsedRequest.data.requestId,
            p_join_code: generateJoinCode(),
          })
          .single<CreatedRoomRow>();

        if (!error && data) {
          return success(requestId, { roomId: data.room_id, joinCode: data.join_code });
        }
        if (error?.code !== "23505") throw error;
      }

      throw new Error("Could not allocate a unique join code.");
    }

    if (parsedRequest.data.action === "join") {
      const { data, error } = await adminClient
        .rpc("join_room", {
          p_profile_id: profile.id,
          p_join_code: parsedRequest.data.joinCode,
        })
        .single<JoinedRoomRow>();

      if (error) throw error;
      if (!data || data.status !== "JOINED" || !data.room_id) {
        return joinFailure(requestId, data?.status ?? "NOT_FOUND");
      }

      return success(requestId, { roomId: data.room_id });
    }

    if (parsedRequest.data.action === "prepare_prompts") {
      const roomId = parsedRequest.data.roomId;
      const { data: claim, error: claimError } = await adminClient
        .rpc("claim_prompt_generation", { p_profile_id: profile.id, p_room_id: roomId })
        .single<StatusRow>();

      if (claimError) throw claimError;
      const claimStatus = claim?.status ?? "NOT_FOUND";
      if (claimStatus === "EXPIRED") {
        return failure(requestId, "EXPIRED", "This room has expired.", false, 410);
      }
      if (claimStatus === "INVALID_PHASE") {
        return failure(requestId, "INVALID_PHASE", "New questions can only be prepared in the lobby.", false, 409);
      }
      if (claimStatus !== "CLAIMED") {
        // Already claimed by this room: report the existing state; never call the model again.
        const existing = PromptGenerationStatusSchema.safeParse(claimStatus.toLowerCase());
        if (!existing.success) return failure(requestId, "NOT_FOUND", "Room not found.", false, 404);
        return success(requestId, { status: existing.data });
      }

      const startedAt = Date.now();
      const outcome = await generateRoomCandidates();
      const { data: finished, error: finishError } = await adminClient
        .rpc("finish_prompt_generation", {
          p_room_id: roomId,
          p_state: outcome.state,
          p_candidates: outcome.candidates,
        })
        .single<StatusRow>();

      if (finishError) throw finishError;
      // STALE: the lease ran out or the attempt was already ended, so nothing was saved.
      const saved = PromptGenerationStatusSchema.safeParse((finished?.status ?? "").toLowerCase());
      const status: PromptGenerationStatus = saved.success ? saved.data : "failed";
      // Counts and reasons only; never question text, model output or credentials.
      console.info(JSON.stringify({
        requestId,
        category: "PROMPT_GENERATION",
        status,
        reason: outcome.reason,
        generated: outcome.generated,
        accepted: outcome.candidates.length,
        durationMs: Date.now() - startedAt,
      }));
      return success(requestId, { status });
    }

    if (parsedRequest.data.action === "start") {
      const roomId = parsedRequest.data.roomId;
      let data: StartedRoomRow | null = null;
      // Two tries at most: POOL_CHANGED means candidates became ready after our read, and ready is final.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        // Only saved (ready) candidates count; an attempt that is still running never delays the start.
        const { data: pool, error: poolError } = await adminClient
          .from("room_prompt_pools")
          .select("state,candidates")
          .eq("room_id", roomId)
          .maybeSingle<PromptPoolRow>();
        if (poolError) {
          // New questions are optional: if the pool cannot be read, start with curated questions only.
          console.warn(JSON.stringify({ requestId, category: "PROMPT_POOL_UNAVAILABLE" }));
        }
        const readyCandidates = !poolError && pool?.state === "ready" && Array.isArray(pool.candidates)
          ? pool.candidates
          : [];
        const selection = selectGamePrompts({ generatedCandidates: readyCandidates, random: secureRandom });
        const result = await adminClient
          .rpc("start_room", {
            p_profile_id: profile.id,
            p_room_id: roomId,
            p_prompts: selection.prompts,
            // start_room re-checks the pool under the room lock it shares with the write-back.
            ...(poolError ? {} : { p_pool_seen: pool?.state ?? "none" }),
          })
          .single<StartedRoomRow>();

        if (result.error) throw result.error;
        data = result.data;
        if (data?.status !== "POOL_CHANGED") break;
      }

      if (!data || data.status !== "STARTED" || !data.started_room_id) {
        return startFailure(requestId, data?.status === "POOL_CHANGED" ? "INVALID_PROMPTS" : data?.status ?? "NOT_FOUND");
      }
    }

    if (parsedRequest.data.action === "submit") {
      const { data, error } = await adminClient
        .rpc("submit_answer", {
          p_profile_id: profile.id,
          p_room_id: parsedRequest.data.roomId,
          p_round_index: parsedRequest.data.roundIndex,
          p_answer: parsedRequest.data.answer,
        })
        .single<SubmittedRoomRow>();

      if (error) throw error;
      if (!data || data.status !== "SUBMITTED" || !data.submitted_room_id) {
        return submitFailure(requestId, data?.status ?? "NOT_FOUND");
      }
    }

    if (parsedRequest.data.action === "continue") {
      const { data, error } = await adminClient
        .rpc("continue_round", {
          p_profile_id: profile.id,
          p_room_id: parsedRequest.data.roomId,
          p_round_index: parsedRequest.data.roundIndex,
        })
        .single<ContinuedRoomRow>();

      if (error) throw error;
      if (!data || data.status !== "CONTINUED" || !data.continued_room_id) {
        return continueFailure(requestId, data?.status ?? "NOT_FOUND");
      }
    }

    const snapshot = await loadSnapshot(
      adminClient,
      profile.id,
      parsedRequest.data.roomId,
    );
    if (!snapshot.ok) {
      return snapshotFailure(requestId, snapshot.code);
    }

    return success(requestId, snapshot.snapshot);
  } catch {
    return failure(requestId, "INTERNAL_ERROR", "Game service is temporarily unavailable.", true, 500);
  }
});
