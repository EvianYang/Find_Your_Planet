import { z } from "zod";
import { EvaluationError } from "./evaluate-pair.ts";
import type { ComparisonProvider } from "./evaluate-pair.ts";

const ResponseSchema = z.object({
  status: z.literal("completed"),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

/** Zod custom Unicode refinements do not appear in exported JSON Schema.
 * Mirror their existing limits for provider generation; local validation remains authoritative.
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
        if (key === "summary" || key === "explanation") field.maxLength = 120;
        if (["commonality", "divergence", "unknowns", "leftEvidence", "rightEvidence"].includes(key)) {
          const items = field.items as Record<string, unknown>;
          if (items) items.maxLength = key.endsWith("Evidence") ? 60 : 100;
        }
      }
    }
    Object.values(object).forEach(visit);
  }
  visit(copy);
  return copy;
}

/** Server-only. Credentials are supplied by the caller and never logged. */
export function createOpenAIProvider(config: { apiKey: string; model: string }, transport: typeof fetch = fetch): ComparisonProvider {
  if (!config.apiKey.trim() || !config.model.trim()) throw new EvaluationError("INVALID_CONFIGURATION");
  return {
    modelId: config.model,
    async compare(request) {
      const response = await transport("https://api.openai.com/v1/responses", {
        method: "POST", redirect: "error", signal: request.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model, store: false,
          instructions: request.system,
          input: [{ role: "user", content: request.user }],
          reasoning: { effort: "low" }, max_output_tokens: 2500,
          text: { format: { type: "json_schema", name: "pair_comparison", strict: true, schema: withComparisonTextLimits(request.jsonSchema) } },
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
    },
  };
}
