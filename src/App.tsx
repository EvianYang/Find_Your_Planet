import { useState } from "react";

import { PromptSchema } from "@contracts/game.ts";
import type { IdentityProfile } from "@contracts/identity.ts";

import {
  createIdentityProfile,
  ensureAnonymousUser,
  getIdentityProfile,
  verifyDirectProfileReadIsDenied,
} from "./services/identity-client.ts";
import { isSupabaseConfigured } from "./services/supabase-client.ts";

const contractExample = {
  id: "curated-01",
  text: "如果世界上可以多一种颜色，你希望它出现在什么地方？",
  source: "curated",
  version: "fmp-v1",
} as const;

function ContractPreview() {
  const result = PromptSchema.safeParse(contractExample);

  return (
    <main>
      <h1>Contracts preview</h1>
      <p>这是 B 侧的本地结构校验入口，不代表后端或 AI 服务已连接。</p>
      <p>
        Prompt fixture validation: <strong>{result.success ? "通过" : "失败"}</strong>
      </p>
      <pre>{JSON.stringify(contractExample, null, 2)}</pre>
      <p>
        C 的评估 fixture 将接入 <code>src/fixtures/round-results.ts</code>。
      </p>
      <a href="/">返回运行页</a>
    </main>
  );
}

type VerificationState =
  | { status: "idle"; message: string }
  | { status: "running"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function SupabasePreview() {
  const configured = isSupabaseConfigured();
  const [authVerified, setAuthVerified] = useState(false);
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<IdentityProfile | null>();
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [verification, setVerification] = useState<VerificationState>({
    status: "idle",
    message: configured
      ? "配置已读取，尚未发起真实匿名登录。"
      : "缺少 .env.local 中的 Supabase 公开配置。",
  });

  async function verifyAnonymousSignIn() {
    setVerification({ status: "running", message: "正在验证真实匿名登录…" });

    try {
      const user = await ensureAnonymousUser();
      setVerification({
        status: "success",
        message: `匿名身份验证成功：${user.id.slice(0, 8)}…`,
      });
      setAuthVerified(true);
    } catch (error) {
      setAuthVerified(false);
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "发生未知错误。",
      });
    }
  }

  async function readProfile() {
    setVerification({ status: "running", message: "正在调用 identity/me…" });

    try {
      const currentProfile = await getIdentityProfile();
      setProfile(currentProfile);
      setVerification({
        status: "success",
        message: currentProfile
          ? `profile 读取成功：${currentProfile.nickname}`
          : "identity/me 调用成功，当前匿名身份尚未绑定 profile。",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "发生未知错误。",
      });
    }
  }

  async function createProfile() {
    setVerification({
      status: "running",
      message: "正在通过 identity/create 创建 profile…",
    });

    try {
      const identity = await createIdentityProfile(nickname);
      setProfile(identity.profile);
      setRecoveryCode(identity.recoveryCode);
      setVerification({
        status: "success",
        message: identity.recoveryCode
          ? "profile 创建成功。请立即复制下方首次找回码。"
          : "该匿名身份已经绑定 profile；服务端未再次返回找回码。",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "发生未知错误。",
      });
    }
  }

  async function verifyDirectReadDenied() {
    setVerification({
      status: "running",
      message: "正在确认浏览器不能直接读取 profiles…",
    });

    try {
      await verifyDirectProfileReadIsDenied();
      setVerification({
        status: "success",
        message: "权限验证通过：浏览器直接读取 profiles 被拒绝。",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "发生未知错误。",
      });
    }
  }

  return (
    <main>
      <h1>Supabase anonymous auth preview</h1>
      <p>
        这个入口只验证真实 Supabase 匿名身份，不验证 profile 数据库或 AI
        服务。
      </p>
      <p>
        前端公开配置：<strong>{configured ? "已读取" : "未配置"}</strong>
      </p>
      <button
        type="button"
        disabled={!configured || verification.status === "running"}
        onClick={verifyAnonymousSignIn}
      >
        {verification.status === "running" ? "验证中…" : "验证匿名登录"}
      </button>
      <button
        type="button"
        disabled={!authVerified || verification.status === "running"}
        onClick={readProfile}
      >
        检查 identity/me
      </button>
      <button
        type="button"
        disabled={!authVerified || verification.status === "running"}
        onClick={verifyDirectReadDenied}
      >
        验证 profiles 直读被拒
      </button>
      {profile === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createProfile();
          }}
        >
          <label htmlFor="verification-nickname">昵称</label>{" "}
          <input
            id="verification-nickname"
            value={nickname}
            maxLength={20}
            onChange={(event) => setNickname(event.target.value)}
          />
          <button
            type="submit"
            disabled={!nickname.trim() || verification.status === "running"}
          >
            创建 profile
          </button>
        </form>
      ) : null}
      <p role="status" aria-live="polite">
        {verification.message}
      </p>
      {profile ? (
        <p>
          当前 profile：<strong>{profile.nickname}</strong>（版本 {profile.credentialVersion}）
        </p>
      ) : null}
      {recoveryCode ? (
        <p>
          首次找回码：<code>{recoveryCode}</code>
        </p>
      ) : null}
      <p>刷新页面后再次验证应得到相同身份；新的无痕窗口应得到不同身份。</p>
      <a href="/">返回运行页</a>
    </main>
  );
}

export default function App() {
  const preview = new URLSearchParams(window.location.search).get("preview");

  if (preview === "contracts") {
    return <ContractPreview />;
  }

  if (preview === "supabase") {
    return <SupabasePreview />;
  }

  return (
    <main>
      <h1>Find Your Planet</h1>
      <p>两颗星之间的距离，两颗心之间的距离。</p>
      <p>React、TypeScript 与 Vite 运行环境已接通。</p>
      <ul>
        <li>
          <a href="/?preview=contracts">打开 contracts 预览</a>
        </li>
        <li>
          <a href="/?preview=supabase">打开 Supabase 匿名身份预览</a>
        </li>
      </ul>
    </main>
  );
}
