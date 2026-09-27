/**
 * DEMO ONLY: drives GameScreen through a whole game with a simulated server and partner.
 * Uses C's fixtures for prompts and results; nothing here is live data or a runtime fallback.
 * B decides how this is mounted (for example `/?preview=game` in App.tsx).
 */
import { useReducer, useRef, useState } from "react";

import type { EvaluationState, GameSnapshot, Phase, Slot } from "@contracts/game.ts";

import "../styles/global.css";
import {
  closeRound,
  farRound,
  insufficientRound,
  mediumRound,
  partialRound,
  type DemoRoundFixture,
} from "../fixtures/round-results.ts";
import { GameScreen } from "./GameScreen.tsx";

type RevealedRound = GameSnapshot["revealedRounds"][number];
type Flags = { a: boolean; b: boolean };
type Outcome = "ok" | "fail" | "internal" | "stuck";
type Sim = {
  phase: Phase;
  round: 0 | 1 | 2 | 3;
  revision: number;
  partnerJoined: boolean;
  ownAnswer: string | null;
  submitted: Flags;
  continued: Flags;
  evaluationState: EvaluationState;
  running: boolean;
  manualRetries: number;
  revealed: RevealedRound[];
};

const ROOM_ID = "20000000-0000-4000-8000-000000000001";
const FIXTURES: Record<string, DemoRoundFixture> = {
  close: closeRound, medium: mediumRound, far: farRound, partial: partialRound, insufficient: insufficientRound,
};
const PLAYERS = closeRound.players;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const apiError = (code: string, retryable?: boolean) =>
  Object.assign(new Error(`${code}: demo error`), retryable === undefined ? {} : { retryable });
const slotKey = (slot: Slot) => (slot === "A" ? "a" : "b");
const initialSim = (): Sim => ({
  phase: "lobby", round: 0, revision: 1, partnerJoined: false, ownAnswer: null,
  submitted: { a: false, b: false }, continued: { a: false, b: false },
  evaluationState: "idle", running: false, manualRetries: 0, revealed: [],
});

