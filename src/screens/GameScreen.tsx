import { useCallback, useEffect, useRef, useState } from "react";

import type { GameSnapshot, RoundIndex, Slot } from "@contracts/game.ts";

import "../styles/tokens.css";
import "../styles/screens.css";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { errorCodeOf, errorCopy, retryableOf, type ErrorContext } from "../components/error-copy.ts";
import { MoonLoader } from "../components/MoonLoader.tsx";
import { Button, FieldError } from "../components/ui.tsx";
import { AnswerScreen } from "./AnswerScreen.tsx";
import { LobbyScreen } from "./LobbyScreen.tsx";
import { ResultScreen } from "./ResultScreen.tsx";
import { RevealScreen, type RevealScreenProps, type RevealStatus } from "./RevealScreen.tsx";

export type GameScreenProps = {
  /** useGameSession(roomId): snapshot, loading, error. */
  snapshot: GameSnapshot | null;
  loading: boolean;
  syncError: Error | null;
  onStart: () => Promise<unknown>;
  onSubmit: (roundIndex: RoundIndex, answer: string) => Promise<unknown>;
  /** evaluate/run. Either device may call it; the server lets one run and answers "processing" to the other. */
  onEvaluate: (roundIndex: RoundIndex) => Promise<unknown>;
  onContinue: (roundIndex: RoundIndex) => Promise<unknown>;
  /** useGameSession().refresh. Called after every action so the screen doesn't wait for Realtime. */
  onRefresh: () => Promise<void>;
  /** records/save (task 5). Omit until it exists. */
  onSave?: () => Promise<unknown>;
  alreadySaved?: boolean;
  onOpenRecords?: () => void;
  /** Local exit: forget this room on this device and go back to the start (no server-side leave). */
  onLeave?: () => void;
};

/** The server's evaluation lease is 60 seconds; after that another call can take over a stuck run. */
const LEASE_RECHECK_MS = 65_000;
/** The room is gone or this browser lost access: retrying can't help, only leaving can. */
const isFatal = (error: unknown) => {
  const code = errorCodeOf(error);
  return code === "EXPIRED" || code === "NOT_FOUND" || code === "UNAUTHORIZED" || code === "IDENTITY_REPLACED";
};
const slotKey = (slot: Slot) => (slot === "A" ? "a" : "b");

async function settle(refresh: () => Promise<void>) {
  try {
    await refresh();
  } catch {
    // The session hook reports sync problems through syncError.
  }
}

/** "First time this device sees this reveal" lives in sessionStorage so a refresh shows the finished state. */
const revealSeenKey = (roomId: string, round: number) => `fyp:revealed:${roomId}:${round}`;
function hasSeenReveal(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function markRevealSeen(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Private modes can block storage; the reveal then simply plays again after a refresh.
  }
}

type EvaluationLocal = {
  key: string;
  inFlight: boolean;
  /** The running call is a Try again. */
  manual: boolean;
  /** The last call on this device failed and can be tried again. */
  failed: boolean;
  /** A call came back EVALUATION_FAILED with retryable: false (can arrive before the snapshot shows it). */
  exhausted: boolean;
  /** A failure was seen in this round, so a new "processing" is a retry. */
  sawFailure: boolean;
};
const freshEvaluation = (key: string): EvaluationLocal => ({
  key, inFlight: false, manual: false, failed: false, exhausted: false, sawFailure: false,
});

/**
 * Starts evaluate/run once both answers are in, picks up a stuck run after the lease,
 * and turns the outcome plus evaluationRetriesRemaining into RevealScreen's status.
 */
