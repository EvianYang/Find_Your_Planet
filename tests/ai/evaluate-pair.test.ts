import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePair, compareUtf8, EvaluationError } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import type { ComparisonProvider } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
const input = { prompt: "What would your fridge say?", answers: { a: "Zebra soup", b: "Apple pie" } };
const output = (left: string, right: string, similarity: 0 | 4 | null = 4) => {
  const dim = { similarity, leftEvidence: [left], rightEvidence: [right], explanation: "Test explanation" };
  return { status: similarity === null ? "insufficient" : "ok", dimensions: { imagery: dim, association: dim, orientation: dim }, summary: "Test summary", commonality: [], divergence: [], unknowns: [] };
};
const provider: ComparisonProvider = { modelId: "test-provider", async compare(request) {
  const data = JSON.parse(request.user);
  return output(data.left, data.right);
} };
const code = (expected: string) => (error: unknown) => error instanceof EvaluationError && error.code === expected;

test("slot exchange preserves model input and distance but remaps evidence", async () => {
  const requests: string[] = [];
  const capture: ComparisonProvider = { ...provider, async compare(request) {
    requests.push(request.user);
    assert.deepEqual(Object.keys(JSON.parse(request.user)).sort(), ["left", "prompt", "right"]);
    assert.equal(request.jsonSchema.type, "object");
    return provider.compare(request);
  } };
  const first = await evaluatePair(input, capture);
  const swapped = await evaluatePair({ ...input, answers: { a: input.answers.b, b: input.answers.a } }, capture);
  assert.equal(requests[0], requests[1]);
  assert.equal(first.distance, swapped.distance);
  assert.deepEqual(first.dimensions.imagery.aEvidence, [input.answers.a]);
  assert.deepEqual(swapped.dimensions.imagery.aEvidence, [input.answers.b]);
  assert.equal("leftEvidence" in first.dimensions.imagery, false);
});

test("UTF-8 ordering handles prefixes, equal text and UTF-16 counterexample", async () => {
  assert.ok(compareUtf8("a", "aa") < 0);
  assert.equal(compareUtf8("same", "same"), 0);
  assert.ok(compareUtf8("\uE000", "😀") < 0);
  const same = await evaluatePair({ ...input, answers: { a: "Same", b: "Same" } }, provider);
  assert.deepEqual(same.dimensions.imagery.aEvidence, same.dimensions.imagery.bEvidence);
});

test("private metadata or blank answers rejected before provider call", async () => {
  let calls = 0;
  const unused = { ...provider, async compare() { calls++; return null; } };
  await assert.rejects(evaluatePair({ ...input, history: [100] }, unused), code("INVALID_INPUT"));
  await assert.rejects(evaluatePair({ ...input, answers: { a: " ", b: "b" } }, unused), code("INVALID_INPUT"));
  assert.equal(calls, 0);
});

test("invalid structure and fabricated/wrong-side quotes are failures, not insufficient", async () => {
  await assert.rejects(evaluatePair(input, { ...provider, async compare() { return {}; } }), code("INVALID_OUTPUT"));
  await assert.rejects(evaluatePair(input, { ...provider, async compare() { return output("invented", "quote"); } }), code("INVALID_EVIDENCE"));
  await assert.rejects(evaluatePair(input, { ...provider, async compare() { return output(input.answers.a, input.answers.b); } }), code("INVALID_EVIDENCE"));
});

test("insufficient stays null; provider errors are sanitized and not retried", async () => {
  const unknown = await evaluatePair(input, { ...provider, async compare() { return output("Apple", "Zebra", null); } });
  assert.equal(unknown.distance, null);
  assert.equal(unknown.status, "insufficient");
  let calls = 0;
  await assert.rejects(evaluatePair(input, { ...provider, async compare() { calls++; throw new Error("secret-provider-body"); } }), code("PROVIDER_ERROR"));
  assert.equal(calls, 1);
});

test("20-second timeout aborts and ignores provider late completion", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  let finish: ((result: unknown) => void) | undefined;
  const pending = evaluatePair(input, { ...provider, async compare(request) {
    signal = request.signal;
    return new Promise((resolve) => { finish = resolve; });
  } });
  const rejected = assert.rejects(pending, code("TIMEOUT"));
  await Promise.resolve();
  t.mock.timers.tick(20_000);
  await rejected;
  assert.equal(signal?.aborted, true);
  finish?.(output("Apple", "Zebra"));
});


test("comparison instructions require English prose while preserving verbatim evidence", async () => {
  const { COMPARISON_PROMPT_VERSION, COMPARISON_SYSTEM_PROMPT } = await import("../../supabase/functions/_shared/ai/prompt.ts");
  assert.equal(COMPARISON_PROMPT_VERSION, "comparison-v2");
  assert.match(COMPARISON_SYSTEM_PROMPT, /summary, explanation, commonality, divergence, and unknowns in English/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Never translate or paraphrase evidence/);
  assert.doesNotMatch(COMPARISON_SYSTEM_PROMPT, /[\u4e00-\u9fff]/u);
});
