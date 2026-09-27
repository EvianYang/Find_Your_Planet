/** Explicit live check with synthetic answers; normal tests never call the API. */
import { ModelComparisonSchema } from "../supabase/functions/_shared/contracts/evaluation.ts";
import { evaluatePair, EvaluationError } from "../supabase/functions/_shared/ai/evaluate-pair.ts";
import { createOpenAIProvider } from "../supabase/functions/_shared/ai/openai-provider.ts";
import { COMPARISON_PROMPT_VERSION } from "../supabase/functions/_shared/ai/prompt.ts";
import { EXPLANATION_CASES } from "../tests/ai/explanation-cases.ts";

if ((process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "openai") ||
    (process.env.LLM_BASE_URL && process.env.LLM_BASE_URL !== "https://api.openai.com/v1")) {
  throw new Error("Unsupported provider configuration");
}
const provider = createOpenAIProvider({ apiKey: process.env.LLM_API_KEY ?? "", model: process.env.LLM_MODEL ?? "" });
const compare = provider.compare;
provider.compare = async (request) => {
  const raw = await compare(request);
  const parsed = ModelComparisonSchema.safeParse(raw);
  if (!parsed.success) console.log(JSON.stringify({ validationIssues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }));
  return raw;
};
for (const item of EXPLANATION_CASES) {
  const start = Date.now();
  try {
    const result = await evaluatePair(item.input, provider);
    console.log(JSON.stringify({ id: item.id, promptVersion: COMPARISON_PROMPT_VERSION, elapsedMs: Date.now() - start, result }));
  } catch (error) {
    console.log(JSON.stringify({ id: item.id, elapsedMs: Date.now() - start, code: error instanceof EvaluationError ? error.code : "CHECK_FAILED" }));
    process.exitCode = 1;
  }
}
