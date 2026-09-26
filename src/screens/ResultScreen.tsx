import { useEffect, useId, useRef, useState } from "react";

import type { GameSnapshot, Slot } from "@contracts/game.ts";

import "../styles/tokens.css";
import "../styles/screens.css";
import { DistanceSummary } from "../components/DistanceSummary.tsx";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { errorCodeOf, errorCopy } from "../components/error-copy.ts";
import { Button, CheckIcon, FieldError, WaitIcon } from "../components/ui.tsx";

type Player = GameSnapshot["players"][number];
type Overall = NonNullable<GameSnapshot["overall"]>;
type RevealedRound = GameSnapshot["revealedRounds"][number];

export type ResultScreenProps = {
  players: Player[];
  viewerSlot: Slot;
  overall: Overall;
  rounds: RevealedRound[];
  /** Whether this player already saved this game (requested from B so a refresh doesn't offer saving again). */
  alreadySaved?: boolean;
  /** records/save. Each player decides separately. */
  onSave: () => Promise<unknown>;
  onOpenRecords?: () => void;
  onBackToStart?: () => void;
};

type SaveState = "idle" | "saving" | "saved" | "skipped" | "closed";

/** 1.8: overall distance, measured rounds, round-by-round recap, save or not now. */
export function ResultScreen({ players, viewerSlot, overall, rounds, alreadySaved = false, onSave, onOpenRecords, onBackToStart }: ResultScreenProps) {
  const id = useId();
  const [state, setState] = useState<SaveState>(alreadySaved ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const moved = useRef(false);
  const partner: Slot = viewerSlot === "A" ? "B" : "A";
  const nickname = (slot: Slot) => players.find((p) => p.slot === slot)?.nickname ?? `Player ${slot}`;
  const names = { A: nickname("A"), B: nickname("B") };
  const sorted = [...rounds].sort((x, y) => x.roundIndex - y.roundIndex);
  const unmeasured = sorted.find((r) => r.result.distance === null)?.roundIndex ?? null;

  useEffect(() => {
    if (moved.current && (state === "saved" || state === "skipped")) statusRef.current?.focus();
  }, [state]);

  const save = async () => {
    setState("saving");
    setError(null);
    moved.current = true;
    try {
      await onSave();
      setState("saved");
    } catch (err) {
      if (errorCodeOf(err) === "EXPIRED") setState("closed");
      else {
        setState("idle");
        setError(errorCopy(err, "save"));
      }
    }
  };

  const distance = overall.overallDistance;
  return (
    <section className="fyp-screen" lang="en" aria-labelledby={`${id}-title`}>
      <PlanetPair
        mode="result"
        result={{ distance, status: distance === null ? "insufficient" : "ok" }}
        nicknames={names}
        ariaLabel={
          distance === null
            ? "Two asteroids resting, with no overall distance for this game."
            : `${names.A} and ${names.B}, ${distance} apart overall (0 is closest, 1000 is farthest).`
        }
      />
      <div className="sc-sheet sc-sheet--wide">
        <p className="sc-eyebrow">Game complete</p>
        <h1 className="sc-title" id={`${id}-title`}>Your game with {names[partner]}</h1>
        <DistanceSummary overall={overall} unmeasuredRound={unmeasured} />
        <p className="sc-small">The overall distance averages the rounds that could be measured. It describes these answers, not the two of you.</p>

        <section aria-label="Round by round">
          <h2 className="sc-section-title">Round by round</h2>
          <div className="sc-rounds">
            {sorted.map((round) => (
              <div className="sc-rd" key={round.roundIndex}>
                <span className="sc-rd-ix">{round.roundIndex}</span>
                <p className="sc-rd-q">{round.prompt.text}</p>
                <div className="sc-rd-body">
                  {round.result.distance === null ? (
                    <span className="sc-rd-d sc-rd-d--unknown">Not measured</span>
                  ) : (
                    <span className="sc-rd-d">Distance {round.result.distance}</span>
                  )}
                  <p className="sc-rd-s">{round.result.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="sc-stack sc-divider">
          {state === "saved" ? (
            <>
              <p className="sc-status" ref={statusRef} tabIndex={-1} role="status"><CheckIcon /><span>Saved to your encounters.</span></p>
              {onOpenRecords ? <button className="sc-link" type="button" style={{ alignSelf: "center" }} onClick={onOpenRecords}>View my encounters</button> : null}
            </>
          ) : state === "skipped" ? (
            <>
              <p className="sc-status" ref={statusRef} tabIndex={-1} role="status"><WaitIcon /><span>Not saved.</span></p>
              <p className="sc-small sc-center">Changed your mind? You can still save while the room is open.</p>
              <button className="sc-link" type="button" style={{ alignSelf: "center" }} onClick={() => void save()}>Save after all</button>
            </>
          ) : state === "closed" ? (
            <FieldError id={`${id}-closed`}>This room has closed, so this game can't be saved anymore.</FieldError>
          ) : (
            <>
              <p className="sc-small">
                Saving keeps the questions, the distances and these short notes. Your full answers aren't kept. {names[partner]} decides separately.
              </p>
              <Button onClick={() => void save()} busyLabel={state === "saving" ? "Saving" : null}>Save to my encounters</Button>
              <Button kind="secondary" disabled={state === "saving"} onClick={() => { moved.current = true; setState("skipped"); }}>Not now</Button>
              {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
            </>
          )}
        </div>
        {onBackToStart ? <button className="sc-link" type="button" onClick={onBackToStart}>Back to start</button> : null}
      </div>
    </section>
  );
}
