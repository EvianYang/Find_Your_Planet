import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { GameSnapshot, Prompt, RoundIndex, Slot } from "@contracts/game.ts";

import "../styles/tokens.css";
import "../styles/reveal.css";
import { AnswerCard } from "../components/AnswerCard.tsx";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { errorCopy } from "../components/error-copy.ts";
import { moonLitForRounds, unknownKind } from "../components/planet-geometry.ts";

type Player = GameSnapshot["players"][number];
type ContinuedFlags = GameSnapshot["continued"];
export type RevealedRound = GameSnapshot["revealedRounds"][number];

/** View state for this screen; GameScreen maps the snapshot (evaluationState, evaluationRetriesRemaining) onto it. */
export type RevealStatus =
  | { kind: "analyzing" }
  | { kind: "failed"; retriesLeft: number | null }
  | { kind: "retrying" }
  | { kind: "exhausted" }
  | { kind: "revealed"; round: RevealedRound };

export type RevealScreenProps = {
  roundIndex: RoundIndex;
  prompt: Prompt;
  players: Player[];
  viewerSlot: Slot;
  /** The viewer's own sealed answer before the reveal. The partner's text is never passed in before it. */
  ownAnswer: string | null;
  status: RevealStatus;
  continued: ContinuedFlags;
  /** False when this round was already revealed on this device (refresh, reconnect): render the finished state. */
  animate: boolean;
  onRetry?: () => void;
  /** Retries used up: leave this room on this device only (CONTRACTS: no server-side leave). */
  onLeave?: () => void;
  /** game/continue. When it returns a promise, the button waits for it and shows an error if it fails. */
  onContinue?: () => Promise<unknown> | void;
};

/** answers → summary → planets; see tokens.css for the individual delays. */
export const REVEAL_TOTAL_MS = 1950;
const LAND_DELAY_MS = 860;

const slotKey = (slot: Slot) => (slot === "A" ? "a" : "b");
const otherSlot = (slot: Slot): Slot => (slot === "A" ? "B" : "A");
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.6" fill="none" stroke="#f3c98b" strokeWidth="1.5" />
      <path d="M10 5.6v5.6" stroke="#f3c98b" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.3" r="1.1" fill="#f3c98b" />
    </svg>
  );
}

function FlagIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 14 16" aria-hidden="true" focusable="false">
      <path d="M2 1v14" stroke="#f7f4ee" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.6 1.6 12.5 5 2.6 8.4Z" fill={color} />
    </svg>
  );
}

function GroupIcon({ kind }: { kind: "common" | "different" | "unknown" }) {
  if (kind === "unknown") {
    return (
      <svg viewBox="0 0 22 14" aria-hidden="true" focusable="false">
        <circle cx="11" cy="7" r="5.5" fill="none" stroke="#c5c8d6" strokeWidth="1.4" strokeDasharray="2 2.4" />
      </svg>
    );
  }
  const [a, b, r] = kind === "common" ? [8, 14, 5.5] : [5.5, 16.5, 4.5];
  return (
    <svg viewBox="0 0 22 14" aria-hidden="true" focusable="false">
      <circle cx={a} cy="7" r={r} fill="none" stroke="#91d8f7" strokeWidth="1.4" />
      <circle cx={b} cy="7" r={r} fill="none" stroke="#d1b3fa" strokeWidth="1.4" />
    </svg>
  );
}

function DetailGroup({ title, kind, items, empty }: { title: string; kind: "common" | "different" | "unknown"; items: string[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="rv-group">
      <h3>
        <GroupIcon kind={kind} />
        {title}
      </h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="rv-empty">{empty}</p>
      )}
    </section>
  );
}

/** Keyed by round and phase so each reveal starts from a clean state and stale timers are dropped. */
export function RevealScreen(props: RevealScreenProps) {
  const key = `${props.roundIndex}-${props.status.kind === "revealed" ? "revealed" : "pending"}`;
  return <RevealView key={key} {...props} />;
}

