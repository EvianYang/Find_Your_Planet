/**
 * DEMO ONLY: preview for tasks 1.1–1.4 and 1.8–1.10 with simulated service calls.
 * Uses C's fixtures for prompts and results; nothing here is live data or a runtime fallback.
 * B decides how this is mounted (for example `/?preview=screens` in App.tsx).
 */
import { useMemo, useState } from "react";

import type { GameSnapshot, Slot } from "@contracts/game.ts";
import { RankedRecordSchema, type RankedRecord } from "@contracts/records.ts";

import "../styles/global.css";
import { RecoveryCodePanel } from "../components/RecoveryCodePanel.tsx";
import {
  closeRound,
  farRound,
  insufficientRound,
  mediumRound,
  partialRound,
  type DemoRoundFixture,
} from "../fixtures/round-results.ts";
import { AnswerScreen } from "./AnswerScreen.tsx";
import { LobbyScreen } from "./LobbyScreen.tsx";
import { RecordsScreen } from "./RecordsScreen.tsx";
import { ResultScreen } from "./ResultScreen.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";

type Screen = "welcome" | "recovery" | "lobby" | "answer" | "result" | "records";
type RevealedRound = GameSnapshot["revealedRounds"][number];

const DEMO_CODE = "7KQF-9M2X-TP4H-W8NA-3CDE-YJ6R-5B";
const DEMO_CODE_NEW = "H3VN-6QWD-8ZKA-2MRT-F5XC-9PJE-4G";
const players = closeRound.players;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const apiError = (code: string) => new Error(`${code}: demo error`);

function asRound(fixture: DemoRoundFixture, roundIndex: 1 | 2 | 3): RevealedRound {
  if (fixture.response.data?.status !== "ready") throw new Error("Fixture has no result");
  return { roundIndex, prompt: fixture.prompt, answers: fixture.answers, result: fixture.response.data.result };
}
const RESULT_SETS: Record<string, { rounds: RevealedRound[]; overall: NonNullable<GameSnapshot["overall"]> }> = {
  "3": { rounds: [asRound(closeRound, 1), asRound(mediumRound, 2), asRound(farRound, 3)], overall: { overallDistance: 500, validRounds: 3, totalRounds: 3 } },
  "2": { rounds: [asRound(closeRound, 1), asRound(farRound, 2), asRound(partialRound, 3)], overall: { overallDistance: 500, validRounds: 2, totalRounds: 3 } },
  "1": { rounds: [asRound(closeRound, 1), asRound(insufficientRound, 2), asRound(partialRound, 3)], overall: { overallDistance: null, validRounds: 1, totalRounds: 3 } },
};

/** Demo records validated against the shared schema; ranks are written as the server would return them. */
function demoRecords(): RankedRecord[] {
  const snap = (f: DemoRoundFixture, roundIndex: 1 | 2 | 3) => {
    const r = asRound(f, roundIndex).result;
    return {
      roundIndex, prompt: f.prompt, distance: r.distance, coverage: r.coverage, summary: r.summary,
      commonality: r.commonality, divergence: r.divergence, unknowns: r.unknowns, rubricVersion: r.rubricVersion, modelId: r.modelId,
    };
  };
  const rows: Array<[string, string, string, DemoRoundFixture[], number | null, number, number | null]> = [
    ["Sam", "2026-09-25T20:10:00Z", "1", [closeRound, mediumRound, partialRound], 250, 2, 1],
    ["June", "2026-09-21T19:00:00Z", "2", [closeRound, mediumRound, insufficientRound], 250, 2, 1],
    ["Sam", "2026-09-18T18:30:00Z", "3", [closeRound, mediumRound, farRound], 500, 3, 3],
    ["Kai", "2026-09-12T21:45:00Z", "4", [mediumRound, farRound, partialRound], 750, 2, 4],
    ["Stargazer_Wanderer_X", "2026-09-09T17:05:00Z", "5", [farRound, farRound, insufficientRound], 1000, 2, 5],
    ["Sam", "2026-09-03T16:20:00Z", "6", [closeRound, insufficientRound, partialRound], null, 1, null],
    ["Noor", "2026-08-30T15:00:00Z", "7", [insufficientRound, partialRound, insufficientRound], null, 0, null],
  ];
  return rows.map(([partnerNickname, playedAt, n, fixtures, overallDistance, validRounds, rank]) =>
    RankedRecordSchema.parse({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      sourceRoomId: `10000000-0000-4000-8000-00000000000${n}`,
      partnerNickname, playedAt, savedAt: playedAt,
      rounds: fixtures.map((f, i) => snap(f, (i + 1) as 1 | 2 | 3)),
      overallDistance, validRounds, rubricVersion: "fmp-v1", rank,
    }),
  );
}

