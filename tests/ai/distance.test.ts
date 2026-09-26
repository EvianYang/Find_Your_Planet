import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRoundDistance } from "../../supabase/functions/_shared/ai/distance.ts";
import { evaluatePair } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import { ModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import type { ModelComparison, ModelDimension } from "../../supabase/functions/_shared/contracts/evaluation.ts";

type Scores = readonly [ModelDimension["similarity"], ModelDimension["similarity"], ModelDimension["similarity"]];
function comparison(scores: Scores): ModelComparison {
  const dimension = (similarity: ModelDimension["similarity"]): ModelDimension => ({
    similarity, leftEvidence: similarity === null ? [] : ["Save"],
    rightEvidence: similarity === null ? [] : ["Save"], explanation: "A controlled scoring sample.",
  });
  return ModelComparisonSchema.parse({
    status: scores.every((score) => score === null) ? "insufficient" : "ok",
    dimensions: { imagery: dimension(scores[0]), association: dimension(scores[1]), orientation: dimension(scores[2]) },
    summary: "A controlled scoring sample.", commonality: [], divergence: [], unknowns: [],
  });
}

test("hand-calculated cases cover every known-dimension combination and rounding", () => {
  const cases: { scores: Scores; coverage: number; distance: number | null }[] = [
    { scores: [null, null, null], coverage: 0, distance: null },
    { scores: [4, null, null], coverage: 0.25, distance: null },
    { scores: [null, null, 0], coverage: 0.25, distance: null },
    { scores: [null, 3, null], coverage: 0.5, distance: 250 },
    { scores: [4, null, 0], coverage: 0.5, distance: 500 },
    { scores: [4, 1, null], coverage: 0.75, distance: 500 },
    { scores: [null, 1, 3], coverage: 0.75, distance: 583 },
    { scores: [1, 4, 0], coverage: 1, distance: 438 },
    { scores: [4, 4, 4], coverage: 1, distance: 0 },
    { scores: [0, 0, 0], coverage: 1, distance: 1000 },
    { scores: [null, 0, null], coverage: 0.5, distance: 1000 },
    { scores: [null, 4, null], coverage: 0.5, distance: 0 },
    { scores: [4, 4, null], coverage: 0.75, distance: 0 },
  ];
  for (const { scores, coverage, distance } of cases) {
    assert.deepEqual(calculateRoundDistance(comparison(scores).dimensions), { coverage, distance }, JSON.stringify(scores));
  }
});

test("all 216 valid score combinations stay bounded and increasing similarity never increases distance", () => {
  const values = [null, 0, 1, 2, 3, 4] as const;
  for (const imagery of values) for (const association of values) for (const orientation of values) {
    const scores: Scores = [imagery, association, orientation];
    const result = calculateRoundDistance(comparison(scores).dimensions);
    if (result.coverage < 0.5) {
      assert.equal(result.distance, null);
    } else {
      assert.ok(result.distance !== null);
      assert.ok(Number.isInteger(result.distance));
      assert.ok(result.distance >= 0 && result.distance <= 1000);
      for (const index of [0, 1, 2] as const) {
        const score = scores[index];
        if (score === null || score === 4) continue;
        const increased: [ModelDimension["similarity"], ModelDimension["similarity"], ModelDimension["similarity"]] = [...scores];
        increased[index] = (score + 1) as ModelDimension["similarity"];
        const closer = calculateRoundDistance(comparison(increased).dimensions);
        assert.equal(closer.coverage, result.coverage);
        assert.ok(closer.distance !== null && closer.distance <= result.distance);
      }
    }
  }
});

test("the validated comparison pipeline preserves low-coverage unknowns and scored extremes", async () => {
  for (const scores of [[null, null, null], [4, null, null], [0, null, null], [null, 4, null], [null, 0, null]] as const) {
    const raw = comparison(scores);
    const result = await evaluatePair({ prompt: "What would you do?", answers: { a: "Save a recipe.", b: "Save a song." } }, {
      modelId: "distance-test", async compare() { return raw; },
    });
    assert.deepEqual({ coverage: result.coverage, distance: result.distance }, calculateRoundDistance(raw.dimensions));
    assert.equal(result.status, raw.status);
    assert.equal(result.rubricVersion, "fmp-v1");
  }
});

test("answer length and slot order do not change distance for the same assessed dimensions", async () => {
  const raw = comparison([1, 4, 0]);
  const pairs = [
    { a: "Save it.", b: "Save this." },
    { a: "Save this.", b: "Save it." },
    { a: "Save it. " + "More detail. ".repeat(15), b: "Save this." },
  ];
  for (const answers of pairs) {
    const result = await evaluatePair({ prompt: "What would you do?", answers }, {
      modelId: "distance-test", async compare() { return raw; },
    });
    assert.equal(result.distance, 438);
    assert.equal(result.coverage, 1);
  }
});
