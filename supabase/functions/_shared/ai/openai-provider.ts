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
          reasoning: { effort: "minimal" }, max_output_tokens: 2500,
          text: { format: { type: "json_schema", name: "pair_comparison", strict: true, schema: request.jsonSchema } },
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
