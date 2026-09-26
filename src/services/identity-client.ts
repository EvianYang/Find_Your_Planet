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
    throw new Error("Supabase 未返回用户身份。");
  }

  if (!user.is_anonymous) {
    throw new Error("当前 Supabase session 不是匿名身份。");
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
    throw new Error(`读取 Supabase session 失败：${sessionError.message}`);
  }

  if (session) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(`验证 Supabase 用户失败：${userError.message}`);
    }

    return requireAnonymousUser(user);
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw new Error(`Supabase 匿名登录失败：${error.message}`);
  }

  return requireAnonymousUser(data.user);
}

export async function getIdentityProfile(): Promise<IdentityProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("identity", {
    body: { action: "me" },
  });

  if (error) {
    throw new Error(`读取 profile 失败：${error.message}`);
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
    throw new Error(`创建 profile 失败：${error.message}`);
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
      "权限验证失败：浏览器能够直接读取 profiles，请立即检查 grants 和 RLS。",
    );
  }

  if (error.code !== "42501") {
    throw new Error(`直接读取被拒，但返回了非预期错误：${error.code}`);
  }
}
