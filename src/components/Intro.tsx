import { useEffect, useRef, useState } from "react";

import "../styles/tokens.css";
import "../styles/intro.css";
import { Asteroid } from "./Asteroid.tsx";
import { moonShape } from "./planet-geometry.ts";

const SEEN_KEY = "fyp:intro-seen";
/** When the scene starts leaving on its own, and how long it takes to go (timeline in intro.css). */
const HOLD_MS = 3000;
const LEAVE_MS = 420;
/** The moon waxes through these phases, each fading in over the last (lit areas nest, so earlier ones stay covered). */
const PHASES = [0.08, 0.3, 0.55, 0.8, 1] as const;
const PHASE_START_MS = 400;
const PHASE_STEP_MS = 400;
const MOON = { cx: 200, cy: 62, r: 26 } as const;
/** Where the two asteroids end up, just below the moon. They start far apart at the edges (see intro.css). */
const MEET = { a: { x: 158, y: 198 }, b: { x: 242, y: 206 } } as const;

const STARS = (() => {
  let seed = 424242;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 34 }, (_, index) => ({
    cx: Math.round(rnd() * 400),
    cy: Math.round(rnd() * 250),
    r: Math.round((0.4 + rnd() * 0.8) * 10) / 10,
    o: Math.round((0.15 + rnd() * 0.45) * 100) / 100,
    twinkle: index % 7 === 0,
  }));
})();

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Once per browser session (a refresh keeps sessionStorage, so it never replays mid-game), and never for reduced motion. */
export function shouldPlayIntro(): boolean {
  try {
    return !reducedMotion() && window.sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage can be blocked; the intro may then play again in this session, which is harmless.
  }
}

/**
 * Opening scene, "worlds apart, under one moon": two small asteroids alone at opposite edges of the sky, one moon
 * rising between them and lighting both, then the two drawing together as the moon grows full, before the title.
 * About three seconds; any tap or key skips it. Decorative only: the screen underneath is already rendered and
 * stays in the accessibility tree.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    markIntroSeen();
    if (reducedMotion()) done.current();
  }, []);

  useEffect(() => {
    if (leaving) {
      const timer = window.setTimeout(() => done.current(), LEAVE_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [leaving]);

  const asteroid = (slot: "A" | "B") => {
    const key = slot === "A" ? "a" : "b";
    return (
      <g transform={`translate(${MEET[key].x} ${MEET[key].y})`}>
        <g className={`in-ast in-ast--${key}`}>
          <g className={`in-drift in-drift--${key}`}>
            <g className={`in-float in-float--${key}`}>
              <g transform="scale(0.82)">
                <Asteroid slot={slot} />
              </g>
            </g>
          </g>
        </g>
      </g>
    );
  };

  return (
    <div className={leaving ? "fyp-intro fyp-intro--leaving" : "fyp-intro"} aria-hidden="true" onPointerDown={() => setLeaving(true)}>
      <div className="in-inner">
        <svg className="in-stage" viewBox="0 0 400 260" focusable="false">
          <defs>
            <filter id="fyp-intro-ink" x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={4} />
              <feDisplacementMap in="SourceGraphic" scale="1.6" />
            </filter>
            <radialGradient id="fyp-intro-glow">
              <stop offset="0" stopColor="#f7f4ee" stopOpacity="0.32" />
              <stop offset="0.45" stopColor="#f7f4ee" stopOpacity="0.1" />
              <stop offset="1" stopColor="#f7f4ee" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="fyp-intro-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f7f4ee" stopOpacity="0.24" />
              <stop offset="0.65" stopColor="#f7f4ee" stopOpacity="0.07" />
              <stop offset="1" stopColor="#f7f4ee" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g className="in-stars">
            {STARS.map((star, index) => (
              <circle key={index} className={star.twinkle ? "in-twinkle" : undefined} cx={star.cx} cy={star.cy} r={star.r} fill="#f7f4ee" opacity={star.o} />
            ))}
          </g>

          {/* One moon, two beams: the same light reaches both, however far apart they are. */}
          <g transform={`translate(${MOON.cx} ${MOON.cy})`}>
            {(["a", "b"] as const).map((key) => (
              <g key={key} className="in-beam">
                <g className={`in-ray in-ray--${key}`}>
                  <path d="M-3 24L-17 180H17L3 24Z" fill="url(#fyp-intro-beam)" />
                </g>
              </g>
            ))}
          </g>

          <circle className="in-glow" cx={MOON.cx} cy={MOON.cy} r={MOON.r * 3} fill="url(#fyp-intro-glow)" />
          <g className="in-moon">
            <g filter="url(#fyp-intro-ink)" stroke="#f7f4ee">
              <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill="#f7f4ee" fillOpacity="0.07" strokeOpacity="0.22" strokeWidth="0.8" />
              {PHASES.map((lit, index) => (
                <path
                  key={lit}
                  className="in-phase"
                  style={{ animationDelay: `${PHASE_START_MS + index * PHASE_STEP_MS}ms` }}
                  d={moonShape(lit, MOON.cx, MOON.cy, MOON.r)}
                  fill="#ece8df"
                  strokeOpacity="0.5"
                  strokeWidth="0.9"
                />
              ))}
            </g>
          </g>

          {asteroid("A")}
          {asteroid("B")}
        </svg>

        <div className="in-words">
          <p className="in-caption">Worlds apart, under one moon.</p>
          <div className="in-titles">
            <p className="in-title">Find Your Planet</p>
            <p className="in-slogan">The distance between two stars. The distance between two hearts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
