import assert from "node:assert/strict";
import { test } from "node:test";
import { CURATED_PROMPTS } from "../../supabase/functions/_shared/content/prompts.ts";
import { generatePromptCandidates } from "../../supabase/functions/_shared/ai/generate-prompts.ts";

test("curated bank has 39 unique versioned UUID questions within limits", () => {
  assert.equal(CURATED_PROMPTS.length, 39);
  assert.equal(new Set(CURATED_PROMPTS.map((p) => p.id)).size, 39);
  assert.equal(new Set(CURATED_PROMPTS.map((p) => p.text)).size, 39);
  for (const prompt of CURATED_PROMPTS) {
    assert.match(prompt.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok([...prompt.text].length > 0 && [...prompt.text].length <= 180);
    assert.equal(prompt.source, "curated");
    assert.equal(prompt.version, "curated-v2");
  }
});

test("request contains only instructions, curated text and cancellation signal", async () => {
  const result = await generatePromptCandidates(async (request) => {
    assert.deepEqual(Object.keys(request).sort(), ["curatedQuestions", "instructions", "signal"]);
    assert.deepEqual(request.curatedQuestions, CURATED_PROMPTS.map((p) => p.text));
    return { questions: [{ text: "如果云有口袋，里面会放什么？" }, { text: "一座桥做梦时会梦到什么？" }] };
  });
  assert.equal(result.status, "ready");
  assert.equal(result.candidates.length, 2);
  assert.notEqual(result.candidates[0].id, result.candidates[1].id);
});

test("normalizes text and removes duplicate candidates and bank repeats", async () => {
  const duplicate = await generatePromptCandidates(async () => ({
    questions: [{ text: "  Ａ cloud? " }, { text: "A cloud?" }],
  }));
  assert.deepEqual(duplicate.candidates.map((p) => p.text), ["A cloud?"]);
  const existing = await generatePromptCandidates(async () => ({
    questions: [{ text: ` ${CURATED_PROMPTS[0].text} ` }],
  }));
  assert.equal(existing.status, "empty");
});

test("rejects malformed output and accepts an empty candidate list", async () => {
  for (const raw of [null, {}, { questions: [{ text: " " }] },
    { questions: [{ text: "字".repeat(181) }] },
    { questions: [{ text: "题目", extra: true }] },
    { questions: [], extra: true },
    { questions: Array.from({ length: 3 }, () => ({ text: "题目" })) },
  ]) {
    const result = await generatePromptCandidates(async () => raw);
    assert.equal(result.reason, "invalid_output");
    assert.deepEqual(result.candidates, []);
  }
  assert.equal((await generatePromptCandidates(async () => ({ questions: [] }))).status, "empty");
  const unicode = await generatePromptCandidates(async () => ({ questions: [{ text: "🌙".repeat(180) }] }));
  assert.equal(unicode.status, "ready");
});

test("provider failure ends after one attempt without leaking its error", async () => {
  let calls = 0;
  const result = await generatePromptCandidates(async () => {
    calls++;
    throw new Error("private-provider-detail");
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "failed", candidates: [], reason: "provider_error" });
});

test("eight-second deadline returns even when provider ignores cancellation", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | undefined;
  let finish: ((value: unknown) => void) | undefined;
  let calls = 0;
  const pending = generatePromptCandidates(async (request) => {
    calls++;
    signal = request.signal;
    return await new Promise((resolve) => { finish = resolve; });
  });
  t.mock.timers.tick(8_000);
  const result = await pending;
  assert.equal(signal?.aborted, true);
  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "failed", candidates: [], reason: "timeout" });
  finish?.({ questions: [{ text: "迟到的月光住在哪里？" }] });
  await Promise.resolve();
  assert.deepEqual(result.candidates, []);
});
