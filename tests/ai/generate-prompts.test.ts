import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { GENERATION_INSTRUCTIONS, GENERATION_USER_TEMPLATE, GENERATION_DIRECTIONS, selectGenerationDirections } from "../../supabase/functions/_shared/ai/generation-prompt.ts";
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

test("request sends English rules and two directions, never curated text or branding", async () => {
  const result = await generatePromptCandidates(async (request) => {
    assert.deepEqual(Object.keys(request).sort(), ["instructions", "signal", "user"]);
    assert.match(request.instructions, /questions in English/);
    assert.doesNotMatch(request.instructions + request.user, /Find Your Planet|两颗星/);
    for (const p of CURATED_PROMPTS) assert.ok(!(request.instructions + request.user).includes(p.text));
    const lines = request.user.split("\n");
    assert.ok(lines[0].startsWith("Direction 1: "));
    assert.ok(lines[1].startsWith("Direction 2: "));
    assert.notEqual(lines[0].slice(13), lines[1].slice(13));
    assert.match(request.user, /Avoid this overused imagery:/);
    return { questions: [{ text: "Your fridge demands a day off. What deal do you offer?" }, { text: "Your shoes refuse to leave home. What do you tell them?" }] };
  });
  assert.equal(result.status, "ready");
  assert.equal(result.candidates.length, 2);
  assert.notEqual(result.candidates[0].id, result.candidates[1].id);
});

test("normalizes batch duplicates; bank deduplication remains task 3.3", async () => {
  const duplicate = await generatePromptCandidates(async () => ({
    questions: [{ text: "  Ａ cloud? " }, { text: "A cloud?" }],
  }));
  assert.deepEqual(duplicate.candidates.map((p) => p.text), ["A cloud?"]);
  const existing = await generatePromptCandidates(async () => ({
    questions: [{ text: ` ${CURATED_PROMPTS[0].text} ` }],
  }));
  assert.equal(existing.status, "ready");
  assert.equal(existing.candidates[0].version, "question-generation-v2");
});

test("rejects malformed output and accepts an empty candidate list", async () => {
  for (const raw of [null, {}, { questions: [{ text: 123 }] },
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


test("invalid lengths are discarded individually without losing a valid sibling", async () => {
  for (const text of ["   ", "a".repeat(181)]) {
    const result = await generatePromptCandidates(async () => ({ questions: [{ text }, { text: "Your fridge demands a day off. What deal do you offer?" }] }));
    assert.equal(result.status, "ready");
    assert.equal(result.candidates.length, 1);
  }
  const result = await generatePromptCandidates(async () => ({ questions: [{ text: " " }] }));
  assert.equal(result.status, "empty");
});

test("direction selection covers distinct pairs, including at most one unspecified", () => {
  assert.equal(GENERATION_DIRECTIONS.length, 14);
  for (let i = 0; i < 14; i++) {
    for (let j = 0; j < 13; j++) {
      const values = [(i + 0.5) / 14, (j + 0.5) / 13];
      const pair = selectGenerationDirections(() => values.shift()!);
      assert.notEqual(pair[0], pair[1]);
      assert.ok(pair.filter((d) => d.startsWith("Unspecified:")).length <= 1);
    }
  }
});

test("runtime instructions exactly match the reviewed Markdown", () => {
  const md = readFileSync(new URL("../../supabase/functions/_shared/ai/generate-prompts.md", import.meta.url), "utf8");
  const blocks = [...md.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  assert.equal(GENERATION_INSTRUCTIONS, blocks[0]);
  assert.equal(GENERATION_USER_TEMPLATE, blocks[1]);
});
