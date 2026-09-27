import assert from "node:assert/strict";
import { test } from "node:test";
import { CURATED_PROMPTS } from "../../supabase/functions/_shared/content/prompts.ts";
import { filterGeneratedPrompts, selectGamePrompts } from "../../supabase/functions/_shared/content/prompt-pool.ts";
import type { Prompt } from "../../supabase/functions/_shared/contracts/game.ts";

const generated = (id: string, text: string): Prompt => ({
  id, text, source: "generated", version: "question-generation-v2",
});

test("filters invalid, duplicate and obviously unusable generated candidates", () => {
  const result = filterGeneratedPrompts([
    generated("new-1", "  Would you rewrite gravity? If so, how?  "),
    generated("new-2", "would you rewrite gravity? if so, how?"),
    generated("new-3", `  ${CURATED_PROMPTS[0].text}  `),
    generated("new-4", "What is your password?"),
    generated("new-5", "This is not a question"),
    generated("new-6", "Which moon do you visit?"),
    { id: "new-7", text: "Where would you go?", source: "curated", version: "v1" },
    null,
  ]);
  assert.deepEqual(result.accepted.map((prompt) => prompt.text), ["Would you rewrite gravity? If so, how?"]);
  assert.deepEqual(result.rejected, [
    { index: 1, reason: "duplicate" },
    { index: 2, reason: "duplicate" },
    { index: 3, reason: "unusable" },
    { index: 4, reason: "unusable" },
    { index: 5, reason: "unusable" },
    { index: 6, reason: "invalid" },
    { index: 7, reason: "invalid" },
  ]);
});

test("draws three curated prompts when no generated question is ready", () => {
  const selected = selectGamePrompts({ generatedCandidates: [], random: () => 0 });
  assert.equal(selected.prompts.length, 3);
  assert.equal(new Set(selected.prompts.map((prompt) => prompt.id)).size, 3);
  assert.ok(selected.prompts.every((prompt) => prompt.source === "curated"));
  assert.equal(selected.reusedExisting, false);
});

test("mixing has no fixed old/new quota and samples without replacement", () => {
  const fresh = [
    generated("generated-a", "You may rewrite one law of time. What changes?"),
    generated("generated-b", "A doorway opens into any era. Where do you step?"),
  ];
  const values = [39 / 41, 39 / 40, 0];
  const withTwoNew = selectGamePrompts({ generatedCandidates: fresh, random: () => values.shift()! });
  assert.deepEqual(withTwoNew.prompts.map((prompt) => prompt.source), ["generated", "generated", "curated"]);
  assert.equal(new Set(withTwoNew.prompts.map((prompt) => prompt.id)).size, 3);

  const withNoNew = selectGamePrompts({ generatedCandidates: fresh, random: () => 0 });
  assert.ok(withNoNew.prompts.every((prompt) => prompt.source === "curated"));
});

test("an existing three-prompt snapshot is reused and ignores late generated results", () => {
  const existing = CURATED_PROMPTS.slice(4, 7);
  let randomCalls = 0;
  const result = selectGamePrompts({
    existingSelection: existing,
    generatedCandidates: [generated("late", "You can visit any century once. Where do you go?")],
    random: () => { randomCalls++; return 0.5; },
  });
  assert.deepEqual(result.prompts, existing);
  assert.equal(result.reusedExisting, true);
  assert.deepEqual(result.acceptedGenerated, []);
  assert.equal(randomCalls, 0);
});

test("rejects invalid randomness, duplicate snapshots and pools smaller than three", () => {
  assert.throws(() => selectGamePrompts({ random: () => 1 }), /Invalid random value/);
  assert.throws(() => selectGamePrompts({ existingSelection: [CURATED_PROMPTS[0], CURATED_PROMPTS[0], CURATED_PROMPTS[1]] }), /unique/);
  assert.throws(() => selectGamePrompts({ curated: CURATED_PROMPTS.slice(0, 2) }), /At least three/);
});
