import type { ModelComparison } from "../contracts/evaluation.ts";

/** fmp-v1; accepts dimensions already validated by the comparison schema. */
export function calculateRoundDistance(dimensions: ModelComparison["dimensions"]) {
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
