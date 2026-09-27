import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePair, EvaluationError } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import { createOpenAIProvider } from "../../supabase/functions/_shared/ai/openai-provider.ts";
import { EVIDENCE_MAX, INTERPRETATION_MAX, LIST_ITEM_MAX, ModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import type { ModelComparison } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import { blankProfile, modelOutput, profile } from "./fmp-v2-helpers.ts";

// "Apple..." sorts before "Zebra...", so answer a is the left answer.
const input = {
  prompt: "What would you preserve?",
  answers: { a: "Apple  pie keeps a family tradition alive.", b: "Zebra soup starts a new tradition." },
};
const sides = ["leftEvidence", "rightEvidence"] as const;
const profiles = ["leftProfile", "rightProfile"] as const;
function valid(): ModelComparison {
  return {
    ...modelOutput({ imagery: 1, focus: 2 }, profile(1, [1, 1, -1, -1], [0, 0, 3, 2]), profile(2, [1, 0, -1, 1], [2, 0, 0, 1]),
      { left: ["Apple  pie"], right: ["Zebra soup"] }),
    summary: "Keeping a tradition versus starting one.",
  };
}
async function rejected(raw: unknown, expected = "INVALID_OUTPUT") {
  let calls = 0;
  await assert.rejects(evaluatePair(input, {
    modelId: "validation-test", async compare() { calls++; return raw; },
  }), (error: unknown) => {
    assert.ok(error instanceof EvaluationError);
    assert.equal(error.code, expected);
    assert.equal(error.message, expected);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 1);
}
const patched = (patch: (raw: ModelComparison) => void) => { const raw = structuredClone(valid()); patch(raw); return raw; };

test("the baseline sample is valid and maps left/right to slots", async () => {
  assert.ok(ModelComparisonSchema.safeParse(valid()).success);
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return valid(); } });
  assert.equal(result.rubricVersion, "fmp-v2");
  if (result.rubricVersion !== "fmp-v2") return;
  assert.deepEqual(result.a, valid().leftProfile);
  assert.deepEqual(result.aEvidence, ["Apple  pie"]);
  assert.deepEqual(result.bEvidence, ["Zebra soup"]);
});

test("validation rejects missing, extra and incorrectly typed fields at every object level", async () => {
  for (const raw of [null, [], "{}", 42]) await rejected(raw);
  const baseline = valid();
  for (const key of Object.keys(baseline)) {
    const raw: Record<string, unknown> = structuredClone(baseline);
    delete raw[key];
    await rejected(raw);
  }
  await rejected({ ...baseline, distance: 0 });
  await rejected({ ...baseline, dimensions: {} });
  await rejected({ ...baseline, overlap: { ...baseline.overlap, orientation: 2 } });
  for (const key of ["imagery", "focus"] as const) {
    for (const bad of [-1, 5, 1.5, "2", false]) await rejected(patched((raw) => { (raw.overlap as Record<string, unknown>)[key] = bad; }));
  }
  for (const side of profiles) {
    await rejected(patched((raw) => { (raw[side] as Record<string, unknown>).confidence = 1; }));
    await rejected(patched((raw) => { (raw[side].thinking as Record<string, unknown>).intuition = 1; }));
    await rejected(patched((raw) => { (raw[side].values as Record<string, unknown>).power = 1; }));
    for (const bad of [-1, 5, 2.5, "1"]) await rejected(patched((raw) => { (raw[side] as Record<string, unknown>).leap = bad; }));
    for (const axis of ["scope", "basis", "direction", "closure"] as const) {
      for (const bad of [-3, 3, 0.5, "0"]) await rejected(patched((raw) => { (raw[side].thinking as Record<string, unknown>)[axis] = bad; }));
    }
    for (const group of ["openness", "enhancement", "conservation", "transcendence"] as const) {
      for (const bad of [-1, 4, 1.5, true]) await rejected(patched((raw) => { (raw[side].values as Record<string, unknown>)[group] = bad; }));
    }
  }
  for (const [key, value] of [["summary", 1], ["commonality", "same"], ["divergence", [null]], ["unknowns", {}], ["status", "failed"]] as const) {
    await rejected({ ...baseline, [key]: value });
  }
});

