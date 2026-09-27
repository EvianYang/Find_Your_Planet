import type { Slot } from "@contracts/game.ts";

import "../styles/answer-card.css";
import { AsteroidGlyph } from "./Asteroid.tsx";

export type AnswerCardState = "revealed" | "own-sealed" | "partner-sealed" | "partner-waiting";

export type AnswerCardProps = {
  slot: Slot;
  nickname: string;
  isViewer: boolean;
  state: AnswerCardState;
  /** Only the viewer's own text before the reveal; both texts after it. Rendered as plain text. */
  answer?: string | null;
};

function EnvelopeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 20 15" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="18" height="13" rx="2.5" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M1.8 2.4 10 8.6l8.2-6.2" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Attribution comes from the slot glyph, the nickname in the slot colour and a thin rule beside the text. */
export function AnswerCard({ slot, nickname, isViewer, state, answer }: AnswerCardProps) {
  const color = slot === "A" ? "#91d8f7" : "#d1b3fa";
  const pending = state === "partner-sealed" || state === "partner-waiting";
  const label = isViewer ? `${nickname} (you)` : nickname;

  return (
    <article className={`fyp-answer fyp-answer--${slot.toLowerCase()}${pending ? " fyp-answer--pending" : ""}`} aria-label={label}>
      <div className="fyp-answer-head">
        <AsteroidGlyph slot={slot} className="fyp-answer-glyph" />
        <h3 className="fyp-answer-name">{nickname}</h3>
        {isViewer ? <span className="fyp-answer-you">You</span> : null}
      </div>
      {state === "revealed" || state === "own-sealed" ? <p className="fyp-answer-text">{answer ?? ""}</p> : null}
      {state === "own-sealed" ? (
        <p className="fyp-answer-note">
          <EnvelopeIcon color={color} />
          Sealed. Only you can see this for now.
        </p>
      ) : null}
      {state === "partner-sealed" ? (
        <p className="fyp-answer-text">
          <EnvelopeIcon color={color} />
          Sealed. It opens at the reveal.
        </p>
      ) : null}
      {state === "partner-waiting" ? (
        <p className="fyp-answer-text">
          <EnvelopeIcon color="#9aa0b5" />
          Waiting for their answer.
        </p>
      ) : null}
    </article>
  );
}
