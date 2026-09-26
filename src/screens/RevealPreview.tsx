/**
 * DEMO ONLY: fixture-driven preview for tasks 1.5 / 1.6 / 1.7.
 * Uses C's handwritten fixtures (src/fixtures/round-results.ts); never a runtime fallback.
 * B decides how this is mounted (for example `/?preview=reveal` in App.tsx).
 */
import { useState } from "react";

import type { RoundIndex, Slot } from "@contracts/game.ts";

import "../styles/global.css";
import { ROUND_RESULT_FIXTURES, type DemoRoundFixture } from "../fixtures/round-results.ts";
import { RevealScreen, type RevealStatus } from "./RevealScreen.tsx";

type StatusChoice = "revealed" | "analyzing" | "failed-2" | "failed-1" | "retrying" | "exhausted" | "exhausted-checked";

const STATUS_LABELS: Record<StatusChoice, string> = {
  revealed: "揭晓",
  analyzing: "分析中",
  "failed-2": "技术失败（剩 2 次）",
  "failed-1": "技术失败（剩 1 次）",
  retrying: "重试中",
  exhausted: "重试耗尽",
  "exhausted-checked": "重试耗尽（已查询）",
};

function toStatus(choice: StatusChoice, fixture: DemoRoundFixture): RevealStatus {
  const response = fixture.response;
  if (choice === "revealed" && response.data?.status === "ready") {
    return {
      kind: "revealed",
      round: { roundIndex: 1, prompt: fixture.prompt, answers: fixture.answers, result: response.data.result },
    };
  }
  if (choice === "failed-2" || (choice === "revealed" && response.error)) return { kind: "failed", retriesLeft: 2 };
  if (choice === "failed-1") return { kind: "failed", retriesLeft: 1 };
  if (choice === "retrying") return { kind: "retrying" };
  if (choice === "exhausted") return { kind: "exhausted" };
  if (choice === "exhausted-checked") return { kind: "exhausted", checked: true };
  return { kind: "analyzing" };
}

export default function RevealPreview() {
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [choice, setChoice] = useState<StatusChoice>("revealed");
  const [viewer, setViewer] = useState<Slot>("A");
  const [round, setRound] = useState<RoundIndex>(1);
  const [animate, setAnimate] = useState(true);
  const [continued, setContinued] = useState({ a: false, b: false });
  const [replay, setReplay] = useState(0);
  const [width, setWidth] = useState(390);
  const fixture = ROUND_RESULT_FIXTURES[fixtureIndex];
  const status = toStatus(choice, fixture);
  const partnerKey = viewer === "A" ? "b" : "a";
  const meKey = viewer === "A" ? "a" : "b";

  return (
    <div style={{ display: "flex", gap: 24, padding: 24, alignItems: "flex-start", flexWrap: "wrap", fontFamily: "system-ui, sans-serif" }}>
      <div data-testid="reveal-device" style={{ width, maxWidth: "100%", border: "1px solid #232a40", borderRadius: width > 700 ? 14 : 32, overflow: "hidden" }}>
        <RevealScreen
          key={`${fixtureIndex}-${choice}-${viewer}-${round}-${replay}`}
          roundIndex={round}
          prompt={fixture.prompt}
          players={fixture.players}
          viewerSlot={viewer}
          ownAnswer={fixture.answers[meKey]}
          status={status}
          continued={continued}
          animate={animate}
          onRetry={() => setChoice("retrying")}
          onCheckAgain={() => setChoice("exhausted-checked")}
          onContinue={() => setContinued((c) => ({ ...c, [meKey]: true }))}
        />
      </div>
      <aside style={{ display: "grid", gap: 12, minWidth: 260, color: "#e6e4de", fontSize: 14 }} aria-label="预览控制">
        <strong>演示样例（来自 src/fixtures，非实时 AI）</strong>
        <p style={{ margin: 0, color: "#f3c98b" }}>{fixture.label}</p>
        <label>样例 <select value={fixtureIndex} onChange={(e) => { setFixtureIndex(Number(e.target.value)); setContinued({ a: false, b: false }); }}>
          {ROUND_RESULT_FIXTURES.map((f, i) => <option key={f.scenario} value={i}>{f.label}</option>)}
        </select></label>
        <label>状态 <select value={choice} onChange={(e) => setChoice(e.target.value as StatusChoice)}>
          {(Object.keys(STATUS_LABELS) as StatusChoice[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
        </select></label>
        <label>查看者 <select value={viewer} onChange={(e) => setViewer(e.target.value as Slot)}><option value="A">A</option><option value="B">B</option></select></label>
        <label>轮次 <select value={round} onChange={(e) => setRound(Number(e.target.value) as RoundIndex)}><option value={1}>1</option><option value={3}>3</option></select></label>
        <label>宽度 <select value={width} onChange={(e) => setWidth(Number(e.target.value))}><option value={390}>390</option><option value={320}>320</option><option value={1040}>1040</option></select></label>
        <label><input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} /> 首次揭晓（取消 = 刷新后直接完成态）</label>
        <label><input type="checkbox" checked={continued[partnerKey]} onChange={(e) => setContinued((c) => ({ ...c, [partnerKey]: e.target.checked }))} /> 对方已继续</label>
        <button type="button" onClick={() => { setContinued({ a: false, b: false }); setReplay((n) => n + 1); }}>重播</button>
      </aside>
    </div>
  );
}
