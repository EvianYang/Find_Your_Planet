import { z } from "zod";
import { ModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
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
    assert.equal(body.reasoning.effort, "low");
    const schema = body.text.format.schema;
    assert.equal(schema.properties.summary.maxLength, 120);
    for (const key of ["commonality", "divergence", "unknowns"]) {
      assert.equal(schema.properties[key].items.maxLength, 100);
    }
    for (const dimension of ["imagery", "association", "orientation"]) {
      const fields = schema.properties.dimensions.properties[dimension].properties;
      assert.equal(fields.explanation.maxLength, 120);
      assert.equal(fields.leftEvidence.items.maxLength, 60);
      assert.equal(fields.rightEvidence.items.maxLength, 60);
    }
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
