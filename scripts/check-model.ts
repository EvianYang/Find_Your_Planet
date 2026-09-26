/** Explicit opt-in live check. Run with Node --env-file, never imported by tests. */
import assert from "node:assert/strict";
import { evaluatePair, EvaluationError } from "../supabase/functions/_shared/ai/evaluate-pair.ts";
import { ModelComparisonSchema } from "../supabase/functions/_shared/contracts/evaluation.ts";
import { createOpenAIProvider } from "../supabase/functions/_shared/ai/openai-provider.ts";

try {
  if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "openai") throw new EvaluationError("INVALID_CONFIGURATION");
  if (process.env.LLM_BASE_URL && process.env.LLM_BASE_URL !== "https://api.openai.com/v1") throw new EvaluationError("INVALID_CONFIGURATION");
  const provider = createOpenAIProvider({ apiKey: process.env.LLM_API_KEY ?? "", model: process.env.LLM_MODEL ?? "" });
  const answers = {
    a: "I would visit my hometown in the future to see whether the old library is still open.",
    b: "I would travel forward to my hometown and check if people still use our library.",
  };
  const compare = provider.compare;
  provider.compare = async (request) => {
    const raw = await compare(request);
    const check = ModelComparisonSchema.safeParse(raw);
    if (!check.success) console.error(JSON.stringify({ validationIssues: check.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }));
    return raw;
  };
  const rows = [];
  for (const swapped of [false, true]) {
    const started = Date.now();
    const pair = swapped ? { a: answers.b, b: answers.a } : answers;
    const result = await evaluatePair({ prompt: "You can travel through time once. Would you go, and to which year?", answers: pair }, provider);
    for (const dim of Object.values(result.dimensions)) {
      for (const quote of dim.aEvidence) assert.ok(pair.a.includes(quote));
      for (const quote of dim.bEvidence) assert.ok(pair.b.includes(quote));
    }
    rows.push({ swapped, elapsedMs: Date.now() - started, status: result.status, distance: result.distance, coverage: result.coverage, evidenceValid: true });
  }
  console.log(JSON.stringify({ model: provider.modelId, checks: rows }));
} catch (error) {
  console.error(JSON.stringify({ status: "failed", code: error instanceof EvaluationError ? error.code : "CHECK_FAILED" }));
  process.exitCode = 1;
}
