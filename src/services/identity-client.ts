import type { User } from "@supabase/supabase-js";

import {
  IdentityDataResponseSchema,
  IdentityMeResponseSchema,
  type IdentityData,
  type IdentityProfile,
} from "@contracts/identity.ts";

import { getSupabaseClient } from "./supabase-client.ts";

function requireAnonymousUser(user: User | null): User {
  if (!user) {
    throw new Error("Supabase did not return a user identity.");
  }

  if (!user.is_anonymous) {
    throw new Error("The current Supabase session is not anonymous.");
  }

  return user;
}

/**
 * Reuses the browser's verified anonymous session and creates one only when
 * none exists. Never log the returned session or its tokens.
 */
export async function ensureAnonymousUser(): Promise<User> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Could not read the Supabase session: ${sessionError.message}`);
  }

  if (session) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(`Could not verify the Supabase user: ${userError.message}`);
    }

    return requireAnonymousUser(user);
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw new Error(`Anonymous sign-in failed: ${error.message}`);
  }

  return requireAnonymousUser(data.user);
}

export async function getIdentityProfile(): Promise<IdentityProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("identity", {
    body: { action: "me" },
  });

  if (error) {
    throw new Error(`Could not read the profile: ${error.message}`);
  }

  const response = IdentityMeResponseSchema.parse(data);
  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data.profile;
}

export async function createIdentityProfile(
  nickname: string,
): Promise<IdentityData> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("identity", {
    body: {
      action: "create",
      nickname,
      requestId: crypto.randomUUID(),
    },
  });

  if (error) {
    throw new Error(`Could not create the profile: ${error.message}`);
  }

  const response = IdentityDataResponseSchema.parse(data);
  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data;
}

export async function verifyDirectProfileReadIsDenied(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("profiles").select("id").limit(1);

  if (!error) {
    throw new Error(
      "Permission check failed: the browser can read profiles directly. Check grants and RLS immediately.",
    );
  }

  if (error.code !== "42501") {
    throw new Error(`Direct access was denied with an unexpected error code: ${error.code}`);
  }
}
