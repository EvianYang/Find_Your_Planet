import { useEffect, useId, useRef, useState } from "react";

import type { GameSnapshot, Prompt, RoundIndex, Slot } from "@contracts/game.ts";

import "../styles/tokens.css";
import "../styles/screens.css";
import { AnswerCard } from "../components/AnswerCard.tsx";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { clipUnicode, errorCopy, unicodeLength } from "../components/error-copy.ts";
import { Button, FieldError } from "../components/ui.tsx";

type Player = GameSnapshot["players"][number];

export type AnswerScreenProps = {
  roundIndex: RoundIndex;
  prompt: Prompt;
  players: Player[];
  viewerSlot: Slot;
  /** snapshot.ownAnswer: null until this player has submitted. */
  ownAnswer: string | null;
  /** snapshot.submitted for the partner's slot. Only a yes/no: no text, length or typing state. */
  partnerSubmitted: boolean;
  /** game/submit. Resolves once the server has stored the answer. */
  onSubmit: (answer: string) => Promise<unknown>;
};

const ANSWER_MAX = 300;
const slotKey = (slot: Slot) => (slot === "A" ? "a" : "b");

/** 1.3 answering and 1.4 waiting for the partner. Answers can't be edited after sealing; there is no timer. */
export function AnswerScreen({ roundIndex, prompt, players, viewerSlot, ownAnswer, partnerSubmitted, onSubmit }: AnswerScreenProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ field: "answer" | "form"; message: string } | null>(null);
  const [limitNote, setLimitNote] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentRef = useRef(false);
  const partner: Slot = viewerSlot === "A" ? "B" : "A";
  const nickname = (slot: Slot) => players.find((p) => p.slot === slot)?.nickname ?? `Player ${slot}`;
  const names = { A: nickname("A"), B: nickname("B") };
  const count = unicodeLength(draft);

  useEffect(() => {
    if (ownAnswer !== null && sentRef.current) document.getElementById(`${id}-status`)?.focus();
  }, [ownAnswer, id]);

  const submit = async () => {
    if (draft.trim() === "") {
      setError({ field: "answer", message: "Write something before sealing it." });
      inputRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      sentRef.current = true;
      await onSubmit(draft.trim());
    } catch (err) {
      setError({ field: "form", message: errorCopy(err, "submit") });
    } finally {
      setSending(false);
    }
  };

  const sealed = ownAnswer !== null;
  const cards = (["A", "B"] as const).map((slot) => {
    if (slot === viewerSlot) {
      return sealed ? <AnswerCard key={slot} slot={slot} nickname={names[slot]} isViewer state="own-sealed" answer={ownAnswer} /> : null;
    }
    return <AnswerCard key={slot} slot={slot} nickname={names[slot]} isViewer={false} state={partnerSubmitted ? "partner-sealed" : "partner-waiting"} />;
  });

  return (
    <section className="fyp-screen" lang="en" aria-labelledby={`${id}-prompt`}>
      <PlanetPair
        mode="resting"
        nicknames={names}
        sealed={{ [slotKey(viewerSlot)]: sealed, [slotKey(partner)]: partnerSubmitted } as { a: boolean; b: boolean }}
      />
      <div className="sc-sheet">
        <header className="sc-q">
          <p className="sc-round">Round {roundIndex} of 3</p>
          <h1 className="sc-prompt" id={`${id}-prompt`}>{prompt.text}</h1>
        </header>

        {sealed ? (
          <>
            <p className="sc-small" id={`${id}-status`} tabIndex={-1} role="status">
              {partnerSubmitted ? "Both answers are in." : `Your answer is sealed. Waiting for ${names[partner]}'s answer.`}
            </p>
            <div className="sc-answers">{cards}</div>
          </>
        ) : (
          <>
            <div className="sc-field">
              <label htmlFor={`${id}-answer`}>Your answer</label>
              <textarea
                id={`${id}-answer`}
                ref={inputRef}
                rows={5}
                value={draft}
                readOnly={sending}
                aria-invalid={error?.field === "answer" || undefined}
                aria-describedby={error?.field === "answer" ? `${id}-answer-error` : `${id}-help`}
                onChange={(e) => {
                  const value = e.target.value;
                  const over = unicodeLength(value) - ANSWER_MAX;
                  setDraft(clipUnicode(value, ANSWER_MAX));
                  setLimitNote(over > 1 ? "We kept the first 300 characters." : over >= 0 ? "That's the 300-character limit." : "");
                  if (error?.field === "answer") setError(null);
                }}
              />
              <div className="sc-help" id={`${id}-help`}>
                <span>Only you can see this until you've both answered. There's no timer.</span>
                <span className={`sc-count${count >= ANSWER_MAX ? " sc-count--limit" : ""}`}>{count}/{ANSWER_MAX}</span>
              </div>
              <p className="sc-small" role="status">{limitNote}</p>
              {error?.field === "answer" ? <FieldError id={`${id}-answer-error`}>{error.message}</FieldError> : null}
            </div>
            {error?.field === "form" ? <FieldError id={`${id}-form-error`}>{error.message}</FieldError> : null}
            <div className="sc-stack">
              <Button onClick={() => void submit()} busyLabel={sending ? "Sealing" : null}>Seal my answer</Button>
              <p className="sc-small sc-center">Drafts aren't kept if you refresh or leave this page.</p>
            </div>
            <div className="sc-answers">{cards}</div>
          </>
        )}
      </div>
    </section>
  );
}