export default function ScreensPreview() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [width, setWidth] = useState(390);
  const [viewer, setViewer] = useState<Slot>("A");
  const [profile, setProfile] = useState<string | null>(null);
  const [recoverReady, setRecoverReady] = useState(true);
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>("K7QF2MXA");
  const [failNext, setFailNext] = useState(false);
  const [ownAnswer, setOwnAnswer] = useState<string | null>(null);
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);
  const [resultSet, setResultSet] = useState("3");
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [records, setRecords] = useState<RankedRecord[]>(() => demoRecords());
  const [page, setPage] = useState(1);
  const [recordsMode, setRecordsMode] = useState<"list" | "empty" | "error">("list");
  const [log, setLog] = useState<string[]>([]);
  const [key, setKey] = useState(0);
  const note = (text: string) => setLog((l) => [text, ...l].slice(0, 8));
  const lobbyPlayers = useMemo(() => (viewer === "B" || partnerJoined ? players : players.filter((p) => p.slot === "A")), [viewer, partnerJoined]);
  const shown = recordsMode === "empty" ? [] : records.slice(0, page * 4);

  const go = (next: Screen) => { setScreen(next); setKey((k) => k + 1); };
  const maybeFail = async (code: string) => { await wait(700); if (failNext) { setFailNext(false); throw apiError(code); } };

  let device;
  if (screen === "welcome") {
    device = (
      <WelcomeScreen
        key={key}
        profileNickname={profile}
        onCreateIdentity={async (nickname) => { await wait(600); note(`identity/create "${nickname}"`); setProfile(nickname); return { recoveryCode: DEMO_CODE }; }}
        onCreateRoom={async () => { await maybeFail("INTERNAL_ERROR"); note("game/create"); setViewer("A"); setPartnerJoined(false); go("lobby"); }}
        onJoinRoom={async (code) => {
          await wait(700);
          note(`game/join ${code}`);
          if (code.startsWith("FULL")) throw apiError("ROOM_FULL");
          if (code.startsWith("LATE")) throw apiError("EXPIRED");
          if (code.startsWith("NNNN")) throw apiError("NOT_FOUND");
          setViewer("B"); go("lobby");
        }}
        onRecover={recoverReady ? async (code) => {
          await wait(700);
          const c = code.toUpperCase();
          note("identity/recover");
          if (c.startsWith("BAD")) throw apiError("RECOVERY_FAILED");
          if (c.startsWith("SLW")) throw apiError("RATE_LIMITED");
          if (c.startsWith("FULL")) throw apiError("RECOVERY_TARGET_NOT_EMPTY");
          setProfile("Alex");
          return { recoveryCode: DEMO_CODE_NEW };
        } : undefined}
        onRecovered={() => go("records")}
      />
    );
  } else if (screen === "recovery") {
    device = <RecoveryCodePanel key={key} code={DEMO_CODE} variant="view" onBack={() => go("records")} onRotate={async () => { await maybeFail("INTERNAL_ERROR"); note("identity/rotate_recovery"); return { recoveryCode: DEMO_CODE_NEW }; }} />;
  } else if (screen === "lobby") {
    device = <LobbyScreen key={key} joinCode={joinCode} players={lobbyPlayers} viewerSlot={viewer} onStart={async () => { await maybeFail("INVALID_PHASE"); note("game/start"); go("answer"); }} />;
  } else if (screen === "answer") {
    device = (
      <AnswerScreen
        key={key}
        roundIndex={1}
        prompt={closeRound.prompt}
        players={players}
        viewerSlot={viewer}
        ownAnswer={ownAnswer}
        partnerSubmitted={partnerSubmitted}
        onSubmit={async (answer) => { await maybeFail("INTERNAL_ERROR"); note("game/submit"); setOwnAnswer(answer); }}
      />
    );
  } else if (screen === "result") {
    const set = RESULT_SETS[resultSet];
    device = (
      <ResultScreen
        key={`${key}-${resultSet}-${alreadySaved}`}
        players={players}
        viewerSlot={viewer}
        overall={set.overall}
        rounds={set.rounds}
        alreadySaved={alreadySaved}
        onSave={async () => { await maybeFail("EXPIRED"); note("records/save"); }}
        onOpenRecords={() => go("records")}
        onBackToStart={() => go("welcome")}
      />
    );
  } else {
    device = (
      <RecordsScreen
        key={key}
        records={shown}
        nextCursor={recordsMode === "list" && shown.length < records.length ? `page-${page + 1}` : null}
        loadError={recordsMode === "error"}
        onRetry={() => setRecordsMode("list")}
        onLoadMore={async () => { await wait(500); note("records/list (next page)"); setPage((p) => p + 1); }}
        onDelete={async (id) => { await maybeFail("INTERNAL_ERROR"); note("records/delete"); setRecords((r) => r.filter((x) => x.id !== id)); }}
        onStartGame={() => go("welcome")}
        onOpenRecoveryCode={() => go("recovery")}
      />
    );
  }

  const control = { display: "flex", flexDirection: "column" as const, gap: 4 };
  return (
    <div style={{ display: "flex", gap: 24, padding: 24, alignItems: "flex-start", flexWrap: "wrap", fontFamily: "system-ui, sans-serif" }}>
      <div data-testid="screens-device" style={{ width, maxWidth: "100%", minHeight: 640, border: "1px solid #232a40", borderRadius: width > 700 ? 14 : 32, overflow: "hidden", background: "#0b1020" }}>
        {device}
      </div>
      <aside aria-label="Preview controls" style={{ display: "grid", gap: 12, minWidth: 260, maxWidth: 340, color: "#e6e4de", fontSize: 14 }}>
        <strong>Demo screens (simulated calls, not live data)</strong>
        <label style={control}>Screen
          <select value={screen} onChange={(e) => go(e.target.value as Screen)}>
            <option value="welcome">1.1 Welcome</option>
            <option value="lobby">1.2 Lobby</option>
            <option value="answer">1.3–1.4 Answer and waiting</option>
            <option value="result">1.8 Result</option>
            <option value="records">1.9 Records</option>
            <option value="recovery">1.10 Recovery code (view)</option>
          </select>
        </label>
        <label style={control}>Width
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            <option value={390}>390</option><option value={375}>375</option><option value={320}>320</option><option value={1040}>1040</option>
          </select>
        </label>
        <label style={control}>Viewer
          <select value={viewer} onChange={(e) => { setViewer(e.target.value as Slot); setKey((k) => k + 1); }}><option value="A">A (host)</option><option value="B">B</option></select>
        </label>
        <label><input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Make the next request fail</label>
        {screen === "welcome" ? (
          <>
            <label><input type="checkbox" checked={profile !== null} onChange={(e) => { setProfile(e.target.checked ? "Alex" : null); setKey((k) => k + 1); }} /> Returning player (profile exists)</label>
            <label><input type="checkbox" checked={recoverReady} onChange={(e) => { setRecoverReady(e.target.checked); setKey((k) => k + 1); }} /> identity/recover available</label>
            <p style={{ margin: 0, color: "#9aa0b5" }}>Join codes: FULL2222 full · LATE2222 closed · NNNN2222 not found · others join. Recovery codes starting BAD (wrong code), SLW (too many tries) or FULL (browser already has data) show errors.</p>
          </>
        ) : null}
        {screen === "lobby" ? (
          <>
            <label><input type="checkbox" checked={partnerJoined} onChange={(e) => setPartnerJoined(e.target.checked)} /> Partner joined</label>
            <label><input type="checkbox" checked={joinCode === null} onChange={(e) => setJoinCode(e.target.checked ? null : "K7QF2MXA")} /> Join code missing from snapshot</label>
          </>
        ) : null}
        {screen === "answer" ? (
          <>
            <label><input type="checkbox" checked={partnerSubmitted} onChange={(e) => setPartnerSubmitted(e.target.checked)} /> Partner submitted</label>
            <button type="button" onClick={() => { setOwnAnswer(null); setKey((k) => k + 1); }}>Reset my answer</button>
          </>
        ) : null}
        {screen === "result" ? (
          <>
            <label style={control}>Measured rounds
              <select value={resultSet} onChange={(e) => setResultSet(e.target.value)}><option value="3">3 of 3</option><option value="2">2 of 3</option><option value="1">1 of 3 (no overall)</option></select>
            </label>
            <label><input type="checkbox" checked={alreadySaved} onChange={(e) => setAlreadySaved(e.target.checked)} /> Already saved (after refresh)</label>
          </>
        ) : null}
        {screen === "records" ? (
          <label style={control}>Records
            <select value={recordsMode} onChange={(e) => { setRecordsMode(e.target.value as "list" | "empty" | "error"); setPage(1); setRecords(demoRecords()); }}>
              <option value="list">List (4 per page)</option><option value="empty">Empty</option><option value="error">Load error</option>
            </select>
          </label>
        ) : null}
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