export default function GamePreview() {
  const sim = useRef<Sim>(initialSim());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [viewer, setViewer] = useState<Slot>("A");
  const [width, setWidth] = useState(390);
  const [plan, setPlan] = useState(["medium", "close", "partial"]);
  const [outcome, setOutcome] = useState<Outcome>("ok");
  const [passRetryable, setPassRetryable] = useState(true);
  const [joinCodeKnown, setJoinCodeKnown] = useState(true);
  const [connection, setConnection] = useState<"ok" | "unstable" | "loading" | "NOT_FOUND" | "EXPIRED" | "offline">("ok");
  const [log, setLog] = useState<string[]>([]);
  const [gameKey, setGameKey] = useState(0);
  const settings = useRef({ viewer, plan, outcome, passRetryable });
  settings.current = { viewer, plan, outcome, passRetryable };

  const note = (text: string) => setLog((l) => [text, ...l].slice(0, 10));
  const set = (change: Partial<Sim>) => {
    sim.current = { ...sim.current, ...change, revision: sim.current.revision + 1 };
    rerender();
  };
  const me = () => slotKey(settings.current.viewer);
  const them = () => (me() === "a" ? "b" : "a");

  const submitFor = (who: "a" | "b") => {
    const submitted = { ...sim.current.submitted, [who]: true };
    const both = submitted.a && submitted.b;
    set({ submitted, ...(both ? { phase: "evaluating" as const, evaluationState: "pending" as const } : {}) });
  };
  const continueFor = (who: "a" | "b") => {
    const continued = { ...sim.current.continued, [who]: true };
    if (!(continued.a && continued.b)) return set({ continued });
    if (sim.current.round === 3) return set({ continued, phase: "finished" });
    set({
      phase: "answering", round: (sim.current.round + 1) as 1 | 2 | 3, ownAnswer: null,
      submitted: { a: false, b: false }, continued: { a: false, b: false }, evaluationState: "idle", manualRetries: 0,
    });
  };

  const evaluate = async () => {
    const s = sim.current;
    if (s.phase !== "evaluating") throw apiError("INVALID_PHASE", false);
    if (s.running) return { status: "processing" };
    const manual = s.evaluationState === "failed";
    const retryable = (value: boolean) => (settings.current.passRetryable ? value : undefined);
    if (manual && s.manualRetries >= 2) throw apiError("EVALUATION_FAILED", retryable(false));
    set({ evaluationState: "processing", running: true, manualRetries: s.manualRetries + (manual ? 1 : 0) });
    await wait(1400);
    const result = settings.current.outcome;
    if (result === "stuck") {
      set({ running: false });
      return { status: "processing" };
    }
    if (result === "internal") {
      set({ evaluationState: manual ? "failed" : "pending", running: false });
      throw apiError("INTERNAL_ERROR", true);
    }
    if (result === "fail") {
      set({ evaluationState: "failed", running: false });
      throw apiError("EVALUATION_FAILED", retryable(sim.current.manualRetries < 2));
    }
    const fixture = FIXTURES[settings.current.plan[sim.current.round - 1]];
    if (fixture.response.data?.status !== "ready") throw new Error("Fixture has no result");
    const answers = { ...fixture.answers, [me()]: sim.current.ownAnswer ?? fixture.answers[me()] };
    set({
      phase: "reveal", evaluationState: "ready", running: false, continued: { a: false, b: false },
      revealed: [...sim.current.revealed, { roundIndex: sim.current.round as 1 | 2 | 3, prompt: fixture.prompt, answers, result: fixture.response.data.result }],
    });
    return fixture.response.data;
  };

  const s = sim.current;
  const measured = s.revealed.map((r) => r.result.distance).filter((d): d is number => d !== null);
  const snapshot: GameSnapshot = {
    roomId: ROOM_ID,
    phase: s.phase,
    currentRound: s.round,
    revision: s.revision,
    expiresAt: "2026-09-27T20:00:00.000Z",
    players: s.partnerJoined || viewer === "B" ? PLAYERS : PLAYERS.filter((p) => p.slot === "A"),
    currentPrompt: s.round > 0 ? { ...closeRound.prompt, id: `demo-round-${s.round}` } : null,
    ownAnswer: s.ownAnswer,
    submitted: s.submitted,
    continued: s.continued,
    evaluationState: s.evaluationState,
    revealedRounds: s.revealed,
    overall: s.phase === "finished"
      ? {
        overallDistance: measured.length >= 2 ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null,
        validRounds: measured.length,
        totalRounds: 3,
      }
      : null,
  };
  const failure = connection === "NOT_FOUND" || connection === "EXPIRED" || connection === "offline"
    ? connection === "offline" ? new Error("Failed to fetch") : apiError(connection, false)
    : null;
  const reset = (nextViewer = viewer) => {
    sim.current = { ...initialSim(), partnerJoined: nextViewer === "B" };
    setGameKey((k) => k + 1);
    setLog([]);
  };

  const control = { display: "flex", flexDirection: "column" as const, gap: 4 };
  const partnerAction: [string, () => void] | null =
    s.phase === "lobby"
      ? viewer === "A"
        ? s.partnerJoined ? null : ["Partner joins", () => { note("partner joined"); set({ partnerJoined: true }); }]
        : ["Host starts the game", () => { note("host started"); set({ phase: "answering", round: 1 }); }]
      : s.phase === "answering" && !s.submitted[them()]
        ? ["Partner answers", () => { note("partner submitted"); submitFor(them()); }]
        : s.phase === "reveal" && !s.continued[them()]
          ? ["Partner continues", () => { note("partner continued"); continueFor(them()); }]
          : null;
  return (
    <div style={{ display: "flex", gap: 24, padding: 24, alignItems: "flex-start", flexWrap: "wrap", fontFamily: "system-ui, sans-serif" }}>
      <div data-testid="game-device" style={{ width, maxWidth: "100%", minHeight: 640, border: "1px solid #232a40", borderRadius: width > 700 ? 14 : 32, overflow: "hidden", background: "#0b1020" }}>
        <GameScreen
          key={gameKey}
          snapshot={connection === "loading" || failure ? null : snapshot}
          loading={connection === "loading"}
          syncError={connection === "unstable" ? new Error("Could not refresh the game.") : failure}
          viewerSlot={viewer}
          joinCode={viewer === "A" && joinCodeKnown ? "K7QF2MXA" : null}
          onStart={async () => { await wait(500); note("game/start"); set({ phase: "answering", round: 1 }); }}
          onSubmit={async (round, answer) => { await wait(600); note(`game/submit round ${round}`); set({ ownAnswer: answer }); submitFor(me()); }}
          onEvaluate={async (round) => { note(`evaluate/run round ${round}`); return evaluate(); }}
          onContinue={async (round) => { await wait(500); note(`game/continue round ${round}`); continueFor(me()); }}
          onRefresh={async () => { note("game/snapshot"); }}
          onSave={async () => { await wait(600); note("records/save"); }}
          onOpenRecords={() => note("open My encounters")}
          onBackToStart={() => { note("back to start"); reset(); }}
        />
      </div>
      <aside aria-label="Preview controls" style={{ display: "grid", gap: 12, minWidth: 260, maxWidth: 340, color: "#e6e4de", fontSize: 14 }}>
        <strong>Demo game (simulated server and partner, not live data)</strong>
        <p style={{ margin: 0, color: "#9aa0b5" }}>Phase: {s.phase} · round {s.round} · evaluation {s.evaluationState}</p>
        <button type="button" disabled={!partnerAction} onClick={() => partnerAction?.[1]()}>
          {partnerAction?.[0] ?? "Partner is waiting for you"}
        </button>
        <label style={control}>Next evaluation
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
            <option value="ok">Succeeds</option>
            <option value="fail">Fails (EVALUATION_FAILED)</option>
            <option value="internal">Service unavailable (INTERNAL_ERROR)</option>
            <option value="stuck">Stays processing (other device lost its lease)</option>
          </select>
        </label>
        <label><input type="checkbox" checked={passRetryable} onChange={(e) => setPassRetryable(e.target.checked)} /> Service passes <code>retryable</code> through (needed for the “exhausted” state)</label>
        {[0, 1, 2].map((i) => (
          <label key={i} style={control}>Round {i + 1} result
            <select value={plan[i]} onChange={(e) => setPlan((p) => p.map((v, j) => (j === i ? e.target.value : v)))}>
              {Object.keys(FIXTURES).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        ))}
        <label style={control}>Connection
          <select value={connection} onChange={(e) => setConnection(e.target.value as typeof connection)}>
            <option value="ok">OK</option>
            <option value="unstable">Refresh failing (last snapshot shown)</option>
            <option value="loading">First snapshot loading</option>
            <option value="offline">Room can't load (network)</option>
            <option value="NOT_FOUND">Room can't load (NOT_FOUND)</option>
            <option value="EXPIRED">Room can't load (EXPIRED)</option>
          </select>
        </label>
        <label style={control}>Viewer
          <select value={viewer} onChange={(e) => { const next = e.target.value as Slot; setViewer(next); reset(next); }}>
            <option value="A">A (host)</option><option value="B">B (joined)</option>
          </select>
        </label>
        <label><input type="checkbox" checked={joinCodeKnown} onChange={(e) => setJoinCodeKnown(e.target.checked)} /> Host knows the room code</label>
        <label style={control}>Width
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            <option value={390}>390</option><option value={375}>375</option><option value={320}>320</option><option value={1040}>1040</option>
          </select>
        </label>
        <button type="button" onClick={() => reset()}>Reset game</button>
        <div>
          <strong>Simulated calls</strong>
          <ol style={{ margin: "6px 0 0", paddingLeft: 18, color: "#9aa0b5", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            {log.map((line, i) => <li key={`${line}-${i}`}>{line}</li>)}
          </ol>
        </div>
      </aside>
    </div>
  );
}
