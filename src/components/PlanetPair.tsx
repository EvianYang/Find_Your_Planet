import { useId, type CSSProperties } from "react";

import type { RoundResult } from "@contracts/evaluation.ts";
import type { Slot } from "@contracts/game.ts";

import "../styles/planet-pair.css";
import { Asteroid } from "./Asteroid.tsx";
import {
  CANVAS,
  REST_POSITION,
  UNCHARTED_PATH,
  placedPosition,
  unknownKind,
  type PairPosition,
} from "./planet-geometry.ts";

export type PlanetPairMode = "resting" | "analyzing" | "paused" | "result";
type SlotFlags = { a: boolean; b: boolean };

export type PlanetPairProps = {
  mode: PlanetPairMode;
  /** Server result for this round. The component never computes or adjusts a distance. */
  result?: Pick<RoundResult, "distance" | "status"> | null;
  nicknames: Record<Slot, string>;
  /** Envelopes: an answer is sealed. Nothing is shown for a player who has not answered. */
  sealed?: SlotFlags;
  /** Flags: the player chose to continue. */
  ready?: SlotFlags;
  /** Play the landing from the resting pose; false renders the settled state (refresh, skip, reduced motion). */
  play?: boolean;
  landDelayMs?: number;
};

const NONE: SlotFlags = { a: false, b: false };
const r1 = (value: number) => Math.round(value * 10) / 10;
const SIGNAL = (p: PairPosition) =>
  `M${p.a.x} ${p.a.y}Q${CANVAS.centerX} ${Math.min(p.a.y, p.b.y) - 44} ${p.b.x} ${p.b.y}`;
const SIGNAL_REVERSED = (p: PairPosition) =>
  `M${p.b.x} ${p.b.y}Q${CANVAS.centerX} ${Math.min(p.a.y, p.b.y) - 44} ${p.a.x} ${p.a.y}`;

const STARS = (() => {
  let seed = 7654321;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 26 }, (_, i) => ({
    cx: r1(rnd() * 400),
    cy: r1(rnd() * 170),
    r: r1(0.4 + rnd() * 0.75),
    o: i % 6 === 0 ? 0.7 : r1(0.15 + rnd() * 0.32),
    twinkle: i % 6 === 0,
  }));
})();

function label(mode: PlanetPairMode, names: Record<Slot, string>, result?: PlanetPairProps["result"]): string {
  if (mode === "result" && result) {
    return result.distance === null
      ? "Two asteroids resting, not placed on the measuring line: this round has no distance."
      : `${names.A} and ${names.B}, ${result.distance} apart this round (0 is closest, 1000 is farthest).`;
  }
  if (mode === "analyzing") return "Signals passing between the two asteroids while the answers are compared.";
  if (mode === "paused") return "The comparison paused because of a technical problem.";
  return "Two asteroids resting in the night sky.";
}

