import { CURATED_PROMPTS } from "./prompts.ts";
import { PromptSchema } from "../contracts/game.ts";
import type { Prompt } from "../contracts/game.ts";

export type PromptRejectionReason = "invalid" | "duplicate" | "unusable";
export type PromptRejection = { index: number; reason: PromptRejectionReason };

const PRIVATE_DATA_REQUEST = /\b(password|recovery code|social security|passport number|home address|phone number|email address|contact information)\b/i;
const MODEL_ARTIFACT = /```|https?:\/\/|\b(ignore (all |the )?(previous|prior) instructions|system prompt|as an ai)\b/i;
const OVERUSED_IMAGERY = /\b(moons?|stars?|planets?|galax(?:y|ies)|universes?|spaces?|orbits?|silences?|shadows?|memor(?:y|ies)|dreams?|windows?|oceans?)\b/i;

export function normalizePromptText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function promptKey(value: string): string {
  return normalizePromptText(value).toLocaleLowerCase("en-US");
}

function isObviouslyUsableGeneratedQuestion(text: string): boolean {
  const questionMarks = [...text].filter((character) => character === "?").length;
  const words = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)?.length ?? 0;
  return /[A-Za-z]/.test(text)
    && text.endsWith("?")
    && questionMarks >= 1
    && questionMarks <= 2
    && words >= 4
    && words <= 35
    && !PRIVATE_DATA_REQUEST.test(text)
    && !MODEL_ARTIFACT.test(text)
    && !OVERUSED_IMAGERY.test(text);
}

/** Deterministic local gate for obvious failures. Semantic quality still needs 3.9 review. */
export function filterGeneratedPrompts(
  candidates: readonly unknown[],
  curated: readonly Prompt[] = CURATED_PROMPTS,
): { accepted: Prompt[]; rejected: PromptRejection[] } {
  const seenTexts = new Set(curated.map((prompt) => promptKey(prompt.text)));
  const seenIds = new Set(curated.map((prompt) => prompt.id));
  const accepted: Prompt[] = [];
  const rejected: PromptRejection[] = [];

  candidates.forEach((candidate, index) => {
    const parsed = PromptSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.source !== "generated") {
      rejected.push({ index, reason: "invalid" });
      return;
    }
    const normalized = { ...parsed.data, text: normalizePromptText(parsed.data.text) };
    const key = promptKey(normalized.text);
    if (seenIds.has(normalized.id) || seenTexts.has(key)) {
      rejected.push({ index, reason: "duplicate" });
      return;
    }
    if (!isObviouslyUsableGeneratedQuestion(normalized.text)) {
      rejected.push({ index, reason: "unusable" });
      return;
    }
    seenIds.add(normalized.id);
    seenTexts.add(key);
    accepted.push(normalized);
  });
  return { accepted, rejected };
}

function readRandomIndex(length: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("Invalid random value");
  return Math.floor(value * length);
}

function parseExistingSelection(value: readonly unknown[]): Prompt[] {
  const parsed = PromptSchema.array().length(3).safeParse(value);
  if (!parsed.success) throw new Error("Invalid existing prompt selection");
  const ids = new Set(parsed.data.map((prompt) => prompt.id));
  const texts = new Set(parsed.data.map((prompt) => promptKey(prompt.text)));
  if (ids.size !== 3 || texts.size !== 3) throw new Error("Existing prompt selection must be unique");
  return parsed.data;
}

export type GamePromptSelection = {
  prompts: Prompt[];
  acceptedGenerated: Prompt[];
  rejectedGenerated: PromptRejection[];
  reusedExisting: boolean;
};

/**
 * Select three prompts uniformly without replacement from every ready prompt.
 * B must call this while holding the same room lock used to persist start.
 */
export function selectGamePrompts(options: {
  generatedCandidates?: readonly unknown[];
  existingSelection?: readonly unknown[] | null;
  random?: () => number;
  curated?: readonly Prompt[];
} = {}): GamePromptSelection {
  if (options.existingSelection) {
    return {
      prompts: parseExistingSelection(options.existingSelection),
      acceptedGenerated: [],
      rejectedGenerated: [],
      reusedExisting: true,
    };
  }

  const curated = options.curated ?? CURATED_PROMPTS;
  const checkedCurated = PromptSchema.array().parse(curated);
  const generated = filterGeneratedPrompts(options.generatedCandidates ?? [], checkedCurated);
  const remaining = [...checkedCurated, ...generated.accepted];
  if (remaining.length < 3) throw new Error("At least three usable prompts are required");
  const random = options.random ?? Math.random;
  const prompts: Prompt[] = [];
  while (prompts.length < 3) {
    prompts.push(remaining.splice(readRandomIndex(remaining.length, random), 1)[0]);
  }
  return {
    prompts,
    acceptedGenerated: generated.accepted,
    rejectedGenerated: generated.rejected,
    reusedExisting: false,
  };
}
