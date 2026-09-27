import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFmpV2, calculateRoundDistance } from "../../supabase/functions/_shared/ai/distance.ts";
import { evaluatePair } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import type { AnswerProfile } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import { blankProfile, modelOutput, profile } from "./fmp-v2-helpers.ts";

// ---------------------------------------------------------------------------
// fmp-v1: still used to validate results stored before fmp-v2.
// ---------------------------------------------------------------------------
type Similarity = 0 | 1 | 2 | 3 | 4 | null;
type Scores = readonly [Similarity, Similarity, Similarity];
const v1 = (scores: Scores) => ({
  imagery: { similarity: scores[0] }, association: { similarity: scores[1] }, orientation: { similarity: scores[2] },
});

test("fmp-v1 hand-calculated cases cover every known-dimension combination and rounding", () => {
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
    assert.deepEqual(calculateRoundDistance(v1(scores)), { coverage, distance }, JSON.stringify(scores));
  }
});

// ---------------------------------------------------------------------------
// fmp-v2
// ---------------------------------------------------------------------------
const fullOverlap = { imagery: 4, focus: 4 } as const;
const socialMedia = profile(1, [-1, 1, -1, -1], [0, 0, 1, 2]);
const plasticBags = profile(1, [-2, -1, -1, -1], [0, 0, 0, 3]);

test("fmp-v2 reproduces the prompt's worked example", () => {
  // Association: 0.1 x (0.75 + 0.25 + 0); thinking: 0.0875 x (0.25 + 0.5); values: 0.0875 x (1/3 + 1/3).
  assert.deepEqual(calculateFmpV2({ imagery: 1, focus: 3 }, socialMedia, plasticBags), { coverage: 1, distance: 224 });
});

test("fmp-v2 endpoints: identical minds are 0, opposite minds are 1000", () => {
  const one = profile(2, [-2, -2, -2, -2], [3, 3, 0, 0]);
  assert.deepEqual(calculateFmpV2(fullOverlap, one, one), { coverage: 1, distance: 0 });
  const opposite = profile(0, [2, 2, 2, 2], [0, 0, 3, 3]);
  assert.deepEqual(calculateFmpV2({ imagery: 0, focus: 0 }, profile(4, [-2, -2, -2, -2], [3, 3, 0, 0]), opposite), { coverage: 1, distance: 1000 });
});

test("fmp-v2 unknown items are left out and coverage below 0.5 has no distance", () => {
  const onlyAssociation = calculateFmpV2({ imagery: 2, focus: 2 }, profile(1, [null, null, null, null], [null, null, null, null]), profile(1, [null, null, null, null], [null, null, null, null]));
  assert.deepEqual(onlyAssociation, { coverage: 0.3, distance: null });
  const twoAxes = calculateFmpV2({ imagery: 2, focus: 2 }, profile(1, [0, 0, null, null], [null, null, null, null]), profile(1, [0, 0, null, null], [null, null, null, null]));
  assert.equal(twoAxes.coverage, 0.475);
  assert.equal(twoAxes.distance, null);
  const threeAxes = calculateFmpV2({ imagery: 2, focus: 2 }, profile(1, [0, 0, 0, null], [null, null, null, null]), profile(1, [0, 0, 0, null], [null, null, null, null]));
  assert.equal(threeAxes.coverage, 0.5625);
  // Only the two overlaps (0.5 each) differ: 0.1 x 0.5 x 2 / 0.5625.
  assert.equal(threeAxes.distance, 178);
  // A signal on only one side cannot be compared.
  const oneSided = calculateFmpV2(fullOverlap, profile(0, [2, 2, 2, 2], [3, 3, 3, 3]), blankProfile());
  assert.equal(oneSided.coverage, 0.2);
  assert.deepEqual(calculateFmpV2({ imagery: null, focus: null }, blankProfile(), blankProfile()), { coverage: 0, distance: null });
});