export function PlanetPair({
  mode,
  result = null,
  nicknames,
  sealed = NONE,
  ready = NONE,
  play = false,
  landDelayMs = 0,
}: PlanetPairProps) {
  const id = `fyp-pp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const isResult = mode === "result" && result !== null;
  const unknown = isResult ? unknownKind(result) : null;
  const target = isResult && result.distance !== null ? placedPosition(result.distance) : REST_POSITION;
  const playing = isResult && play;
  const e1 = target.a.x + CANVAS.radius;
  const e2 = target.b.x - CANVAS.radius;
  const mid = (e1 + e2) / 2;
  const y = CANVAS.measureY;

  const asteroid = (slot: Slot) => {
    const key = slot === "A" ? "a" : "b";
    const from = REST_POSITION[key];
    const to = target[key];
    const vars = { "--x0": from.x, "--y0": from.y, "--x1": r1(to.x), "--y1": r1(to.y) } as CSSProperties;
    const color = slot === "A" ? "#91d8f7" : "#d1b3fa";
    const showEnvelope = sealed[key] || playing;
    return (
      <g className={`pp-x pp-x--${key}`} style={vars}>
        <g className="pp-y">
          <g className={`pp-float pp-float--${key}`}>
            {unknown ? <circle className="pp-ring" r="36" fill="none" stroke={color} strokeOpacity="0.75" strokeWidth="1.2" strokeDasharray="3 5" /> : null}
            <Asteroid slot={slot} moonletClassName="pp-moonlet" />
            {showEnvelope ? (
              <g className={playing ? "pp-env pp-env--opening" : "pp-env"} transform="translate(0 -44)">
                <rect x="-8.5" y="-6" width="17" height="12" rx="2.4" fill="#0b1020" stroke={color} strokeWidth="1.4" />
                <path d="M-7.6 -4.8 0 1 7.6 -4.8" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
              </g>
            ) : null}
            {ready[key] ? (
              <g transform={`translate(${slot === "A" ? 6 : -4} -22)`}>
                <g className="pp-flag">
                  <path d="M0 0V-24" stroke="#f7f4ee" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M.6 -23.4 13 -19 .6 -14.6Z" fill={color} />
                </g>
              </g>
            ) : null}
          </g>
        </g>
      </g>
    );
  };

  return (
    <figure
      className={`fyp-pp fyp-pp--${mode}${playing ? " fyp-pp--play" : ""}`}
      style={{ "--fyp-land-delay": `${landDelayMs}ms` } as CSSProperties}
    >
      <svg viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} role="img" aria-label={label(mode, nicknames, result)}>
        <defs>
          <filter id={`${id}-ink`} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={4} />
            <feDisplacementMap in="SourceGraphic" scale="1.3" />
          </filter>
          <pattern id={`${id}-cross`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <path d="M0 0L5 5M5 0L0 5" stroke="#f7f4ee" strokeWidth="0.5" strokeOpacity="0.28" />
          </pattern>
        </defs>
        <g aria-hidden="true">
          {STARS.map((s, i) => (
            <circle key={i} className={s.twinkle ? "pp-twinkle" : undefined} cx={s.cx} cy={s.cy} r={s.r} fill="#f7f4ee" opacity={s.o} />
          ))}
          <g fill="none" stroke="#f7f4ee">
            <path d="M-30 182Q200 24 430 182" strokeOpacity="0.09" strokeDasharray="1 6" />
            <path d="M-30 150Q200 70 430 150" strokeOpacity="0.05" strokeDasharray="1 7" />
            <g strokeOpacity="0.32" strokeWidth="0.9">
              <path d="M34 34h6M37 31v6" />
              <path d="M312 158h6M315 155v6" />
              <path d="M84 150h5M86.5 147.5v5" />
              <path d="M262 22h5M264.5 19.5v5" />
            </g>
            <path d="M356 21A9.5 9.5 0 1 0 356 40A7 9.5 0 1 1 356 21Z" fill="#f7f4ee" fillOpacity="0.72" strokeOpacity="0.5" strokeWidth="0.8" filter={`url(#${id}-ink)`} />
          </g>
        </g>

        {mode === "analyzing" || mode === "paused" || playing ? (
          <g className={playing ? "pp-signal pp-signal--closing" : "pp-signal"}>
            <path d={SIGNAL(REST_POSITION)} fill="none" stroke="#f7f4ee" strokeOpacity="0.42" strokeWidth="1.3" strokeDasharray="1.5 6" strokeLinecap="round" />
            {mode === "analyzing" ? (
              <>
                <path className="pp-pulse" d={SIGNAL(REST_POSITION)} pathLength={100} fill="none" stroke="#91d8f7" strokeWidth="2.4" strokeLinecap="round" />
                <path className="pp-pulse" d={SIGNAL_REVERSED(REST_POSITION)} pathLength={100} fill="none" stroke="#d1b3fa" strokeWidth="2.4" strokeLinecap="round" />
              </>
            ) : null}
          </g>
        ) : null}

        {isResult && unknown === null ? (
          <>
            <path
              className="pp-bridge"
              d={`M${r1(target.a.x + 12)} ${r1(target.a.y - 30)}Q${CANVAS.centerX} ${r1(target.a.y - 44 - (e2 - e1) * 0.08)} ${r1(target.b.x - 12)} ${r1(target.b.y - 30)}`}
              fill="none"
              stroke="#f7f4ee"
              strokeOpacity="0.38"
              strokeWidth="1.1"
              strokeDasharray="1.2 5"
              strokeLinecap="round"
            />
            <g className="pp-measure" stroke="#f7f4ee" fill="none" strokeLinecap="round" filter={`url(#${id}-ink)`}>
              <path className="pp-measure-half" d={`M${r1(mid)} ${y}L${r1(e1)} ${y}`} pathLength={1} strokeOpacity="0.75" strokeWidth="1.3" />
              <path className="pp-measure-half" d={`M${r1(mid)} ${y}L${r1(e2)} ${y}`} pathLength={1} strokeOpacity="0.75" strokeWidth="1.3" />
              <path className="pp-ticks" d={`M${r1(e1)} ${y - 6}V${y + 6}M${r1(e2)} ${y - 6}V${y + 6}`} strokeOpacity="0.5" strokeWidth="1.2" />
            </g>
          </>
        ) : null}

        {unknown ? (
          <g className="pp-uncharted">
            <path className="pp-uncharted-loop" d={UNCHARTED_PATH} fill={`url(#${id}-cross)`} stroke="#f7f4ee" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 4" filter={`url(#${id}-ink)`} />
            {unknown === "partial" ? (
              <>
                <path className="pp-partial" d="M173 101Q181 96 190 99" pathLength={1} fill="none" stroke="#91d8f7" strokeOpacity="0.95" strokeWidth="2.1" strokeLinecap="round" />
                <path className="pp-partial" d="M227 97Q219 102 210 99" pathLength={1} fill="none" stroke="#d1b3fa" strokeOpacity="0.95" strokeWidth="2.1" strokeLinecap="round" />
              </>
            ) : null}
            <text className="pp-question" x="200" y="93" textAnchor="middle" fontSize="21" fill="#f7f4ee" fillOpacity="0.85">?</text>
          </g>
        ) : null}

        {asteroid("A")}
        {asteroid("B")}
      </svg>
      <div className="pp-legend" aria-hidden="true">
        <span className="pp-legend-a">{nicknames.A}</span>
        <span className="pp-legend-b">{nicknames.B}</span>
      </div>
    </figure>
  );
}
