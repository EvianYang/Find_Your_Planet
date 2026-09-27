import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePair, compareUtf8, EvaluationError } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import type { ComparisonProvider } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import { blankProfile, modelOutput, profile } from "./fmp-v2-helpers.ts";
const input = { prompt: "What would your fridge say?", answers: { a: "Zebra soup", b: "Apple pie" } };
// Distinct left/right profiles make slot mapping visible.
const leftProfile = profile(1, [-2, 0, 1, 2], [3, 0, 1, 0]);
const rightProfile = profile(3, [2, 1, -1, 0], [0, 2, 0, 3]);
const output = (left: string, right: string, scored = true) => scored
  ? modelOutput({ imagery: 2, focus: 1 }, leftProfile, rightProfile, { left: [left], right: [right] })
  : modelOutput({ imagery: null, focus: null }, blankProfile(), blankProfile(), { left: [left], right: [right] });
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
  if (first.rubricVersion !== "fmp-v2" || swapped.rubricVersion !== "fmp-v2") assert.fail("expected fmp-v2");
  // "Apple pie" is the canonical left answer, so it always gets the left profile, whichever slot holds it.
  assert.deepEqual(first.aEvidence, [input.answers.a]);
  assert.deepEqual(first.a, rightProfile);
  assert.deepEqual(swapped.aEvidence, [input.answers.b]);
  assert.deepEqual(swapped.a, leftProfile);
  assert.equal("leftEvidence" in first, false);
  assert.equal("leftProfile" in first, false);
});

test("UTF-8 ordering handles prefixes, equal text and UTF-16 counterexample", async () => {
  assert.ok(compareUtf8("a", "aa") < 0);
  assert.equal(compareUtf8("same", "same"), 0);
  assert.ok(compareUtf8("\uE000", "😀") < 0);
  const same = await evaluatePair({ ...input, answers: { a: "Same", b: "Same" } }, provider);
  if (same.rubricVersion !== "fmp-v2") assert.fail("expected fmp-v2");
  assert.deepEqual(same.aEvidence, same.bEvidence);
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
  const unknown = await evaluatePair(input, { ...provider, async compare() { return output("Apple", "Zebra", false); } });
  assert.equal(unknown.distance, null);
  assert.equal(unknown.status, "insufficient");
  let calls = 0;
  await assert.rejects(evaluatePair(input, { ...provider, async compare() { calls++; throw new Error("secret-provider-body"); } }), code("PROVIDER_ERROR"));
  assert.equal(calls, 1);
});

test("40-second timeout aborts and ignores provider late completion", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  let finish: ((result: unknown) => void) | undefined;
  const pending = evaluatePair(input, { ...provider, async compare(request) {
    signal = request.signal;
    return new Promise((resolve) => { finish = resolve; });
  } });
  const rejected = assert.rejects(pending, code("TIMEOUT"));
  await Promise.resolve();
  t.mock.timers.tick(39_999);
  await Promise.resolve();
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signal?.aborted, true);
  finish?.(output("Apple", "Zebra"));
});


test("comparison instructions require English prose while preserving verbatim evidence", async () => {
  const { COMPARISON_PROMPT_VERSION, COMPARISON_SYSTEM_PROMPT } = await import("../../supabase/functions/_shared/ai/prompt.ts");
  assert.equal(COMPARISON_PROMPT_VERSION, "comparison-v8");
  assert.match(COMPARISON_SYSTEM_PROMPT, /summary, commonality, divergence, and unknowns in English/);
  // fmp-v2 scoring: two pair overlaps, then each answer profiled on its own; the server computes the distance.
  assert.match(COMPARISON_SYSTEM_PROMPT, /Profile each answer as if the other did not exist/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Null is "cannot tell", not a middle score/);
  for (const field of ["overlap.imagery", "overlap.focus", "leap", "scope", "basis", "direction", "closure", "openness", "enhancement", "conservation", "transcendence"]) {
    assert.ok(COMPARISON_SYSTEM_PROMPT.includes(field), field);
  }
  assert.match(COMPARISON_SYSTEM_PROMPT, /Do not output a distance/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Let the reading agree with your scores/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /non-English text may appear only inside evidence quotes/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Paraphrase is failure/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /could not be written from the question alone/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /The reasoning move/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Where agency or responsibility sits/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Commonality starts with "You both"/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Never use "you" for just one person/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Never output a type code, function code, or framework name/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /no verdict on the relationship or compatibility/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /under 60 characters, with no second sentence/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /at most 200 Unicode code points/);
  assert.doesNotMatch(COMPARISON_SYSTEM_PROMPT, /\$\{/);
  assert.match(COMPARISON_SYSTEM_PROMPT, /Never translate or paraphrase evidence/);
  assert.doesNotMatch(COMPARISON_SYSTEM_PROMPT, /[\u4e00-\u9fff]/u);
});
