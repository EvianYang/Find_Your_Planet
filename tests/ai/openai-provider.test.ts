import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../../supabase/functions/_shared/ai/openai-provider.ts";
const request = { system: "Compare.", user: "{}", jsonSchema: { type: "object" }, signal: new AbortController().signal };
test("adapter sends strict structure, cancellation and no storage in one request", async () => {
  let calls = 0;
  const provider = createOpenAIProvider({ apiKey: "test-only", model: "gpt-5-mini" }, async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.signal, request.signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
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
