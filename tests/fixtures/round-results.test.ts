import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUND_RESULT_FIXTURES, partialRound, insufficientRound, technicalFailureRound } from "../../src/fixtures/round-results.ts";
import { EvaluateResponseSchema } from "../../supabase/functions/_shared/contracts/evaluate.ts";
import { RoundResultSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";

test("all six demo scenarios use the shared response schema", () => {
  assert.deepEqual(ROUND_RESULT_FIXTURES.map((f) => f.scenario), ["close", "medium", "far", "partial", "insufficient", "technical-failure"]);
  for (const f of ROUND_RESULT_FIXTURES) {
    assert.equal(f.isDemo, true);
    assert.match(f.label, /Demo sample/);
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
  assert.deepEqual(distances, [0, 500, 1000, null, null]);
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


test("partial understanding and insufficient evidence are distinct unknowns", () => {
  const data = partialRound.response.data;
  assert.ok(data && data.status === "ready");
  assert.equal(data.result.status, "ok");
  assert.equal(data.result.coverage, 0.25);
  assert.equal(data.result.distance, null);
  assert.equal(data.result.dimensions.imagery.similarity, 4);
  assert.equal(data.result.dimensions.association.similarity, null);
  assert.equal(data.result.dimensions.orientation.similarity, null);
  assert.ok(data.result.commonality.length > 0);
});

test("demo interpretations and explicit demo player names are English", () => {
  for (const fixture of ROUND_RESULT_FIXTURES) {
    assert.deepEqual(fixture.players.map((p) => p.nickname), ["Alex (demo)", "Sam (demo)"]);
    const data = fixture.response.data;
    if (!data || data.status !== "ready") continue;
    const r = data.result;
    const prose = [r.summary, ...r.commonality, ...r.divergence, ...r.unknowns,
      ...Object.values(r.dimensions).map((d) => d.explanation)];
    for (const text of prose) {
      assert.match(text, /[A-Za-z]/);
      assert.doesNotMatch(text, /\p{Script=Han}/u);
    }
  }
});


test("all demo content is English, including labels and errors", () => {
  for (const fixture of ROUND_RESULT_FIXTURES) {
    assert.doesNotMatch(JSON.stringify(fixture), /[\u4e00-\u9fff]/u);
  }
});
