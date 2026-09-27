import { z } from "zod";
import { EVIDENCE_MAX, INTERPRETATION_MAX, LIST_ITEM_MAX } from "../contracts/evaluation.ts";
import { EvaluationError } from "./evaluate-pair.ts";
import type { ComparisonProvider } from "./evaluate-pair.ts";
import { generatedQuestionsSchema } from "./generate-prompts.ts";
import type { QuestionGenerator } from "./generate-prompts.ts";
import { PROMPT_TEXT_MAX } from "../contracts/game.ts";

const ResponseSchema = z.object({
  status: z.literal("completed"),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

/** Zod custom Unicode refinements do not appear in exported JSON Schema.
 * Mirror the hard limits for provider generation; local validation remains authoritative.
 * They sit well above the prompt's target lengths, so generation is not cut off at the target.
 */
export function withComparisonTextLimits(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(schema);
  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const object = node as Record<string, unknown>;
    if (object.properties && typeof object.properties === "object") {
      for (const [key, value] of Object.entries(object.properties)) {
        const field = value as Record<string, unknown>;
        if (key === "summary" || key === "explanation") field.maxLength = INTERPRETATION_MAX;
        if (["commonality", "divergence", "unknowns", "leftEvidence", "rightEvidence"].includes(key)) {
          const items = field.items as Record<string, unknown>;
          if (items) items.maxLength = key.endsWith("Evidence") ? EVIDENCE_MAX : LIST_ITEM_MAX;
        }
      }
    }
    Object.values(object).forEach(visit);
  }
  visit(copy);
  return copy;
}

type OpenAIConfig = { apiKey: string; model: string };

/** One Responses API call with a strict JSON schema; returns the decoded JSON or throws a sanitized error. */
async function requestStructuredJson(config: OpenAIConfig, transport: typeof fetch, request: {
  instructions: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  effort: "low" | "medium";
  maxOutputTokens: number;
  signal: AbortSignal;
}): Promise<unknown> {
  const response = await transport("https://api.openai.com/v1/responses", {
    method: "POST", redirect: "error", signal: request.signal,
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model, store: false,
      instructions: request.instructions,
      input: [{ role: "user", content: request.user }],
      reasoning: { effort: request.effort }, max_output_tokens: request.maxOutputTokens,
      text: { format: { type: "json_schema", name: request.schemaName, strict: true, schema: request.schema } },
    }),
  });
  if (!response.ok) throw new EvaluationError("PROVIDER_ERROR");
  const envelope = ResponseSchema.safeParse(await response.json());
  if (!envelope.success) throw new EvaluationError("PROVIDER_ERROR");
  const contents = envelope.data.output.flatMap((item) => item.type === "message" ? item.content ?? [] : []);
  if (contents.some((item) => item.type === "refusal")) throw new EvaluationError("PROVIDER_ERROR");
  const texts = contents.filter((item) => item.type === "output_text");
  if (texts.length !== 1 || typeof texts[0].text !== "string") throw new EvaluationError("INVALID_OUTPUT");
  try { return JSON.parse(texts[0].text) as unknown; }
  catch { throw new EvaluationError("INVALID_OUTPUT"); }
}

function requireConfig(config: OpenAIConfig): void {
  if (!config.apiKey.trim() || !config.model.trim()) throw new EvaluationError("INVALID_CONFIGURATION");
}

/** Server-only answer comparison. Credentials are supplied by the caller and never logged. */
export function createOpenAIProvider(config: OpenAIConfig, transport: typeof fetch = fetch): ComparisonProvider {
  requireConfig(config);
  return {
    modelId: config.model,
    compare(request) {
      return requestStructuredJson(config, transport, {
        instructions: request.system,
        user: request.user,
        schemaName: "pair_comparison",
        schema: withComparisonTextLimits(request.jsonSchema),
        effort: "medium",
        maxOutputTokens: 5000,
        signal: request.signal,
      });
    },
  };
}

/** Strict output shape for question generation: at most two questions, each within the prompt limit. */
function questionGenerationSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(generatedQuestionsSchema) as Record<string, unknown>;
  const questions = (schema.properties as Record<string, Record<string, unknown>>).questions;
  const text = ((questions.items as Record<string, unknown>).properties as Record<string, Record<string, unknown>>).text;
  text.maxLength = PROMPT_TEXT_MAX;
  return schema;
}

/**
 * Server-only question generation for game/prepare_prompts (8-second budget, so low reasoning effort).
 * No retries here; generatePromptCandidates owns the timeout and turns any throw into a failed attempt.
 */
export function createOpenAIQuestionGenerator(config: OpenAIConfig, transport: typeof fetch = fetch): QuestionGenerator {
  requireConfig(config);
  const schema = questionGenerationSchema();
  return (request) => requestStructuredJson(config, transport, {
    instructions: request.instructions,
    user: request.user,
    schemaName: "generated_questions",
    schema,
    effort: "low",
    maxOutputTokens: 1500,
    signal: request.signal,
  });
}
