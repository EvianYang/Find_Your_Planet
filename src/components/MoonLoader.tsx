import type { CSSProperties } from "react";

import "../styles/moon-loader.css";
import { moonShape } from "./planet-geometry.ts";

/** One lunar month as a flipbook: new, waxing crescent, first quarter, waxing gibbous, full, then the waning half. */
const FRAMES = [
  { lit: 0, waning: false },
  { lit: 0.2, waning: false },
  { lit: 0.5, waning: false },
  { lit: 0.8, waning: false },
  { lit: 1, waning: false },
  { lit: 0.8, waning: true },
  { lit: 0.5, waning: true },
  { lit: 0.2, waning: true },
] as const;
/** Shown alone, without motion, when reduced motion is requested. */
const STILL_FRAME = 2;

/**
 * Loading indicator: the moon runs through its phases. Colour follows `currentColor`, so it sits on light
 * buttons and dark panels alike. Decorative: pair it with visible or live text that says what is loading.
 */
export function MoonLoader({ size = 16 }: { size?: number }) {
  return (
    <svg className="fyp-moon-loader" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      {FRAMES.map((frame, index) =>
        frame.lit > 0 ? (
          <path
            key={index}
            className={index === STILL_FRAME ? "ml-frame ml-frame--still" : "ml-frame"}
            style={{ "--ml-i": index } as CSSProperties}
            d={moonShape(frame.lit, 12, 12, 9, frame.waning)}
            fill="currentColor"
          />
        ) : null,
      )}
    </svg>
  );
}
