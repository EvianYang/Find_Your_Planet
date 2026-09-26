/** DEMO ONLY — handwritten examples, never a fallback for live model failures. */
import { z } from "zod";
import { PromptSchema, PlayerSchema, AnswerSchema } from "../../supabase/functions/_shared/contracts/game.ts";
import { EvaluateResponseSchema } from "../../supabase/functions/_shared/contracts/evaluate.ts";
import type { DimensionResult, RoundResult } from "../../supabase/functions/_shared/contracts/evaluation.ts";

const DemoRoundSchema = z.object({
  isDemo: z.literal(true),
  label: z.string(),
  scenario: z.enum(["close", "medium", "far", "insufficient", "technical-failure"]),
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
const players = [{ slot: "A", nickname: "Alex（演示）" }, { slot: "B", nickname: "Sam（演示）" }];
const dimension = (similarity: DimensionResult["similarity"], a: string, b: string, explanation: string): DimensionResult => ({
  similarity, aEvidence: a ? [a] : [], bEvidence: b ? [b] : [], explanation,
});
const ready = (scenario: "close" | "medium" | "far" | "insufficient", label: string,
  answers: { a: string; b: string }, result: Omit<RoundResult, "rubricVersion" | "modelId">,
): DemoRoundFixture => DemoRoundSchema.parse({
  isDemo: true, scenario, label: `演示样例 · ${label}`, prompt, players, answers,
  response: { data: { status: "ready", result: { ...result, rubricVersion: "fmp-v1", modelId: "demo-handwritten-not-a-model" } },
    error: null, requestId: "91b264f0-6e12-4df4-9b2a-000000000101" },
});

export const closeRound = ready("close", "接近", {
  a: "Eat the leftover soup first; I kept it safe for you.",
  b: "Please finish yesterday's soup; I have been guarding it for you.",
}, {
  status: "ok", coverage: 1, distance: 0,
  dimensions: {
    imagery: dimension(4, "leftover soup", "yesterday's soup", "双方都想到冰箱里留存的汤。"),
    association: dimension(4, "I kept it safe for you", "I have been guarding it for you", "都把冷藏拟人成替你守护食物。"),
    orientation: dimension(4, "Eat the leftover soup first", "Please finish yesterday's soup", "都用提醒把保存好的食物交还给你。"),
  },
  summary: "你们都让冰箱成为守护剩汤、提醒你吃饭的照顾者。",
  commonality: ["相同的食物意象与守护式提醒。"], divergence: ["措辞略有不同，但表达的核心接近。"], unknowns: [],
});

export const mediumRound = ready("medium", "有差异 · 中距离", {
  a: "Please eat the carrots before they go soft; I hate wasting food.",
  b: "The carrots are holding a concert tonight; bring cheese for the band.",
}, {
  status: "ok", coverage: 1, distance: 500,
  dimensions: {
    imagery: dimension(4, "the carrots", "The carrots", "都从冰箱里的胡萝卜展开。"),
    association: dimension(2, "before they go soft", "holding a concert tonight", "都让冰箱传递食物的消息，但一方提醒变质，另一方编排演出。"),
    orientation: dimension(0, "I hate wasting food", "bring cheese for the band", "一方明确想避免浪费，另一方邀请你参与一场荒诞演出。"),
  },
  summary: "胡萝卜是共同起点，一边走向生活提醒，一边走向食物乐队。",
  commonality: ["都围绕胡萝卜写了一条冰箱消息。"], divergence: ["日常保鲜与荒诞演出是不同的展开方向。"], unknowns: [],
});

export const farRound = ready("far", "有差异 · 远距离", {
  a: "Pay me in magnets or I quit; cooling is a job, not a favor.",
  b: "I saved your birthday cake; everyone is waiting to celebrate with you.",
}, {
  status: "ok", coverage: 1, distance: 1000,
  dimensions: {
    imagery: dimension(0, "magnets", "birthday cake", "核心对象分别是作为报酬的磁贴与庆生蛋糕。"),
    association: dimension(0, "Pay me in magnets or I quit", "everyone is waiting to celebrate", "一方让冰箱提出劳资谈判，另一方让它传递聚会邀请。"),
    orientation: dimension(0, "a job, not a favor", "celebrate with you", "一方强调付出要有回报，另一方表达共同庆祝。"),
  },
  summary: "同样让冰箱说话，你们分别写出了报酬谈判和生日邀请。",
  commonality: [], divergence: ["物件、故事展开和表达目的均明显不同。"], unknowns: [],
});

export const insufficientRound = ready("insufficient", "线索不足", {
  a: "Not sure.", b: "Maybe.",
}, {
  status: "insufficient", coverage: 0, distance: null,
  dimensions: {
    imagery: dimension(null, "Not sure.", "Maybe.", "没有足够的具体意象。"),
    association: dimension(null, "", "", "尚未展开可比较的想法。"),
    orientation: dimension(null, "", "", "不能据此推断目的或情感。"),
  },
  summary: "这些回答还没有提供足够线索来判断距离。",
  commonality: [], divergence: [], unknowns: ["暂时无法比较意象、联想路径与表达目的。"],
});

export const technicalFailureRound = DemoRoundSchema.parse({
  isDemo: true, scenario: "technical-failure", label: "演示样例 · 技术失败，可重试",
  prompt, players, answers: closeRound.answers,
  response: {
    data: null, error: { code: "EVALUATION_FAILED", message: "分析暂时失败，请重试。", retryable: true },
    requestId: "91b264f0-6e12-4df4-9b2a-000000000102",
  },
});

export const ROUND_RESULT_FIXTURES = [closeRound, mediumRound, farRound, insufficientRound, technicalFailureRound] as const;
