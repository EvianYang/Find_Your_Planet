import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

import {
  type ApiErrorCode,
  RequestIdSchema,
} from "../_shared/contracts/common.ts";
import {
  type IdentityData,
  type IdentityProfile,
  IdentityRequestSchema,
} from "../_shared/contracts/identity.ts";

type JsonRecord = Record<string, unknown>;

type ProfileRow = {
  id: string;
  nickname: string;
  credential_version: number;
  created_at: string;
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function failure(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  retryable: boolean,
  status: number,
): Response {
  return jsonResponse(
    {
      data: null,
      error: { code, message, retryable },
      requestId,
    },
    status,
  );
}

function success(
  requestId: string,
  data: IdentityData | { profile: IdentityProfile | null },
) {
  return jsonResponse({ data, error: null, requestId });
}

function readInjectedKey(name: string, legacyName: string): string {
  const encodedKeys = Deno.env.get(name);

  if (encodedKeys) {
    const keys = JSON.parse(encodedKeys) as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];

    if (key) {
      return key;
    }
  }

  const legacyKey = Deno.env.get(legacyName);
  if (legacyKey) {
    return legacyKey;
  }

  throw new Error(`Missing injected Supabase key: ${name}`);
}

function toProfile(row: ProfileRow): IdentityProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    credentialVersion: row.credential_version,
    createdAt: row.created_at,
  };
}

const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let buffer = 0;
  let bits = 0;
  let encoded = "";

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      encoded += recoveryAlphabet[(buffer >>> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }

  if (bits > 0) {
    encoded += recoveryAlphabet[(buffer << (5 - bits)) & 31];
  }

  return encoded.match(/.{1,4}/g)?.join("-") ?? encoded;
}

async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = code.replaceAll("-", "").toUpperCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function requestIdFromUnknownBody(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "requestId" in body &&
    typeof body.requestId === "string"
  ) {
    const parsedRequestId = RequestIdSchema.safeParse(body.requestId);
    if (parsedRequestId.success) {
      return parsedRequestId.data;
    }
  }

  return crypto.randomUUID();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const fallbackRequestId = crypto.randomUUID();

  if (request.method !== "POST") {
    return failure(
      fallbackRequestId,
      "INVALID_INPUT",
      "Only POST requests are supported.",
      false,
      405,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return failure(
      fallbackRequestId,
      "INVALID_INPUT",
      "Request body must be valid JSON.",
      false,
      400,
    );
  }

  const requestId = requestIdFromUnknownBody(rawBody);
  const parsedRequest = IdentityRequestSchema.safeParse(rawBody);

  if (!parsedRequest.success) {
    return failure(
      requestId,
      "INVALID_INPUT",
      "Identity request is invalid.",
      false,
      400,
    );
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return failure(
      requestId,
      "UNAUTHORIZED",
      "A valid user session is required.",
      false,
      401,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL");
    }

    const publishableKey = readInjectedKey(
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_ANON_KEY",
    );
    const secretKey = readInjectedKey(
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user || !user.is_anonymous) {
      return failure(
        requestId,
        "UNAUTHORIZED",
        "A valid anonymous user session is required.",
        false,
        401,
      );
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const profileSelection = "id,nickname,credential_version,created_at";

    if (parsedRequest.data.action === "me") {
      const { data, error } = await adminClient
        .from("profiles")
        .select(profileSelection)
        .eq("active_auth_user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (error) {
        throw error;
      }

      return success(requestId, { profile: data ? toProfile(data) : null });
    }

    if (parsedRequest.data.action === "create") {
      const { data: existing, error: existingError } = await adminClient
        .from("profiles")
        .select(profileSelection)
        .eq("active_auth_user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        return success(requestId, { profile: toProfile(existing) });
      }

      const recoveryCode = generateRecoveryCode();
      const recoveryHash = await hashRecoveryCode(recoveryCode);
      const { data: created, error: createError } = await adminClient
        .from("profiles")
        .insert({
          nickname: parsedRequest.data.nickname,
          active_auth_user_id: user.id,
          recovery_hash: recoveryHash,
        })
        .select(profileSelection)
        .single<ProfileRow>();

      if (createError) {
        if (createError.code === "23505") {
          const { data: racedProfile, error: racedError } = await adminClient
            .from("profiles")
            .select(profileSelection)
            .eq("active_auth_user_id", user.id)
            .single<ProfileRow>();

          if (racedError) {
            throw racedError;
          }

          return success(requestId, { profile: toProfile(racedProfile) });
        }

        throw createError;
      }

      return success(requestId, {
        profile: toProfile(created),
        recoveryCode,
      });
    }

    return failure(
      requestId,
      "INVALID_INPUT",
      "This identity action is not implemented yet.",
      false,
      400,
    );
  } catch {
    return failure(
      requestId,
      "INTERNAL_ERROR",
      "Identity service is temporarily unavailable.",
      true,
      500,
    );
  }
});
