import { z } from "zod";
import { UuidSchema, createApiResponseSchema } from "./common.ts";
import { AnswerSchema, PromptTextSchema, RoundIndexSchema } from "./game.ts";
import { RoundResultSchema } from "./evaluation.ts";

export const EvaluateRequestSchema = z.object({
  action: z.literal("run"), roomId: UuidSchema, roundIndex: RoundIndexSchema,
}).strict();
// Internal model input, not accepted directly from the public evaluate endpoint.
export const ComparisonInputSchema = z.object({
  prompt: PromptTextSchema, answers: z.object({ a: AnswerSchema, b: AnswerSchema }).strict(),
}).strict();
export const EvaluationReadyDataSchema = z.object({
  status: z.literal("ready"), result: RoundResultSchema,
}).strict();
export const EvaluationProcessingDataSchema = z.object({ status: z.literal("processing") }).strict();
// Technical failure uses the common error envelope, never an insufficient result.
export const EvaluateResponseSchema = createApiResponseSchema(z.union([
  EvaluationReadyDataSchema, EvaluationProcessingDataSchema,
]));
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;
export type ComparisonInput = z.infer<typeof ComparisonInputSchema>;
export type EvaluateResponse = z.infer<typeof EvaluateResponseSchema>;
