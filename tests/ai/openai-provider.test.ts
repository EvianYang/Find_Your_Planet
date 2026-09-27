import { z } from "zod";
import { EVIDENCE_MAX, INTERPRETATION_MAX, LIST_ITEM_MAX, ModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../../supabase/functions/_shared/ai/openai-provider.ts";
const request = { system: "Compare.", user: "{}", jsonSchema: z.toJSONSchema(ModelComparisonSchema), signal: new AbortController().signal };
test("adapter sends strict structure, cancellation and no storage in one request", async () => {
  let calls = 0;
  const provider = createOpenAIProvider({ apiKey: "test-only", model: "gpt-5-mini" }, async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.signal, request.signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.reasoning.effort, "medium");
    assert.equal(body.max_output_tokens, 5000);
    const schema = body.text.format.schema;
    assert.equal(schema.properties.summary.maxLength, INTERPRETATION_MAX);
    for (const key of ["commonality", "divergence", "unknowns"]) {
      assert.equal(schema.properties[key].items.maxLength, LIST_ITEM_MAX);
    }
    for (const key of ["leftEvidence", "rightEvidence"]) {
      assert.equal(schema.properties[key].items.maxLength, EVIDENCE_MAX);
    }
    assert.deepEqual(Object.keys(schema.properties.leftProfile.properties).sort(), ["leap", "thinking", "values"]);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(request.jsonSchema, z.toJSONSchema(ModelComparisonSchema));
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true}' }] }] });
  });
  assert.deepEqual(await provider.compare(request), { ok: true });
  assert.equal(calls, 1);
});
test("HTTP errors, refusal, incomplete output and malformed JSON fail closed", async () => {
  for (const response of [new Response("private", { status: 429 }),
    Response.json({ status: "incomplete", output: [] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "bad" }] }] }),
  ]) {
    const provider = createOpenAIProvider({ apiKey: "test", model: "gpt-5-mini" }, async () => response);
    await assert.rejects(provider.compare(request));
  }
});

test("question generator sends one strict, low-effort request with the rules and no curated questions", async () => {
  const { createOpenAIQuestionGenerator } = await import("../../supabase/functions/_shared/ai/openai-provider.ts");
  const { generatePromptCandidates, GENERATION_INSTRUCTIONS } = await import("../../supabase/functions/_shared/ai/generate-prompts.ts");
  const { CURATED_PROMPTS } = await import("../../supabase/functions/_shared/content/prompts.ts");
  let calls = 0;
  const generator = createOpenAIQuestionGenerator({ apiKey: "test-only", model: "gpt-5.4-mini" }, async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.ok(init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.reasoning.effort, "low");
    assert.equal(body.instructions, GENERATION_INSTRUCTIONS);
    const format = body.text.format;
    assert.equal(format.strict, true);
    assert.equal(format.schema.properties.questions.maxItems, 2);
    assert.equal(format.schema.properties.questions.items.properties.text.maxLength, 180);
    assert.equal(format.schema.additionalProperties, false);
    const sent = JSON.stringify(body);
    for (const prompt of CURATED_PROMPTS) assert.equal(sent.includes(prompt.text), false);
    const questions = { questions: [{ text: "You can rewind one hour of your life, but you lose the memory of the rewind. Would you?" }] };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(questions) }] }] });
  });
  const attempt = await generatePromptCandidates(generator);
  assert.equal(calls, 1);
  assert.equal(attempt.status, "ready");
  assert.equal(attempt.candidates.length, 1);
  assert.equal(attempt.candidates[0].source, "generated");
  assert.equal(attempt.candidates[0].version, "question-generation-v2");
});

test("question generator failures end the attempt as failed without a second request", async () => {
  const { createOpenAIQuestionGenerator } = await import("../../supabase/functions/_shared/ai/openai-provider.ts");
  const { generatePromptCandidates } = await import("../../supabase/functions/_shared/ai/generate-prompts.ts");
  for (const response of [new Response("private", { status: 500 }),
    Response.json({ status: "incomplete", output: [] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] }),
  ]) {
    let calls = 0;
    const attempt = await generatePromptCandidates(createOpenAIQuestionGenerator({ apiKey: "test", model: "test" }, async () => { calls++; return response; }));
    assert.equal(attempt.status, "failed");
    assert.deepEqual(attempt.candidates, []);
    assert.equal(calls, 1);
  }
  assert.throws(() => createOpenAIQuestionGenerator({ apiKey: " ", model: "gpt-5.4-mini" }));
});
