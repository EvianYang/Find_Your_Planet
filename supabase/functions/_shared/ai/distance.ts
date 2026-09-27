import type { DimensionResult } from "../contracts/evaluation.ts";

/** fmp-v2 is the live rubric; the formula lives with its schema so validation and scoring cannot drift. */
export { calculateFmpV2 } from "../contracts/evaluation.ts";

/** fmp-v1, kept for results stored before fmp-v2. Accepts the three similarities. */
export function calculateRoundDistance(dimensions: Record<"imagery" | "association" | "orientation", Pick<DimensionResult, "similarity">>) {
  const weights = { imagery: 0.25, association: 0.5, orientation: 0.25 } as const;
  let coverage = 0;
  let weighted = 0;
  for (const key of ["imagery", "association", "orientation"] as const) {
    const similarity = dimensions[key].similarity;
    if (similarity !== null) {
      coverage += weights[key];
      weighted += weights[key] * similarity / 4;
    }
  }
  return { coverage, distance: coverage < 0.5 ? null : Math.round(1000 * (1 - weighted / coverage)) };
}
