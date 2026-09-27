import { z } from "zod";
import { ComparisonInputSchema } from "../contracts/evaluate.ts";
import { ModelComparisonSchema, RoundResultSchema, createModelComparisonSchema } from "../contracts/evaluation.ts";
import type { ModelDimension, RoundResult } from "../contracts/evaluation.ts";
import { calculateRoundDistance } from "./distance.ts";
import { COMPARISON_SYSTEM_PROMPT } from "./prompt.ts";

export const EVALUATION_TIMEOUT_MS = 20_000;
export type EvaluationErrorCode = "INVALID_INPUT" | "INVALID_CONFIGURATION" | "TIMEOUT" | "PROVIDER_ERROR" | "INVALID_OUTPUT" | "INVALID_EVIDENCE";
export class EvaluationError extends Error {
  readonly code: EvaluationErrorCode;
  constructor(code: EvaluationErrorCode) {
    super(code); // Never expose provider payloads, answers or credentials in errors.
    this.name = "EvaluationError";
    this.code = code;
  }
}

/** Adapter must send the schema to the provider, disable SDK retries, honor signal,
 * and return decoded JSON. Refusal/network failure must reject, not synthesize data.
 * Provider credentials belong in the adapter closure, never in the user message.
 */
export type ComparisonProvider = {
  modelId: string;
  compare(request: {
    system: string;
    user: string;
    jsonSchema: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<unknown>;
};

/** UTF-8 byte ordering, deliberately not localeCompare or UTF-16 string sorting. */
export function compareUtf8(a: string, b: string): number {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/** One model attempt. B owns retries, leases and persistence outside this function. */
export async function evaluatePair(input: unknown, provider: ComparisonProvider): Promise<RoundResult> {
  const parsed = ComparisonInputSchema.safeParse(input);
  if (!parsed.success) throw new EvaluationError("INVALID_INPUT");
  const modelId = z.string().trim().min(1).max(100).safeParse(provider.modelId);
  if (!modelId.success) throw new EvaluationError("INVALID_CONFIGURATION");
  const { prompt, answers } = parsed.data;
  // Equal answers always keep A first. No case folding or Unicode rewriting:
  // evidence must remain an exact substring of the submitted text.
  const aIsLeft = compareUtf8(answers.a, answers.b) <= 0;
  const left = aIsLeft ? answers.a : answers.b;
  const right = aIsLeft ? answers.b : answers.a;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new EvaluationError("TIMEOUT"));
      controller.abort();
    }, EVALUATION_TIMEOUT_MS);
  });
  let raw: unknown;
  try {
    raw = await Promise.race([deadline, Promise.resolve().then(() => provider.compare({
      system: COMPARISON_SYSTEM_PROMPT,
      user: JSON.stringify({ prompt, left, right }),
      // JSON Schema conveys structure. Cross-field and exact-evidence rules are
      // enforced locally by Zod; providers cannot enforce those constraints.
      jsonSchema: z.toJSONSchema(ModelComparisonSchema),
      signal: controller.signal,
    }))]);
  } catch (error) {
    if (error instanceof EvaluationError && error.code === "TIMEOUT") throw error;
    throw new EvaluationError("PROVIDER_ERROR");
  } finally {
    clearTimeout(timer);
  }
  const structural = ModelComparisonSchema.safeParse(raw);
  if (!structural.success) throw new EvaluationError("INVALID_OUTPUT");
  const grounded = createModelComparisonSchema(left, right).safeParse(raw);
  if (!grounded.success) throw new EvaluationError("INVALID_EVIDENCE");
  const comparison = grounded.data;
  const mapDimension = (d: ModelDimension) => ({
    similarity: d.similarity,
    aEvidence: aIsLeft ? d.leftEvidence : d.rightEvidence,
    bEvidence: aIsLeft ? d.rightEvidence : d.leftEvidence,
    explanation: d.explanation,
  });
  return RoundResultSchema.parse({
    ...comparison,
    dimensions: {
      imagery: mapDimension(comparison.dimensions.imagery),
      association: mapDimension(comparison.dimensions.association),
      orientation: mapDimension(comparison.dimensions.orientation),
    },
    ...calculateRoundDistance(comparison.dimensions),
    rubricVersion: "fmp-v1",
    modelId: modelId.data,
  });
}
