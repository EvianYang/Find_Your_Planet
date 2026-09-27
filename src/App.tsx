import { lazy, Suspense, useState } from "react";

import { PromptSchema } from "@contracts/game.ts";
import type { IdentityProfile } from "@contracts/identity.ts";

import {
  createIdentityProfile,
  ensureAnonymousUser,
  getIdentityProfile,
  verifyDirectProfileReadIsDenied,
} from "./services/identity-client.ts";
import { isSupabaseConfigured } from "./services/supabase-client.ts";
import { GameApp, NotConfigured } from "./GameApp.tsx";

// Demo-only previews (A); loaded on demand so they stay out of the main bundle.
const DEMOS = {
  game: lazy(() => import("./screens/GamePreview.tsx")),
  screens: lazy(() => import("./screens/ScreensPreview.tsx")),
  reveal: lazy(() => import("./screens/RevealPreview.tsx")),
};
const isDemo = (value: string | null): value is keyof typeof DEMOS => value !== null && Object.hasOwn(DEMOS, value);

const contractExample = {
  id: "curated-01",
  text: "If the world could have one more color, where would you want it to appear?",
  source: "curated",
  version: "fmp-v1",
} as const;

function ContractPreview() {
  const result = PromptSchema.safeParse(contractExample);

  return (
    <main>
      <h1>Contracts preview</h1>
      <p>This local preview validates B-owned data structures. It does not confirm a backend or AI connection.</p>
      <p>
        Prompt fixture validation: <strong>{result.success ? "Passed" : "Failed"}</strong>
      </p>
      <pre>{JSON.stringify(contractExample, null, 2)}</pre>
      <p>
        C&apos;s evaluation fixtures will be connected through <code>src/fixtures/round-results.ts</code>.
      </p>
      <a href="/">Back to the runtime page</a>
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
  const [authUserId, setAuthUserId] = useState<string>();
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<IdentityProfile | null>();
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [verification, setVerification] = useState<VerificationState>({
    status: "idle",
    message: configured
      ? "Configuration loaded. No live anonymous sign-in has been attempted yet."
      : "Public Supabase configuration is missing from .env.local.",
  });

  async function verifyAnonymousSignIn() {
    setVerification({ status: "running", message: "Verifying live anonymous sign-in…" });

    try {
      const user = await ensureAnonymousUser();
      setVerification({
        status: "success",
        message: `Anonymous identity verified: ${user.id.slice(0, 8)}…`,
      });
      setAuthUserId(user.id);
      setAuthVerified(true);
    } catch (error) {
      setAuthUserId(undefined);
      setAuthVerified(false);
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  }

  async function readProfile() {
    setVerification({ status: "running", message: "Calling identity/me…" });

    try {
      const currentProfile = await getIdentityProfile();
      setProfile(currentProfile);
      setVerification({
        status: "success",
        message: currentProfile
          ? `Profile loaded: ${currentProfile.nickname}`
          : "identity/me succeeded. This anonymous identity does not have a profile yet.",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  }

  async function createProfile() {
    setVerification({
      status: "running",
      message: "Creating a profile through identity/create…",
    });

    try {
      const identity = await createIdentityProfile(nickname);
      setProfile(identity.profile);
      setRecoveryCode(identity.recoveryCode);
      setVerification({
        status: "success",
        message: identity.recoveryCode
          ? "Profile created. Copy the one-time recovery code below now."
          : "This anonymous identity already has a profile. The server did not return the recovery code again.",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  }

  async function verifyDirectReadDenied() {
    setVerification({
      status: "running",
      message: "Confirming that the browser cannot read profiles directly…",
    });

    try {
      await verifyDirectProfileReadIsDenied();
      setVerification({
        status: "success",
        message: "Permission check passed: direct browser access to profiles was denied.",
      });
    } catch (error) {
      setVerification({
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  }

  return (
    <main>
      <h1>Supabase anonymous auth preview</h1>
      <p>
        This preview verifies a live Supabase anonymous identity, profile mapping,
        and basic read permissions. It does not verify the AI service.
      </p>
      <p>
        Public frontend configuration: <strong>{configured ? "Loaded" : "Missing"}</strong>
      </p>
      <button
        type="button"
        disabled={!configured || verification.status === "running"}
        onClick={verifyAnonymousSignIn}
      >
        {verification.status === "running" ? "Verifying…" : "Verify anonymous sign-in"}
      </button>
      <button
        type="button"
        disabled={!authVerified || verification.status === "running"}
        onClick={readProfile}
      >
        Check identity/me
      </button>
      <button
        type="button"
        disabled={!authVerified || verification.status === "running"}
        onClick={verifyDirectReadDenied}
      >
        Verify direct profile access is denied
      </button>
      {profile === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createProfile();
          }}
        >
          <label htmlFor="verification-nickname">Nickname</label>{" "}
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
            Create profile
          </button>
        </form>
      ) : null}
      <p role="status" aria-live="polite">
        {verification.message}
      </p>
      {profile ? (
        <section>
          <p>
            Current profile: <strong>{profile.nickname}</strong> (version {profile.credentialVersion})
          </p>
          <p>
            Auth user ID: <code>{authUserId}</code>
            <br />
            Profile ID: <code>{profile.id}</code>
          </p>
        </section>
      ) : null}
      {recoveryCode ? (
        <p>
          One-time recovery code: <code>{recoveryCode}</code>
        </p>
      ) : null}
      <p>
        Task 2.1 check: refreshing or reopening this browser should preserve both
        IDs. The same nickname in a new private window should produce different IDs.
      </p>
      <a href="/">Back to the runtime page</a>
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

  if (isDemo(preview)) {
    const Demo = DEMOS[preview];
    return (
      <Suspense fallback={null}>
        <Demo />
      </Suspense>
    );
  }

  return <div className="fyp-app">{isSupabaseConfigured() ? <GameApp /> : <NotConfigured />}</div>;
}
