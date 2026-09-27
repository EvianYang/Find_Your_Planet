import { useCallback, useEffect, useState } from "react";

import type { IdentityData, IdentityProfile } from "@contracts/identity.ts";

import "./styles/screens.css";
import { errorCodeOf } from "./components/error-copy.ts";
import { useGameSession } from "./hooks/useGameSession.ts";
import { GameScreen, GameStatus } from "./screens/GameScreen.tsx";
import { WelcomeScreen } from "./screens/WelcomeScreen.tsx";
import { evaluateRound } from "./services/evaluate-client.ts";
import { continueGame, createRoom, joinRoom, startGame, submitAnswer } from "./services/game-client.ts";
import { createIdentityProfile, getIdentityProfile, recoverIdentityProfile } from "./services/identity-client.ts";
import { getSupabaseClient } from "./services/supabase-client.ts";

/**
 * The room this tab is playing, so a refresh returns to it. A new tab starts at home;
 * joining with the same code takes either player back in (game/join is idempotent for members).
 */
const ROOM_KEY = "fyp:active-room";
function readRoom(): string | null {
  try {
    return window.sessionStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}
function writeRoom(roomId: string | null) {
  try {
    if (roomId) window.sessionStorage.setItem(ROOM_KEY, roomId);
    else window.sessionStorage.removeItem(ROOM_KEY);
  } catch {
    // Storage can be blocked; the game still works until the page is refreshed.
  }
}

type Identity =
  | { status: "loading" }
  | { status: "ready"; profile: IdentityProfile | null }
  | { status: "error"; error: Error };

/** Visiting doesn't create an anonymous user; identity/create signs in when the player first continues. */
async function loadProfile(): Promise<IdentityProfile | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) return null;
  try {
    return await getIdentityProfile();
  } catch (err) {
    if (errorCodeOf(err) !== "UNAUTHORIZED") throw err;
    // The stored session is no longer valid: drop it locally so identity/create can sign in again.
    await getSupabaseClient().auth.signOut({ scope: "local" });
    return null;
  }
}

function GameRoute({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const session = useGameSession(roomId);
  return (
    <GameScreen
      snapshot={session.snapshot}
      loading={session.loading}
      syncError={session.error}
      onStart={() => startGame(roomId)}
      onSubmit={(round, answer) => submitAnswer(roomId, round, answer)}
      onEvaluate={(round) => evaluateRound(roomId, round)}
      onContinue={(round) => continueGame(roomId, round)}
      onRefresh={session.refresh}
      onLeave={onLeave}
    />
  );
}

/** The real player flow: identity → create or join → the game. Records (task 5) are not wired yet. */
export function GameApp() {
  const [identity, setIdentity] = useState<Identity>({ status: "loading" });
  const [roomId, setRoomId] = useState<string | null>(() => readRoom());

  const loadIdentity = useCallback(async () => {
    setIdentity({ status: "loading" });
    try {
      setIdentity({ status: "ready", profile: await loadProfile() });
    } catch (err) {
      setIdentity({ status: "error", error: err instanceof Error ? err : new Error("Could not load the profile.") });
    }
  }, []);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  const enterRoom = (id: string) => {
    writeRoom(id);
    setRoomId(id);
  };
  const leaveRoom = () => {
    writeRoom(null);
    setRoomId(null);
  };
  const withProfile = (data: IdentityData) => {
    setIdentity({ status: "ready", profile: data.profile });
    return data;
  };

  if (roomId) return <GameRoute key={roomId} roomId={roomId} onLeave={leaveRoom} />;

  if (identity.status !== "ready") {
    return (
      <GameStatus
        loading={identity.status === "loading"}
        error={identity.status === "error" ? identity.error : null}
        onRetry={loadIdentity}
        title="We couldn't load the game"
        message="Loading…"
        errorContext="identity"
      />
    );
  }

  return (
    <WelcomeScreen
      profileNickname={identity.profile?.nickname ?? null}
      onCreateIdentity={async (nickname) => withProfile(await createIdentityProfile(nickname))}
      onCreateRoom={async () => enterRoom((await createRoom()).roomId)}
      onJoinRoom={async (code) => enterRoom((await joinRoom(code)).roomId)}
      onRecover={async (code) => withProfile(await recoverIdentityProfile(code))}
    />
  );
}

/** Shown when the build has no public Supabase settings (local development without .env.local). */
export function NotConfigured() {
  return (
    <section className="fyp-screen" lang="en" aria-labelledby="fyp-not-configured">
      <div className="sc-sheet">
        <h1 className="sc-title" id="fyp-not-configured">Find Your Planet</h1>
        <p className="sc-small">
          This build isn't connected to the game server. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, or open a
          demo: <a href="/?preview=game">game</a>, <a href="/?preview=screens">screens</a>, <a href="/?preview=reveal">reveal</a>.
        </p>
      </div>
    </section>
  );
}
