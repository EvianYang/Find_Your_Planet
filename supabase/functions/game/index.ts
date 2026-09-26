import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

import {
  type ApiErrorCode,
  RequestIdSchema,
} from "../_shared/contracts/common.ts";
import { GameRequestSchema } from "../_shared/contracts/game.ts";

type JsonRecord = Record<string, unknown>;
type ProfileRow = { id: string };
type CreatedRoomRow = { room_id: string; join_code: string; slot: string };
type JoinedRoomRow = {
  status: string;
  room_id: string | null;
  slot: string | null;
};

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

  if (parsedRequest.data.action !== "create" && parsedRequest.data.action !== "join") {
    return failure(requestId, "INVALID_INPUT", "This game action is not implemented yet.", false, 400);
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

    const normalizedJoinCode = parsedRequest.data.joinCode.toUpperCase();
    const { data, error } = await adminClient
      .rpc("join_room", {
        p_profile_id: profile.id,
        p_join_code: normalizedJoinCode,
      })
      .single<JoinedRoomRow>();

    if (error) throw error;
    if (!data || data.status !== "JOINED" || !data.room_id) {
      return joinFailure(requestId, data?.status ?? "NOT_FOUND");
    }

    return success(requestId, { roomId: data.room_id });
  } catch {
    return failure(requestId, "INTERNAL_ERROR", "Game service is temporarily unavailable.", true, 500);
  }
});