const axisValues = [-2, -1, 0, 1, 2] as const;
const emphasisValues = [0, 1, 2, 3] as const;
const scoreValues = [0, 1, 2, 3, 4] as const;
function seeded(seed: number) {
  let state = seed;
  return () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
}
function randomProfile(random: () => number): AnswerProfile {
  const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)];
  return profile(pick(scoreValues), [pick(axisValues), pick(axisValues), pick(axisValues), pick(axisValues)],
    [pick(emphasisValues), pick(emphasisValues), pick(emphasisValues), pick(emphasisValues)]);
}

test("fmp-v2 is symmetric, bounded, and moving closer never increases the distance", () => {
  const random = seeded(7);
  for (let i = 0; i < 2000; i++) {
    const a = randomProfile(random);
    const b = randomProfile(random);
    const overlap = { imagery: scoreValues[Math.floor(random() * 5)], focus: scoreValues[Math.floor(random() * 5)] };
    const result = calculateFmpV2(overlap, a, b);
    assert.deepEqual(calculateFmpV2(overlap, b, a), result);
    assert.ok(result.distance !== null && Number.isInteger(result.distance) && result.distance >= 0 && result.distance <= 1000);
    if (overlap.imagery < 4) {
      const closer = calculateFmpV2({ ...overlap, imagery: (overlap.imagery + 1) as 1 | 2 | 3 | 4 }, a, b);
      assert.ok(closer.distance !== null && closer.distance <= result.distance);
    }
    const scope = b.thinking.scope;
    const target = a.thinking.scope;
    if (scope !== null && target !== null && scope !== target) {
      const moved = { ...b, thinking: { ...b.thinking, scope: (scope + Math.sign(target - scope)) as -2 | -1 | 0 | 1 | 2 } };
      const nearer = calculateFmpV2(overlap, a, moved);
      assert.ok(nearer.distance !== null && nearer.distance <= result.distance);
    }
  }
});

test("fmp-v2 spreads distances far more finely than fmp-v1", () => {
  const v1Distances = new Set<number | null>();
  for (const i of scoreValues) for (const j of scoreValues) for (const k of scoreValues) v1Distances.add(calculateRoundDistance(v1([i, j, k])).distance);
  const random = seeded(11);
  const v2Distances = new Set<number | null>();
  for (let i = 0; i < 5000; i++) {
    const overlap = { imagery: scoreValues[Math.floor(random() * 5)], focus: scoreValues[Math.floor(random() * 5)] };
    v2Distances.add(calculateFmpV2(overlap, randomProfile(random), randomProfile(random)).distance);
  }
  assert.ok(v1Distances.size <= 40, `fmp-v1 has ${v1Distances.size} distinct full-coverage distances`);
  assert.ok(v2Distances.size >= 300, `fmp-v2 produced ${v2Distances.size} distinct distances`);
});

test("the validated pipeline stores fmp-v2, maps profiles to slots, and ignores answer length and order", async () => {
  const pairs = [
    { a: "Save it.", b: "Save this." },
    { a: "Save this.", b: "Save it." },
    { a: "Save it. " + "More detail. ".repeat(15), b: "Save this." },
  ];
  for (const answers of pairs) {
    const leftText = answers.a <= answers.b ? answers.a : answers.b;
    const raw = modelOutput({ imagery: 1, focus: 3 }, socialMedia, plasticBags, { left: ["Save"], right: ["Save"] });
    const result = await evaluatePair({ prompt: "What would you do?", answers }, {
      modelId: "distance-test", async compare() { return raw; },
    });
    assert.equal(result.rubricVersion, "fmp-v2");
    assert.equal(result.distance, 224);
    assert.equal(result.coverage, 1);
    if (result.rubricVersion !== "fmp-v2") continue;
    assert.deepEqual(result.a, answers.a === leftText ? socialMedia : plasticBags);
  }
  const unknown = await evaluatePair({ prompt: "What would you do?", answers: { a: "Hm.", b: "Eh." } }, {
    modelId: "distance-test", async compare() { return modelOutput({ imagery: null, focus: null }, blankProfile(), blankProfile(), { left: [], right: [] }); },
  });
  assert.equal(unknown.status, "insufficient");
  assert.equal(unknown.distance, null);
});