test("text boundaries count Unicode code points and reject excess without truncation", async () => {
  const boundary = patched((raw) => {
    raw.summary = "🧩".repeat(INTERPRETATION_MAX);
    raw.leftEvidence = ["🧩".repeat(EVIDENCE_MAX), "🧩"];
    raw.rightEvidence = ["🧩".repeat(EVIDENCE_MAX), "🧩"];
    for (const field of ["commonality", "divergence", "unknowns"] as const) raw[field] = ["🧩".repeat(LIST_ITEM_MAX), "🧩"];
  });
  const accepted = await evaluatePair({ ...input, answers: { a: "🧩".repeat(EVIDENCE_MAX), b: "🧩".repeat(EVIDENCE_MAX) } }, {
    modelId: "validation-test", async compare() { return boundary; },
  });
  assert.equal(accepted.summary, boundary.summary);
  await rejected({ ...boundary, summary: boundary.summary + "x" });
  for (const side of sides) {
    for (const quotes of [[], [""], [" \n\t"], ["x".repeat(EVIDENCE_MAX + 1)], ["x", "x", "x"]]) {
      await rejected(patched((raw) => { raw[side] = quotes; }));
    }
  }
  for (const field of ["commonality", "divergence", "unknowns"] as const) {
    for (const items of [["🧩".repeat(LIST_ITEM_MAX + 1)], ["one", "two", "three"]]) {
      await rejected(patched((raw) => { raw[field] = items; }));
    }
  }
});

test("each side rejects invented, altered, noncontiguous or swapped quotes", async () => {
  for (const side of sides) {
    const wrong = side === "leftEvidence" ? "Zebra soup" : "Apple  pie";
    for (const quote of ["fabricated", wrong, "Apple pie", "apple  pie", "Apple…tradition", "Zebra soup"]) {
      await rejected(patched((raw) => { raw[side] = [quote]; }), "INVALID_EVIDENCE");
    }
    await rejected(patched((raw) => { raw[side].push("fabricated second quote"); }), "INVALID_EVIDENCE");
  }
});

test("insufficient means nothing could be scored, and still validates supplied evidence", async () => {
  const unknown = modelOutput({ imagery: null, focus: null }, blankProfile(), blankProfile(), { left: [], right: [] });
  await rejected({ ...unknown, status: "ok" });
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return unknown; } });
  assert.equal(result.status, "insufficient");
  assert.equal(result.distance, null);
  await rejected({ ...valid(), status: "insufficient" });
  await rejected({ ...unknown, leftEvidence: ["fabricated"] }, "INVALID_EVIDENCE");
});

test("partial scores give a low-coverage unknown, not a distance", async () => {
  const thin = modelOutput({ imagery: 1, focus: 1 }, profile(0, [null, null, null, null], [null, null, null, null]),
    profile(0, [null, null, null, null], [null, null, null, null]), { left: ["Apple  pie"], right: ["Zebra soup"] });
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return thin; } });
  assert.equal(result.status, "ok");
  assert.equal(result.coverage, 0.3);
  assert.equal(result.distance, null);
});

test("scored comparisons need evidence from both answers", async () => {
  for (const side of sides) await rejected(patched((raw) => { raw[side] = []; }));
});

test("shared text can belong to both answers", async () => {
  const raw = patched((r) => { r.leftEvidence = ["tradition"]; r.rightEvidence = ["tradition"]; });
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return raw; } });
  if (result.rubricVersion !== "fmp-v2") assert.fail("expected fmp-v2");
  assert.deepEqual(result.aEvidence, ["tradition"]);
  assert.deepEqual(result.bEvidence, ["tradition"]);
});

test("provider transport failures and malformed responses never become insufficient", async () => {
  for (const response of [
    new Response("private response", { status: 500 }),
    new Response("invalid envelope"),
    Response.json({ status: "incomplete", output: [] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] }),
    Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] }),
  ]) {
    let calls = 0;
    const provider = createOpenAIProvider({ apiKey: "test-only", model: "test-only" }, async () => { calls++; return response; });
    await assert.rejects(evaluatePair(input, provider), (error: unknown) => {
      assert.ok(error instanceof EvaluationError);
      assert.equal(error.code, "PROVIDER_ERROR");
      assert.equal(error.message, "PROVIDER_ERROR");
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("reading fields must be English; only evidence may quote another language", async () => {
  await rejected(patched((raw) => { raw.summary = "One keeps a tradition; the other 开始 a new one."; }));
  for (const field of ["commonality", "divergence", "unknowns"] as const) {
    await rejected(patched((raw) => { raw[field] = ["Whether the soup is 真的 new."]; }));
  }
  const accepted = await evaluatePair({ ...input, answers: { a: input.answers.a, b: "斑马汤开启新传统。" } }, {
    modelId: "validation-test",
    async compare() {
      return patched((raw) => {
        raw.summary = "Keeping a café-style tradition versus starting one 🍲.";
        raw.rightEvidence = ["斑马汤"];
      });
    },
  });
  if (accepted.rubricVersion !== "fmp-v2") assert.fail("expected fmp-v2");
  assert.deepEqual(accepted.bEvidence, ["斑马汤"]);
});
