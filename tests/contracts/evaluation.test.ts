import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelComparisonSchema, RoundResultSchema, createModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import { GameRequestSchema, GameSnapshotSchema } from "../../supabase/functions/_shared/contracts/game.ts";
import { EvaluateResponseSchema, ComparisonInputSchema } from "../../supabase/functions/_shared/contracts/evaluate.ts";
import { IdentityRequestSchema } from "../../supabase/functions/_shared/contracts/identity.ts";
import { RecordsRequestSchema, SavedRoundSnapshotSchema } from "../../supabase/functions/_shared/contracts/records.ts";
const id = "91b264f0-6e12-4df4-9b2a-000000000001";
const dimension = { similarity: null, aEvidence: [], bEvidence: [], explanation: "Cannot determine." };
const unknown = {
  status: "insufficient", dimensions: { imagery: dimension, association: dimension, orientation: dimension },
  summary: "Insufficient evidence", commonality: [], divergence: [], unknowns: ["The imaginative path is unclear."],
  coverage: 0, distance: null, rubricVersion: "fmp-v1", modelId: "test-only",
};

test("unknown is null; fabricated distance and prediction fields are rejected", () => {
  assert.ok(RoundResultSchema.safeParse(unknown).success);
  for (const invalid of [{ ...unknown, distance: 1000 }, { ...unknown, distance: 0 },
    { ...unknown, status: "ok" }, { ...unknown, prediction: "guess" },
    { ...unknown, coverage: 0.5 }, { ...unknown, rubricVersion: "v2" }]) {
    assert.equal(RoundResultSchema.safeParse(invalid).success, false);
  }
});

test("coverage boundary and fmp-v1 distance are enforced", () => {
  const scored = { similarity: 3, aEvidence: ["umbrella"], bEvidence: ["cup"], explanation: "A small change" };
  const partial = { ...unknown, status: "ok", dimensions: { ...unknown.dimensions, imagery: scored }, coverage: 0.25 };
  assert.ok(RoundResultSchema.safeParse(partial).success);
  const enough = { ...partial, dimensions: { ...unknown.dimensions, association: scored }, coverage: 0.5, distance: 250 };
  assert.ok(RoundResultSchema.safeParse(enough).success);
  assert.equal(RoundResultSchema.safeParse({ ...enough, distance: null }).success, false);
  assert.equal(RoundResultSchema.safeParse({ ...enough, distance: 249 }).success, false);
  assert.equal(RoundResultSchema.safeParse({ ...enough, dimensions: { ...enough.dimensions, association: { ...scored, bEvidence: [] } } }).success, false);
});

test("exact quotes belong to the correct answer; Unicode limits use code points", () => {
  const d = { similarity: 4, leftEvidence: ["umbrella"], rightEvidence: ["cup"], explanation: "🧩".repeat(120) };
  const model = { status: "ok", dimensions: { imagery: d, association: d, orientation: d }, summary: "Explanation", commonality: [], divergence: [], unknowns: [] };
  assert.ok(createModelComparisonSchema("Move the umbrella", "Move the cup").safeParse(model).success);
  assert.equal(createModelComparisonSchema("Move the cup", "Move the umbrella").safeParse(model).success, false);
  assert.equal(ModelComparisonSchema.safeParse({ ...model, summary: "🧩".repeat(121) }).success, false);
  assert.equal(ModelComparisonSchema.safeParse({ ...model, dimensions: { ...model.dimensions, imagery: { ...d, similarity: 2.5 } } }).success, false);
});

test("public request schemas reject extra/private scoring fields and bad inputs", () => {
  const submit = { action: "submit", roomId: id, requestId: id, roundIndex: 1, answer: " hi " };
  assert.ok(GameRequestSchema.safeParse(submit).success);
  for (const bad of [{ ...submit, answer: " " }, { ...submit, answer: "x".repeat(301) },
    { ...submit, roundIndex: 4 }, { ...submit, distance: 0 }, { ...submit, roomId: "bad" }]) {
    assert.equal(GameRequestSchema.safeParse(bad).success, false);
  }
  assert.equal(ComparisonInputSchema.safeParse({ prompt: "?", answers: { a: "a", b: "b" }, nickname: "x" }).success, false);
  assert.equal(IdentityRequestSchema.safeParse({ action: "create", nickname: " ", requestId: id }).success, false);
  assert.equal(RecordsRequestSchema.safeParse({ action: "save", roomId: id, requestId: id, owner_profile_id: id }).success, false);
});

test("technical failure uses error envelope, not an insufficient comparison", () => {
  const failure = { data: null, error: { code: "EVALUATION_FAILED", message: "Please try again", retryable: true }, requestId: id };
  assert.ok(EvaluateResponseSchema.safeParse(failure).success);
  assert.equal(RoundResultSchema.safeParse(failure).success, false);
  assert.ok(EvaluateResponseSchema.safeParse({ data: { status: "ready", result: unknown }, error: null, requestId: id }).success);
});

test("shared snapshot embeds final result; collection whitelist rejects evidence", () => {
  const prompt = { id, text: "What happens?", source: "curated", version: "v1" };
  const snapshot = {
    roomId: id, viewerSlot: "A", joinCode: "ABCDEFGH", phase: "reveal", currentRound: 1, revision: 1, expiresAt: "2026-09-27T00:00:00Z",
    players: [{ slot: "A", nickname: "a" }, { slot: "B", nickname: "b" }], currentPrompt: prompt,
    ownAnswer: "a", submitted: { a: true, b: true }, continued: { a: false, b: false },
    evaluationState: "ready", evaluationRetriesRemaining: 2, overall: null,
    revealedRounds: [{ roundIndex: 1, prompt, answers: { a: "a", b: "b" }, result: unknown }],
  };
  assert.ok(GameSnapshotSchema.safeParse(snapshot).success);
  const invalidSnapshot = { ...snapshot, revealedRounds: [{ ...snapshot.revealedRounds[0], result: { ...unknown, distance: 1000 } }] };
  assert.equal(GameSnapshotSchema.safeParse(invalidSnapshot).success, false);
  const saved = { roundIndex: 1, prompt, distance: null, coverage: 0, summary: "Insufficient evidence", commonality: [], divergence: [], unknowns: [], rubricVersion: "fmp-v1", modelId: "test-only" };
  assert.ok(SavedRoundSnapshotSchema.safeParse(saved).success);
  assert.equal(SavedRoundSnapshotSchema.safeParse({ ...saved, evidence: ["private"] }).success, false);
});
