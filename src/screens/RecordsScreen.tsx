import { useId, useRef, useState } from "react";

import type { RankedRecord } from "@contracts/records.ts";

import "../styles/tokens.css";
import "../styles/screens.css";
import { Asteroid } from "../components/Asteroid.tsx";
import { errorCopy } from "../components/error-copy.ts";
import { Button, FieldError } from "../components/ui.tsx";

export type RecordsScreenProps = {
  /** records/list, already ranked by the server (ties share a rank; unknown records have rank null). */
  records: RankedRecord[];
  nextCursor: string | null;
  loading?: boolean;
  loadError?: boolean;
  onLoadMore?: () => Promise<unknown>;
  onRetry?: () => void;
  /** records/delete: only the viewer's own record. */
  onDelete: (recordId: string) => Promise<unknown>;
  onStartGame?: () => void;
  onOpenRecoveryCode?: () => void;
};

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Row note (team decision A): the summary of the first measured round, otherwise the first round. */
export function recordNote(record: RankedRecord): string {
  const rounds = [...record.rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  return (rounds.find((r) => r.distance !== null) ?? rounds[0])?.summary ?? "";
}

/** 1.9: partner, date, distance, note, pagination, delete, empty state and unranked records. */
export function RecordsScreen({ records, nextCursor, loading, loadError, onLoadMore, onRetry, onDelete, onStartGame, onOpenRecoveryCode }: RecordsScreenProps) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);

  const head = (
    <div className="sc-rec-head">
      <h1 className="sc-title" id={`${id}-title`} ref={titleRef} tabIndex={-1}>My encounters</h1>
      {onOpenRecoveryCode ? <button className="sc-link" type="button" onClick={onOpenRecoveryCode}>Recovery code</button> : null}
    </div>
  );

  const remove = async (recordId: string, partner: string) => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete(recordId);
      setConfirming(null);
      setAnnouncement(`Encounter with ${partner} deleted.`);
      titleRef.current?.focus();
    } catch (err) {
      setError(errorCopy(err, "delete"));
    } finally {
      setDeleting(false);
    }
  };

  const more = async () => {
    if (!onLoadMore) return;
    setLoadingMore(true);
    try {
      await onLoadMore();
    } catch (err) {
      setError(errorCopy(err, "records"));
    } finally {
      setLoadingMore(false);
    }
  };

  let body;
  if (loadError) {
    body = (
      <>
        <FieldError id={`${id}-load`}>Couldn't load your encounters. Check your connection and try again.</FieldError>
        {onRetry ? <Button onClick={onRetry} busyLabel={loading ? "Loading" : null}>Try again</Button> : null}
      </>
    );
  } else if (loading && records.length === 0) {
    body = <p className="sc-small" role="status">Loading your encounters.</p>;
  } else if (records.length === 0) {
    body = (
      <div className="sc-empty">
        <svg viewBox="80 40 240 110" aria-hidden="true" focusable="false">
          <g transform="translate(140 90) scale(.8)"><Asteroid slot="A" /></g>
          <g transform="translate(262 100) scale(.8)"><Asteroid slot="B" /></g>
        </svg>
        <h2 className="sc-subtitle">No saved encounters yet</h2>
        <p className="sc-small">Games you choose to save will appear here, closest first.</p>
        {onStartGame ? <Button onClick={onStartGame}>Start a game</Button> : null}
      </div>
    );
  } else {
    body = (
      <>
        <p className="sc-lede">Closest first. Ties share a rank. Games without an overall distance come after, newest first.</p>
        <section className="sc-recs" aria-label="Saved encounters">
          {records.map((record) => {
            const date = dateFormat.format(new Date(record.playedAt));
            const rounds = [...record.rounds].sort((a, b) => a.roundIndex - b.roundIndex);
            return (
              <article className="sc-rec" key={record.id} aria-label={`${record.rank === null ? "Unranked" : `Rank ${record.rank}`}, ${record.partnerNickname}, ${date}`}>
                {record.rank === null ? <span className="sc-rec-rank sc-rec-rank--unranked">Unranked</span> : <span className="sc-rec-rank">#{record.rank}</span>}
                <div className="sc-rec-who"><b>{record.partnerNickname}</b><span>{date}</span></div>
                <div className="sc-rec-meta">
                  {record.overallDistance === null ? <span>No overall distance</span> : <span className="sc-num">Overall {record.overallDistance}</span>}
                  <span>{record.validRounds} of 3 rounds measured</span>
                </div>
                <p className="sc-rec-note">{recordNote(record)}</p>
                <div className="sc-rec-acts">
                  <button className="sc-link" type="button" aria-expanded={open === record.id} onClick={() => setOpen(open === record.id ? null : record.id)}>
                    {open === record.id ? "Hide rounds" : "View rounds"}
                  </button>
                  <button className="sc-link" type="button" onClick={() => setConfirming(record.id)}>Delete</button>
                </div>
                {open === record.id ? (
                  <div className="sc-rec-more">
                    {rounds.map((r) => (
                      <p key={r.roundIndex}>
                        <b>Round {r.roundIndex}</b> · {r.distance === null ? "Not measured" : r.distance}. {r.summary}
                      </p>
                    ))}
                  </div>
                ) : null}
                {confirming === record.id ? (
                  <div className="sc-confirm" role="group" aria-label="Confirm delete">
                    <p>Delete this encounter? It's removed from your list only. {record.partnerNickname}'s saved copy isn't affected.</p>
                    <div className="sc-confirm-row">
                      <Button kind="danger" onClick={() => void remove(record.id, record.partnerNickname)} busyLabel={deleting ? "Deleting" : null}>Delete</Button>
                      <Button kind="secondary" onClick={() => setConfirming(null)} disabled={deleting}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
        {nextCursor && onLoadMore ? (
          <Button kind="secondary" onClick={() => void more()} busyLabel={loadingMore ? "Loading" : null}>Show more</Button>
        ) : (
          <p className="sc-small sc-center">That's all of them.</p>
        )}
      </>
    );
  }

  return (
    <section className="fyp-screen" lang="en" aria-labelledby={`${id}-title`}>
      <div className="sc-sheet sc-sheet--wide">
        {head}
        {body}
        {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
        <p className="fyp-sr-only" aria-live="polite">{announcement}</p>
      </div>
    </section>
  );
}

