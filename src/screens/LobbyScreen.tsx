import { useId, useState } from "react";

import type { GameSnapshot, Slot } from "@contracts/game.ts";

import "../styles/tokens.css";
import "../styles/screens.css";
import { AsteroidGlyph } from "../components/Asteroid.tsx";
import { PlanetPair } from "../components/PlanetPair.tsx";
import { errorCopy } from "../components/error-copy.ts";
import { Button, CheckIcon, FieldError, WaitIcon, useCopy } from "../components/ui.tsx";

type Player = GameSnapshot["players"][number];

export type LobbyScreenProps = {
  /** Needs to come from the snapshot so the host can still see it after a refresh (requested from B). */
  joinCode: string | null;
  players: Player[];
  viewerSlot: Slot;
  /** game/start. Only the host (slot A, who created the room) can start, and only with two players. */
  onStart?: () => Promise<unknown>;
};

/** 1.2: room code, copy invite, both nicknames, waiting and start. */
export function LobbyScreen({ joinCode, players, viewerSlot, onStart }: LobbyScreenProps) {
  const id = useId();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, copy } = useCopy();
  const a = players.find((p) => p.slot === "A");
  const b = players.find((p) => p.slot === "B");
  const isHost = viewerSlot === "A";
  const canStart = isHost && Boolean(a && b);

  const start = async () => {
    if (!onStart) return;
    setStarting(true);
    setError(null);
    try {
      await onStart();
    } catch (err) {
      setError(errorCopy(err, "start"));
    } finally {
      setStarting(false);
    }
  };

  const row = (slot: Slot, player: Player | undefined) =>
    player ? (
      <div className={`sc-player sc-player--${slot.toLowerCase()}`} key={slot}>
        <AsteroidGlyph slot={slot} className="sc-player-glyph" />
        <span className="sc-player-name">{player.nickname}</span>
        {slot === "A" ? <span className="sc-tag">Host</span> : null}
        {slot === viewerSlot ? (
          <span className="sc-you" style={{ ["--sc-slot" as string]: slot === "A" ? "var(--fyp-a)" : "var(--fyp-b)" }}>You</span>
        ) : null}
      </div>
    ) : (
      <div className="sc-player sc-player--empty" key={slot}>
        <span className="sc-empty-slot" aria-hidden="true"><i /></span>
        <span className="sc-player-name">Waiting for someone to join</span>
      </div>
    );

  return (
    <section className="fyp-screen" lang="en" aria-labelledby={`${id}-title`}>
      <PlanetPair mode="resting" nicknames={{ A: a?.nickname ?? "", B: b?.nickname ?? "" }} present={{ a: Boolean(a), b: Boolean(b) }} />
      <div className="sc-sheet">
        <h1 className="sc-eyebrow" id={`${id}-title`}>Room</h1>
        {joinCode ? (
          <>
            <p className="sc-code sc-code--room" aria-label={`Room code: ${joinCode.split("").join(" ")}`}>{joinCode}</p>
            <div className="sc-stack">
              <Button kind="secondary" onClick={() => void copy(`Join me in Find Your Planet. Room code: ${joinCode}`, "Invite copied.")}>
                {message ? "Copy invite again" : "Copy invite"}
              </Button>
              <p className="sc-copied" role="status">{message ? <CheckIcon /> : null}{message}</p>
            </div>
          </>
        ) : (
          <p className="sc-small">The room code isn't available on this screen right now.</p>
        )}
        <p className="sc-small sc-center">Rooms stay open for 24 hours. Each room holds two people.</p>
        <section className="sc-players" aria-label="Players">
          {row("A", a)}
          {row("B", b)}
        </section>
        <div className="sc-stack">
          {isHost ? (
            <>
              <Button onClick={() => void start()} busyLabel={starting ? "Starting" : null} disabled={!canStart} describedBy={canStart ? undefined : `${id}-why`}>
                Start the game
              </Button>
              {!canStart ? <p className="sc-small sc-center" id={`${id}-why`}>You can start once your partner joins.</p> : null}
              {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
            </>
          ) : (
            <p className="sc-status" role="status">
              <WaitIcon />
              <span>Waiting for <b>{a?.nickname ?? "the host"}</b> to start.</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