function useEvaluation(snapshot: GameSnapshot | null, onEvaluate: GameScreenProps["onEvaluate"], onRefresh: () => Promise<void>) {
  const round = snapshot?.phase === "evaluating" && snapshot.currentRound > 0 ? (snapshot.currentRound as RoundIndex) : null;
  const key = snapshot && round ? `${snapshot.roomId}:${round}` : "";
  const serverState = snapshot?.evaluationState;
  const retriesLeft = snapshot?.evaluationRetriesRemaining ?? null;
  const [stored, setStored] = useState<EvaluationLocal>(() => freshEvaluation(key));
  const local = stored.key === key ? stored : freshEvaluation(key);
  const inFlight = useRef<string | null>(null);
  const latest = useRef({ onEvaluate, onRefresh });
  latest.current = { onEvaluate, onRefresh };

  const update = useCallback((forKey: string, change: Partial<EvaluationLocal>) => {
    setStored((current) => ({ ...(current.key === forKey ? current : freshEvaluation(forKey)), ...change }));
  }, []);

  const run = useCallback(async (manual: boolean) => {
    if (!round || !key || inFlight.current === key) return;
    inFlight.current = key;
    update(key, { inFlight: true, manual, failed: false });
    try {
      await latest.current.onEvaluate(round);
    } catch (err) {
      const code = errorCodeOf(err);
      if (code === "EVALUATION_FAILED") {
        const exhausted = retryableOf(err) === false;
        update(key, { failed: !exhausted, exhausted, sawFailure: true });
      } else if (code !== "INVALID_PHASE" && code !== "CONFLICT" && !isFatal(err)) {
        // Network or service trouble before the run started: offer Try again instead of spinning.
        // Fatal codes surface through the snapshot refresh instead.
        update(key, { failed: true });
      }
    } finally {
      // Refresh before releasing the guard, so a stale "pending" snapshot can't start a second call.
      await settle(latest.current.onRefresh);
      inFlight.current = null;
      update(key, { inFlight: false });
    }
  }, [key, round, update]);

  useEffect(() => {
    if (key && serverState === "failed" && !local.sawFailure) update(key, { sawFailure: true });
  }, [key, serverState, local.sawFailure, update]);

  useEffect(() => {
    if (!key || local.exhausted || local.inFlight) return;
    if (serverState === "pending" && !local.failed) {
      void run(false);
      return;
    }
    if (serverState === "processing") {
      const timer = window.setTimeout(() => void run(false), LEASE_RECHECK_MS);
      return () => window.clearTimeout(timer);
    }
  }, [key, serverState, local.exhausted, local.failed, local.inFlight, run]);

  let status: RevealStatus = { kind: "analyzing" };
  if (local.exhausted || (serverState === "failed" && retriesLeft === 0)) status = { kind: "exhausted" };
  else if (local.inFlight && local.manual) status = { kind: "retrying" };
  else if (!local.inFlight && (serverState === "failed" || (local.failed && serverState !== "processing"))) {
    status = { kind: "failed", retriesLeft: serverState === "failed" ? retriesLeft : null };
  }
  // A manual retry has been claimed in this round (also known after a refresh or on the partner's device).
  else if (serverState === "processing" && (local.sawFailure || (retriesLeft !== null && retriesLeft < 2))) {
    status = { kind: "retrying" };
  }

  const retry = () => void run(true);
  return { status, retry };
}

