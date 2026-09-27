import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatePair, EvaluationError } from "../../supabase/functions/_shared/ai/evaluate-pair.ts";
import { createOpenAIProvider } from "../../supabase/functions/_shared/ai/openai-provider.ts";
import { EVIDENCE_MAX, INTERPRETATION_MAX, LIST_ITEM_MAX, ModelComparisonSchema } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import type { ModelComparison } from "../../supabase/functions/_shared/contracts/evaluation.ts";

const input = {
  prompt: "What would you preserve?",
  answers: { a: "Apple  pie keeps a family tradition alive.", b: "Zebra soup starts a new tradition." },
};
const dimensions = ["imagery", "association", "orientation"] as const;
const sides = ["leftEvidence", "rightEvidence"] as const;
function valid(): ModelComparison {
  const dimension = () => ({ similarity: 2 as const, leftEvidence: ["Apple  pie"], rightEvidence: ["Zebra soup"], explanation: "Both describe food traditions." });
  return {
    status: "ok", summary: "Preserving a tradition contrasts with starting one.",
    commonality: [], divergence: [], unknowns: [],
    dimensions: { imagery: dimension(), association: dimension(), orientation: dimension() },
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

test("validation rejects missing, extra and incorrectly typed fields at every object level", async () => {
  for (const raw of [null, [], "{}", 42]) await rejected(raw);
  const baseline = valid();
  for (const key of Object.keys(baseline)) {
    const raw: Record<string, unknown> = structuredClone(baseline);
    delete raw[key];
    await rejected(raw);
  }
  await rejected({ ...baseline, distance: 0 });
  await rejected({ ...baseline, dimensions: { ...baseline.dimensions, prediction: {} } });
  for (const name of dimensions) {
    for (const key of Object.keys(baseline.dimensions[name])) {
      const field: Record<string, unknown> = { ...baseline.dimensions[name] };
      delete field[key];
      await rejected({ ...baseline, dimensions: { ...baseline.dimensions, [name]: field } });
    }
    await rejected({ ...baseline, dimensions: { ...baseline.dimensions, [name]: { ...baseline.dimensions[name], confidence: 1 } } });
    for (const similarity of [-1, 5, 1.5, "4", false, NaN, Infinity]) {
      await rejected({ ...baseline, dimensions: { ...baseline.dimensions, [name]: { ...baseline.dimensions[name], similarity } } });
    }
  }
  for (const [key, value] of [["summary", 1], ["commonality", "same"], ["divergence", [null]], ["unknowns", {}], ["status", "failed"]]) {
    await rejected({ ...baseline, [String(key)]: value });
  }
});

test("text boundaries count Unicode code points and reject excess without truncation", async () => {
  const boundary = valid();
  boundary.summary = "🧩".repeat(INTERPRETATION_MAX);
  for (const name of dimensions) {
    boundary.dimensions[name].explanation = "🧩".repeat(INTERPRETATION_MAX);
    for (const side of sides) boundary.dimensions[name][side] = ["🧩".repeat(EVIDENCE_MAX), "🧩"];
  }
  for (const field of ["commonality", "divergence", "unknowns"] as const) boundary[field] = ["🧩".repeat(LIST_ITEM_MAX), "🧩"];
  const accepted = await evaluatePair({ ...input, answers: { a: "🧩".repeat(EVIDENCE_MAX), b: "🧩".repeat(EVIDENCE_MAX) } }, {
    modelId: "validation-test", async compare() { return boundary; },
  });
  assert.equal(accepted.summary, boundary.summary);
  const excessive = structuredClone(boundary);
  excessive.summary += "x";
  await rejected(excessive);
  for (const name of dimensions) {
    const raw = valid();
    raw.dimensions[name].explanation = "🧩".repeat(INTERPRETATION_MAX + 1);
    await rejected(raw);
    for (const side of sides) {
      for (const quotes of [[], [""], [" \n\t"], ["x".repeat(EVIDENCE_MAX + 1)], ["x", "x", "x"]]) {
        const raw = valid();
        raw.dimensions[name][side] = quotes;
        await rejected(raw);
      }
    }
  }
  for (const field of ["commonality", "divergence", "unknowns"] as const) {
    for (const items of [["🧩".repeat(LIST_ITEM_MAX + 1)], ["one", "two", "three"]]) {
      const raw = valid();
      raw[field] = items;
      await rejected(raw);
    }
  }
});

test("every dimension and side rejects invented, altered, noncontiguous or swapped quotes", async () => {
  for (const name of dimensions) {
    for (const side of sides) {
      const wrong = side === "leftEvidence" ? "Zebra soup" : "Apple  pie";
      for (const quote of ["fabricated", wrong, "Apple pie", "apple  pie", "Apple…tradition", "Zebra\u00a0soup"]) {
        const raw = valid();
        raw.dimensions[name][side] = [quote];
        await rejected(raw, "INVALID_EVIDENCE");
      }
      const raw = valid();
      raw.dimensions[name][side].push("fabricated second quote");
      await rejected(raw, "INVALID_EVIDENCE");
    }
  }
});

test("insufficient requires all null dimensions and still validates supplied evidence", async () => {
  const unknown = valid();
  for (const name of dimensions) {
    unknown.dimensions[name] = { similarity: null, leftEvidence: [], rightEvidence: [], explanation: "No evidence." };
  }
  await rejected(unknown);
  unknown.status = "insufficient";
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return unknown; } });
  assert.equal(result.status, "insufficient");
  assert.equal(result.distance, null);
  await rejected({ ...valid(), status: "insufficient" });
  unknown.dimensions.orientation.leftEvidence = ["fabricated"];
  await rejected(unknown, "INVALID_EVIDENCE");
});

test("valid exact excerpts survive mapping and shared text can belong to both answers", async () => {
  const raw = valid();
  for (const name of dimensions) {
    raw.dimensions[name].leftEvidence = ["tradition"];
    raw.dimensions[name].rightEvidence = ["tradition"];
  }
  assert.ok(ModelComparisonSchema.safeParse(raw).success);
  const result = await evaluatePair(input, { modelId: "validation-test", async compare() { return raw; } });
  for (const name of dimensions) {
    assert.deepEqual(result.dimensions[name].aEvidence, ["tradition"]);
    assert.deepEqual(result.dimensions[name].bEvidence, ["tradition"]);
  }
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

test("interpretation fields must be English; only evidence may quote another language", async () => {
  const mixed = (patch: (raw: ModelComparison) => void) => { const raw = valid(); patch(raw); return raw; };
  await rejected(mixed((raw) => { raw.summary = "One keeps a tradition; the other 开始 a new one."; }));
  await rejected(mixed((raw) => { raw.dimensions.association.explanation = "Both describe 传统 food."; }));
  for (const field of ["commonality", "divergence", "unknowns"] as const) {
    await rejected(mixed((raw) => { raw[field] = ["Whether the soup is 真的 new."]; }));
  }
  const accepted = await evaluatePair({ ...input, answers: { a: input.answers.a, b: "斑马汤开启新传统。" } }, {
    modelId: "validation-test",
    async compare() {
      return mixed((raw) => {
        raw.summary = "Keeping a café-style tradition contrasts with starting one 🍲.";
        for (const name of dimensions) raw.dimensions[name].rightEvidence = ["斑马汤"];
      });
    },
  });
  assert.equal(accepted.dimensions.imagery.bEvidence[0], "斑马汤");
});
