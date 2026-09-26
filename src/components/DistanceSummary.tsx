import type { GameSnapshot } from "@contracts/game.ts";

import "../styles/screens.css";

type Overall = NonNullable<GameSnapshot["overall"]>;

export type DistanceSummaryProps = {
  overall: Overall;
  /** 1-based index of the first round without a distance, if any, to explain what the average leaves out. */
  unmeasuredRound?: number | null;
};

/** 1.8: the overall distance comes from the server (average of at least two measured rounds); the UI only presents it. */
export function DistanceSummary({ overall, unmeasuredRound = null }: DistanceSummaryProps) {
  if (overall.overallDistance === null) {
    return (
      <div className="sc-overall">
        <strong>No overall distance this time</strong>
        <span className="sc-small">
          Only {overall.validRounds} of {overall.totalRounds} rounds could be measured, and at least 2 are needed. That isn't the same as far apart. You
          can still save what you found.
        </span>
      </div>
    );
  }
  return (
    <div className="sc-overall">
      <strong>
        Across {overall.validRounds} of {overall.totalRounds} rounds
      </strong>
      <span className="sc-num">Overall distance: {overall.overallDistance}</span>
      <span className="sc-small">
        0 is closest, 1000 is farthest.
        {overall.validRounds < overall.totalRounds && unmeasuredRound ? ` Round ${unmeasuredRound} had no distance, so it isn't in the average.` : ""}
      </span>
    </div>
  );
}