/** Wires the session snapshot to the screens by phase. Pure UI: B passes the hook state and service calls in. */
export function GameScreen({
  snapshot,
  loading,
  syncError,
  onStart,
  onSubmit,
  onEvaluate,
  onContinue,
  onRefresh,
  onSave,
  alreadySaved,
  onOpenRecords,
  onLeave,
}: GameScreenProps) {
  const evaluation = useEvaluation(snapshot, onEvaluate, onRefresh);

  /** Runs an action, then pulls the snapshot, so a button stays busy until the new state is on screen. */
  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } finally {
      await settle(onRefresh);
    }
  };

  if (!snapshot) {
    return <GameStatus loading={loading} error={syncError} onRetry={onRefresh} onLeave={onLeave} />;
  }

  const fatal = isFatal(syncError);
  if (fatal && snapshot.phase !== "finished") {
    return <GameStatus loading={false} error={syncError} onRetry={onRefresh} onLeave={onLeave} />;
  }

  const { viewerSlot, joinCode, players, currentRound, currentPrompt } = snapshot;
  const partner = viewerSlot === "A" ? "B" : "A";
  const revealRound = snapshot.phase === "reveal"
    ? snapshot.revealedRounds.find((r) => r.roundIndex === currentRound) ?? null
    : null;
  let screen = null;

  if (snapshot.phase === "lobby") {
    screen = <LobbyScreen joinCode={joinCode} players={players} viewerSlot={viewerSlot} onStart={() => act(onStart)} />;
  } else if (snapshot.phase === "answering" && currentRound > 0 && currentPrompt) {
    const round = currentRound as RoundIndex;
    screen = (
      <AnswerScreen
        key={round}
        roundIndex={round}
        prompt={currentPrompt}
        players={players}
        viewerSlot={viewerSlot}
        ownAnswer={snapshot.ownAnswer}
        partnerSubmitted={snapshot.submitted[slotKey(partner)]}
        onSubmit={(answer) => act(() => onSubmit(round, answer))}
      />
    );
  } else if (snapshot.phase === "evaluating" && currentRound > 0 && currentPrompt) {
    screen = (
      <RevealScreen
        roundIndex={currentRound as RoundIndex}
        prompt={currentPrompt}
        players={players}
        viewerSlot={viewerSlot}
        ownAnswer={snapshot.ownAnswer}
        status={evaluation.status}
        continued={snapshot.continued}
        animate={false}
        onRetry={evaluation.retry}
        onLeave={onLeave}
      />
    );
  } else if (snapshot.phase === "reveal" && revealRound) {
    const seenKey = revealSeenKey(snapshot.roomId, revealRound.roundIndex);
    screen = (
      <FirstTimeReveal
        key={seenKey}
        seenKey={seenKey}
        roundIndex={revealRound.roundIndex}
        prompt={revealRound.prompt}
        players={players}
        viewerSlot={viewerSlot}
        ownAnswer={snapshot.ownAnswer}
        status={{ kind: "revealed", round: revealRound }}
        continued={snapshot.continued}
        onContinue={() => act(() => onContinue(revealRound.roundIndex))}
      />
    );
  } else if (snapshot.phase === "finished" && snapshot.overall) {
    screen = (
      <ResultScreen
        players={players}
        viewerSlot={viewerSlot}
        overall={snapshot.overall}
        rounds={snapshot.revealedRounds}
        alreadySaved={alreadySaved}
        onSave={onSave}
        onOpenRecords={onOpenRecords}
        onBackToStart={onLeave}
      />
    );
  }

  return (
    <>
      {syncError && !fatal ? (
        <p className="sc-sync" role="status">
          Having trouble reaching the game. We'll keep trying.
        </p>
      ) : null}
      {screen ?? <GameStatus loading error={null} onRetry={onRefresh} onLeave={onLeave} />}
    </>
  );
}

/** Plays the reveal only the first time this device shows the round; later mounts and refreshes render the finished state. */
function FirstTimeReveal({ seenKey, ...props }: Omit<RevealScreenProps, "animate"> & { seenKey: string }) {
  const [animate] = useState(() => !hasSeenReveal(seenKey));
  useEffect(() => markRevealSeen(seenKey), [seenKey]);
  return <RevealScreen {...props} animate={animate} />;
}

/** Before the first snapshot arrives, or when it can't be loaded at all. Also used while the app starts. */
export function GameStatus({
  loading,
  error,
  onRetry,
  onLeave,
  title = "We couldn't open this room",
  message = "Opening your room…",
  errorContext = "room",
}: {
  loading: boolean;
  error: Error | null;
  onRetry: () => Promise<void>;
  onLeave?: () => void;
  title?: string;
  message?: string;
  errorContext?: ErrorContext;
}) {
  const [retrying, setRetrying] = useState(false);
  const failed = Boolean(error) && !loading;
  const final = isFatal(error);

  return (
    <section className="fyp-screen" lang="en" aria-label={failed ? title : message}>
      <PlanetPair mode="resting" nicknames={{ A: "", B: "" }} ariaLabel="Two small asteroids resting in the night sky." />
      <div className="sc-sheet">
        {failed ? (
          <>
            <h1 className="sc-title">{title}</h1>
            <FieldError id="fyp-room-error">{errorCopy(error, errorContext)}</FieldError>
            <div className="sc-stack">
              {!final ? (
                <Button
                  busyLabel={retrying ? "Trying again" : null}
                  onClick={() => {
                    setRetrying(true);
                    void settle(onRetry).finally(() => setRetrying(false));
                  }}
                >
                  Try again
                </Button>
              ) : null}
              {onLeave ? <button className="sc-link" type="button" onClick={onLeave}>Back to start</button> : null}
            </div>
          </>
        ) : (
          <p className="sc-status" role="status">
            <MoonLoader size={20} />
            <span>{message}</span>
          </p>
        )}
      </div>
    </section>
  );
}
