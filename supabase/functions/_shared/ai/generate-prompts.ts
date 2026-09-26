import { z } from "zod";
import { PromptSchema } from "../contracts/game.ts";
import type { Prompt } from "../contracts/game.ts";
import { GENERATION_INSTRUCTIONS, selectGenerationDirections, buildGenerationUserMessage } from "./generation-prompt.ts";
export { GENERATION_INSTRUCTIONS } from "./generation-prompt.ts";

export const GENERATION_VERSION = "question-generation-v2";
export const GENERATION_TIMEOUT_MS = 8_000;

// Validate the envelope first; invalid text lengths discard only that candidate.
export const generatedQuestionsSchema = z.object({
  questions: z.array(z.object({ text: z.string() }).strict()).max(2),
}).strict();

/** Provider adapter must disable SDK retries and pass signal to its HTTP request.
 * Return decoded JSON, not an SDK response envelope. No private player data.
 */
export type QuestionGenerator = (request: {
  instructions: string;
  user: string;
  signal: AbortSignal;
}) => Promise<unknown>;

export type GenerationAttempt = {
  status: "ready" | "empty" | "failed";
  candidates: Prompt[];
  reason: "timeout" | "invalid_output" | "provider_error" | null;
};

/** One bounded attempt. Start can use curated questions without awaiting this.
 * Candidates require task 3.3 quality checks before entering a room pool.
 */
export async function generatePromptCandidates(
  generate: QuestionGenerator,
): Promise<GenerationAttempt> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<GenerationAttempt>((resolve) => {
    timer = setTimeout(() => {
      resolve({ status: "failed", candidates: [], reason: "timeout" });
      controller.abort();
    }, GENERATION_TIMEOUT_MS);
  });

  const attempt = async (): Promise<GenerationAttempt> => {
    try {
      const raw = await generate({
        instructions: GENERATION_INSTRUCTIONS,
        user: buildGenerationUserMessage(selectGenerationDirections()),
        signal: controller.signal,
      });
      const parsed = generatedQuestionsSchema.safeParse(raw);
      if (!parsed.success) {
        return { status: "failed", candidates: [], reason: "invalid_output" };
      }
      const seen = new Set<string>();
      const candidates: Prompt[] = [];
      for (const question of parsed.data.questions) {
        if (controller.signal.aborted) return { status: "failed", candidates: [], reason: "timeout" };
        const text = question.text.normalize("NFKC").trim();
        if ([...text].length === 0 || [...text].length > 180 || seen.has(text)) continue;
        seen.add(text);
        candidates.push(PromptSchema.parse({ id: crypto.randomUUID(), text, source: "generated", version: GENERATION_VERSION }));
      }
      return { status: candidates.length ? "ready" : "empty", candidates, reason: null };
    } catch {
      // Provider errors can contain credentials or request data; do not log them.
      return { status: "failed", candidates: [], reason: "provider_error" };
    }
  };

  try {
    return await Promise.race([deadline, attempt()]);
  } finally {
    clearTimeout(timer);
  }
}