function RevealView({
  roundIndex,
  prompt,
  players,
  viewerSlot,
  ownAnswer,
  status,
  continued,
  animate,
  onRetry,
  onLeave,
  onContinue,
}: RevealScreenProps) {
  const promptId = useId();
  const revealed = status.kind === "revealed" ? status.round : null;
  const reduced = prefersReducedMotion();
  const [playing, setPlaying] = useState(() => revealed !== null && animate && !reduced);
  // Decided once per mount: the soft entrance is only for views that are not about to play the reveal.
  const [softEntrance] = useState(() => !playing);
  const [stagePlays, setStagePlays] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const waitRef = useRef<HTMLParagraphElement>(null);
  const pressedContinue = useRef(false);

  const nickname = (slot: Slot) => players.find((p) => p.slot === slot)?.nickname ?? `Player ${slot}`;
  const names = { A: nickname("A"), B: nickname("B") } as const;
  const partner = otherSlot(viewerSlot);
  const meReady = continued[slotKey(viewerSlot)];
  const partnerReady = continued[slotKey(partner)];

  // If the sky is already scrolled out of view, land the planets immediately instead of asking the reader to scroll back.
  useLayoutEffect(() => {
    if (!playing || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (rect.bottom < 40 || rect.top > window.innerHeight) setStagePlays(false);
  }, []); // measured once when this reveal mounts

  const finish = (moveFocus: boolean) => {
    setPlaying(false);
    if (revealed) setAnnouncement(`Revealed. ${revealed.result.summary}`);
    if (moveFocus) summaryRef.current?.focus();
  };

  useEffect(() => {
    if (!revealed || !animate) return;
    if (!playing) {
      // Reduced motion: no timeline, announce once.
      if (reduced) setAnnouncement(`Revealed. ${revealed.result.summary}`);
      return;
    }
    const timer = window.setTimeout(() => finish(false), REVEAL_TOTAL_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]); // finish only reads refs and the current round

  useEffect(() => {
    if (meReady && pressedContinue.current) waitRef.current?.focus();
  }, [meReady]);

  const continueRound = async () => {
    if (continuing) return;
    pressedContinue.current = true;
    setContinueError(null);
    const pending = onContinue?.();
    if (!pending) return;
    setContinuing(true);
    try {
      await pending;
    } catch (err) {
      setContinueError(errorCopy(err, "continue"));
    } finally {
      setContinuing(false);
    }
  };

  const pairMode = revealed ? "result" : status.kind === "failed" || status.kind === "exhausted" ? "paused" : "analyzing";
  const kind = revealed ? unknownKind(revealed.result) : null;
  const className = [
    "fyp-reveal",
    softEntrance ? "fyp-reveal--enter" : "",
    playing ? "fyp-reveal--play" : "",
    revealed && animate && reduced ? "fyp-reveal--fade" : "",
  ].filter(Boolean).join(" ");

  const answerFor = (slot: Slot) => {
    const isViewer = slot === viewerSlot;
    if (revealed) {
      return <AnswerCard slot={slot} nickname={names[slot]} isViewer={isViewer} state="revealed" answer={revealed.answers[slotKey(slot)]} />;
    }
    return isViewer ? (
      <AnswerCard slot={slot} nickname={names[slot]} isViewer state="own-sealed" answer={ownAnswer} />
    ) : (
      <AnswerCard slot={slot} nickname={names[slot]} isViewer={false} state="partner-sealed" />
    );
  };

  return (
    <article className={className} aria-labelledby={promptId} lang="en">
      <div className="rv-stage" ref={stageRef}>
        <PlanetPair
          mode={pairMode}
          result={revealed?.result ?? null}
          nicknames={names}
          sealed={revealed ? undefined : { a: true, b: true }}
          ready={revealed ? continued : undefined}
          play={playing && stagePlays}
          landDelayMs={LAND_DELAY_MS}
          // The moon grows one step when this round is revealed.
          moon={revealed
            ? { lit: moonLitForRounds(roundIndex), from: moonLitForRounds(roundIndex - 1) }
            : { lit: moonLitForRounds(roundIndex - 1) }}
        />
        {playing ? (
          <button className="rv-skip" type="button" onClick={() => finish(true)}>
            Skip animation
          </button>
        ) : null}
      </div>

      <div className="rv-sheet">
        <header className="rv-q">
          <p className="rv-round">Round {roundIndex} of 3</p>
          <h1 className="rv-prompt" id={promptId}>
            {prompt.text}
          </h1>
        </header>

        {status.kind === "analyzing" ? <p className="rv-status">Both answers are in. Comparing how they connect.</p> : null}

        <section className="rv-answers" aria-label="Answers">
          {answerFor("A")}
          <div className="rv-sep" aria-hidden="true">
            <svg viewBox="0 0 14 14">
              <path d="M7 1.5C7.5 5 9 6.5 12.5 7 9 7.5 7.5 9 7 12.5 6.5 9 5 7.5 1.5 7 5 6.5 6.5 5 7 1.5Z" fill="none" stroke="#9aa0b5" strokeWidth="1" />
            </svg>
          </div>
          {answerFor("B")}
        </section>

        {status.kind === "failed" ? (
          <section className="rv-fail" role="alert">
            <h2><WarnIcon />Something went wrong on our side</h2>
            <p>The comparison hit a technical problem. It has nothing to do with your answers, and it isn't a lack of clues. Both answers are saved.</p>
            <button className="rv-btn rv-btn--primary" type="button" onClick={onRetry}>Try again</button>
            <p className="rv-fine">
              {status.retriesLeft === null
                ? "Either of you can retry."
                : `${status.retriesLeft} ${status.retriesLeft === 1 ? "try" : "tries"} left. Either of you can retry.`}
            </p>
          </section>
        ) : null}

        {status.kind === "retrying" ? (
          <section className="rv-fail" role="status">
            <h2><WarnIcon />Trying the comparison again</h2>
            <p>This can take a few seconds. Both answers are still saved.</p>
            <button className="rv-btn rv-btn--primary" type="button" aria-disabled="true" aria-busy="true">
              <span className="rv-spin" aria-hidden="true" />
              Trying again
            </button>
            <p className="rv-fine">No need to tap again.</p>
          </section>
        ) : null}

        {status.kind === "exhausted" ? (
          <section className="rv-fail" role="alert">
            <h2><WarnIcon />We couldn't finish this comparison</h2>
            <p>We tried again and it still didn't work. This is a technical problem, not a lack of clues, and it isn't a distance. This round can't be finished, so the game stops here.</p>
            {onLeave ? <button className="rv-btn rv-btn--secondary" type="button" onClick={onLeave}>Leave this room</button> : null}
            <p className="rv-fine">You can start a new game from the home screen.</p>
          </section>
        ) : null}

        {revealed ? (
          <>
            <section className="rv-interp">
              <h2 className="rv-summary" ref={summaryRef} tabIndex={-1}>
                {revealed.result.summary}
              </h2>
              {kind === null ? (
                <p className="rv-cap rv-cap--late">
                  <span className="rv-num">This round: {revealed.result.distance}</span>
                  <span>0 is closest, 1000 is farthest</span>
                </p>
              ) : kind === "no-clues" ? (
                <p className="rv-cap rv-cap--late">
                  <strong>Not enough to go on this round.</strong>
                  <span>There's no distance for this question. That isn't the same as far apart.</span>
                </p>
              ) : (
                <p className="rv-cap rv-cap--late">
                  <strong>Partly readable, not measurable.</strong>
                  <span>Some of it connects, but not enough to place a distance. That isn't the same as far apart.</span>
                </p>
              )}
            </section>

            <section className="rv-details" aria-label="About this round">
              <h2 className="rv-details-title">About this round</h2>
              <DetailGroup title="In common" kind="common" items={revealed.result.commonality} empty="No clear common ground this round." />
              <DetailGroup title="Different" kind="different" items={revealed.result.divergence} empty="No clear difference this round." />
              <DetailGroup title="Still unknown" kind="unknown" items={revealed.result.unknowns} />
            </section>

            <div className="rv-actions">
              {meReady ? (
                <p className="rv-wait" ref={waitRef} tabIndex={-1} role="status">
                  <FlagIcon color={viewerSlot === "A" ? "#91d8f7" : "#d1b3fa"} />
                  <span>
                    You're ready. Waiting for <b>{names[partner]}</b> to continue.
                  </span>
                </p>
              ) : (
                <>
                  {partnerReady ? (
                    <p className="rv-hint" role="status">
                      <FlagIcon color={partner === "A" ? "#91d8f7" : "#d1b3fa"} />
                      <span>
                        <b>{names[partner]}</b> is ready to continue.
                      </span>
                    </p>
                  ) : null}
                  <button
                    className="rv-btn rv-btn--primary"
                    type="button"
                    aria-busy={continuing || undefined}
                    aria-disabled={continuing || undefined}
                    onClick={() => void continueRound()}
                  >
                    {continuing ? <span className="rv-spin" aria-hidden="true" /> : null}
                    {continuing ? "One moment" : roundIndex === 3 ? "See the full game" : "Next round"}
                  </button>
                  {continueError ? (
                    <p className="rv-error" role="alert">
                      <WarnIcon />
                      <span>{continueError}</span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
      <p className="fyp-sr-only" aria-live="polite">
        {announcement}
      </p>
    </article>
  );
}
