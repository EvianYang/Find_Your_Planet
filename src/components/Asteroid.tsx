import { useId } from "react";

import type { Slot } from "@contracts/game.ts";

import { ASTEROID_A_PATH, ASTEROID_B_PATH, MOONLET_PATH } from "./planet-geometry.ts";

const RING_BACK = "M-45 3A45 11 0 0 1 45 3";
const RING_FRONT = "M-45 3A45 11 0 0 0 45 3";

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Flat two-tone asteroid with hatching on the shadow side and a slightly wobbly ink outline.
 * A carries a tilted ring; B carries a small moonlet. Drawn around (0, 0) with a nominal radius of 26.
 */
export function Asteroid({ slot, moonletClassName }: { slot: Slot; moonletClassName?: string }) {
  const id = useSvgId(`fyp-ast-${slot}-`);
  const clip = `${id}-clip`;
  const hatch = `${id}-hatch`;
  const ink = `${id}-ink`;
  const isA = slot === "A";
  const path = isA ? ASTEROID_A_PATH : ASTEROID_B_PATH;

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
        <pattern id={hatch} width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${isA ? 40 : -40})`}>
          <line x1="0" y1="0" x2="0" y2="3.4" stroke={isA ? "#2c6a8d" : "#6a4ca6"} strokeWidth="0.9" strokeOpacity="0.75" />
        </pattern>
        <filter id={ink} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale="1.3" />
        </filter>
      </defs>
      {isA ? <path d={RING_BACK} transform="rotate(-14)" fill="none" stroke="#4f97be" strokeWidth="3.2" strokeLinecap="round" /> : null}
      <path d={path} fill={isA ? "#4f97be" : "#8f6fcb"} />
      <path d={path} fill={`url(#${hatch})`} />
      <g clipPath={`url(#${clip})`}>
        <circle cx="-9" cy={isA ? -10 : -11} r={isA ? 28 : 29} fill={isA ? "#91d8f7" : "#d1b3fa"} />
        {isA ? (
          <>
            <ellipse cx="7" cy="7" rx="5" ry="3.6" fill="#6fb9dd" />
            <ellipse cx="-9" cy="1" rx="3" ry="2.2" fill="#6fb9dd" />
            <ellipse cx="12" cy="-9" rx="2.4" ry="1.8" fill="#6fb9dd" />
          </>
        ) : (
          <>
            <ellipse cx="-6" cy="5" rx="5.5" ry="4" fill="#b394ea" />
            <ellipse cx="9" cy="-8" rx="3.4" ry="2.5" fill="#b394ea" />
          </>
        )}
      </g>
      <path d={path} fill="none" stroke="#f7f4ee" strokeOpacity="0.6" strokeWidth="1.15" filter={`url(#${ink})`} />
      <path
        d={isA ? "M-17 -11Q-13 -19 -4 -21.5" : "M-18 -9Q-15 -18 -6 -22"}
        fill="none"
        stroke={isA ? "#e4f7fe" : "#f4ecff"}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {isA ? (
        <>
          <path d={RING_FRONT} transform="rotate(-14)" fill="none" stroke="#cfeffc" strokeWidth="3.2" strokeLinecap="round" />
          <path d={RING_FRONT} transform="rotate(-14)" fill="none" stroke="#f7f4ee" strokeOpacity="0.5" strokeWidth="0.8" filter={`url(#${ink})`} />
        </>
      ) : (
        <g className={moonletClassName}>
          <g transform="translate(27 -20)">
            <path d={MOONLET_PATH} fill="#9e82d8" />
            <path d={MOONLET_PATH} fill="#e9ddfd" transform="translate(-1.4 -1.6) scale(.82)" />
            <path d={MOONLET_PATH} fill="none" stroke="#f7f4ee" strokeOpacity="0.5" strokeWidth="0.8" />
          </g>
        </g>
      )}
    </g>
  );
}

/** Small identity mark used next to nicknames. Decorative: the nickname carries the meaning. */
export function AsteroidGlyph({ slot, className }: { slot: Slot; className?: string }) {
  return (
    <svg className={className} viewBox="-50 -42 100 84" aria-hidden="true" focusable="false">
      <Asteroid slot={slot} />
    </svg>
  );
}
