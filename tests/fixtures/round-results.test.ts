import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUND_RESULT_FIXTURES, insufficientRound, technicalFailureRound } from "../../src/fixtures/round-results.ts";
import { EvaluateResponseSchema } from "../../supabase/functions/_shared/contracts/evaluate.ts";
import { RoundResultSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";

test("all five demo scenarios use the shared response schema", () => {
  assert.deepEqual(ROUND_RESULT_FIXTURES.map((f) => f.scenario), ["close", "medium", "far", "insufficient", "technical-failure"]);
  for (const f of ROUND_RESULT_FIXTURES) {
    assert.equal(f.isDemo, true);
    assert.match(f.label, /演示样例/);
    assert.ok(EvaluateResponseSchema.safeParse(f.response).success);
  }
});

test("successful examples use correct scores and evidence belongs to its player", () => {
  const distances: (number | null)[] = [];
  for (const fixture of ROUND_RESULT_FIXTURES) {
    const data = fixture.response.data;
    if (!data || data.status !== "ready") continue;
    const result = RoundResultSchema.parse(data.result);
    distances.push(result.distance);
    assert.equal(result.modelId, "demo-handwritten-not-a-model");
    for (const dim of Object.values(result.dimensions)) {
      for (const quote of dim.aEvidence) assert.ok(fixture.answers.a.includes(quote), `${fixture.scenario}: A evidence`);
      for (const quote of dim.bEvidence) assert.ok(fixture.answers.b.includes(quote), `${fixture.scenario}: B evidence`);
    }
  }
  assert.deepEqual(distances, [0, 500, 1000, null]);
});

test("unknown is successful null distance; failure has no result or invented interpretation", () => {
  const data = insufficientRound.response.data;
  assert.ok(data && data.status === "ready");
  assert.equal(data.result.status, "insufficient");
  assert.equal(data.result.distance, null);
  assert.equal(insufficientRound.response.error, null);
  assert.equal(technicalFailureRound.response.data, null);
  assert.equal(technicalFailureRound.response.error?.retryable, true);
  assert.equal(RoundResultSchema.safeParse(technicalFailureRound.response).success, false);
});
