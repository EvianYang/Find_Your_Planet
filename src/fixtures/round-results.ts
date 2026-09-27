/** DEMO ONLY — handwritten examples, never a fallback for live model failures. */
import { z } from "zod";
import { PromptSchema, PlayerSchema, AnswerSchema } from "../../supabase/functions/_shared/contracts/game.ts";
import { EvaluateResponseSchema } from "../../supabase/functions/_shared/contracts/evaluate.ts";
import type { DimensionResult, RoundResultV1 } from "../../supabase/functions/_shared/contracts/evaluation.ts";

const DemoRoundSchema = z.object({
  isDemo: z.literal(true),
  label: z.string(),
  scenario: z.enum(["close", "medium", "far", "partial", "insufficient", "technical-failure"]),
  prompt: PromptSchema,
  players: z.array(PlayerSchema).length(2),
  answers: z.object({ a: AnswerSchema, b: AnswerSchema }).strict(),
  response: EvaluateResponseSchema,
}).strict();
export type DemoRoundFixture = z.infer<typeof DemoRoundSchema>;

const prompt = PromptSchema.parse({
  id: "demo-fridge-notes", source: "curated", version: "demo-v1",
  text: "Your fridge starts leaving notes on your door; what does its first note say?",
});
const players = [{ slot: "A", nickname: "Alex (demo)" }, { slot: "B", nickname: "Sam (demo)" }];
const dimension = (similarity: DimensionResult["similarity"], a: string, b: string, explanation: string): DimensionResult => ({
  similarity, aEvidence: a ? [a] : [], bEvidence: b ? [b] : [], explanation,
});
const ready = (scenario: "close" | "medium" | "far" | "partial" | "insufficient", label: string,
  answers: { a: string; b: string }, result: Omit<RoundResultV1, "rubricVersion" | "modelId">,
): DemoRoundFixture => DemoRoundSchema.parse({
  isDemo: true, scenario, label: `Demo sample · ${label}`, prompt, players, answers,
  response: { data: { status: "ready", result: { ...result, rubricVersion: "fmp-v1", modelId: "demo-handwritten-not-a-model" } },
    error: null, requestId: "91b264f0-6e12-4df4-9b2a-000000000101" },
});

export const closeRound = ready("close", "Close", {
  a: "Eat the leftover soup first; I kept it safe for you.",
  b: "Please finish yesterday's soup; I have been guarding it for you.",
}, {
  status: "ok", coverage: 1, distance: 0,
  dimensions: {
    imagery: dimension(4, "leftover soup", "yesterday's soup", "Both imagine soup kept in the fridge."),
    association: dimension(4, "I kept it safe for you", "I have been guarding it for you", "Both turn refrigeration into guarding food for you."),
    orientation: dimension(4, "Eat the leftover soup first", "Please finish yesterday's soup", "Both remind you to eat the food they have protected."),
  },
  summary: "Both fridges care for leftover soup and remind you to eat it.",
  commonality: ["Shared soup imagery and a protective reminder."], divergence: ["The wording differs slightly, but the central idea is close."], unknowns: [],
});

export const mediumRound = ready("medium", "Different paths · Medium distance", {
  a: "Please eat the carrots before they go soft; I hate wasting food.",
  b: "The carrots are holding a concert tonight; bring cheese for the band.",
}, {
  status: "ok", coverage: 1, distance: 500,
  dimensions: {
    imagery: dimension(4, "the carrots", "The carrots", "Both start with carrots in the fridge."),
    association: dimension(2, "before they go soft", "holding a concert tonight", "Both report on food; one warns of spoilage, while the other stages a concert."),
    orientation: dimension(0, "I hate wasting food", "bring cheese for the band", "One explicitly avoids waste; the other invites you to an absurd performance."),
  },
  summary: "Carrots lead one answer toward a practical reminder and the other toward a food band.",
  commonality: ["Both build a fridge message around carrots."], divergence: ["Keeping food fresh and staging a concert take different imaginative paths."], unknowns: [],
});

export const farRound = ready("far", "Different paths · Far distance", {
  a: "Pay me in magnets or I quit; cooling is a job, not a favor.",
  b: "I saved your birthday cake; everyone is waiting to celebrate with you.",
}, {
  status: "ok", coverage: 1, distance: 1000,
  dimensions: {
    imagery: dimension(0, "magnets", "birthday cake", "The central objects are magnets as payment and a birthday cake."),
    association: dimension(0, "Pay me in magnets or I quit", "everyone is waiting to celebrate", "One fridge negotiates payment; the other delivers a party invitation."),
    orientation: dimension(0, "a job, not a favor", "celebrate with you", "One asks for compensation; the other offers a shared celebration."),
  },
  summary: "Your talking fridges deliver a pay demand and a birthday invitation.",
  commonality: [], divergence: ["The objects, story paths, and expressed intentions differ."], unknowns: [],
});

export const partialRound = ready("partial", "Partial understanding, unknown distance", {
  a: "The carrots.", b: "Carrots.",
}, {
  status: "ok", coverage: 0.25, distance: null,
  dimensions: {
    imagery: dimension(4, "carrots", "Carrots", "Both name carrots."),
    association: dimension(null, "", "", "Neither answer develops an imaginative path."),
    orientation: dimension(null, "", "", "Neither answer expresses a purpose or feeling."),
  },
  summary: "You share an image of carrots, but there is not enough context to estimate a distance.",
  commonality: ["Both mention the same vegetable."], divergence: [],
  unknowns: ["The imaginative paths and intentions are not expressed."],
});

export const insufficientRound = ready("insufficient", "Insufficient evidence", {
  a: "Not sure.", b: "Maybe.",
}, {
  status: "insufficient", coverage: 0, distance: null,
  dimensions: {
    imagery: dimension(null, "Not sure.", "Maybe.", "There is not enough concrete imagery."),
    association: dimension(null, "", "", "Neither answer develops an idea we can compare."),
    orientation: dimension(null, "", "", "There is no basis to infer intentions or feelings."),
  },
  summary: "These answers do not yet offer enough clues to estimate a distance.",
  commonality: [], divergence: [], unknowns: ["Imagery, imaginative paths, and intentions remain unclear."],
});

export const technicalFailureRound = DemoRoundSchema.parse({
  isDemo: true, scenario: "technical-failure", label: "Demo sample · Technical failure, retry available",
  prompt, players, answers: closeRound.answers,
  response: {
    data: null, error: { code: "EVALUATION_FAILED", message: "Analysis failed. Please try again.", retryable: true },
    requestId: "91b264f0-6e12-4df4-9b2a-000000000102",
  },
});

export const ROUND_RESULT_FIXTURES = [closeRound, mediumRound, farRound, partialRound, insufficientRound, technicalFailureRound] as const;
