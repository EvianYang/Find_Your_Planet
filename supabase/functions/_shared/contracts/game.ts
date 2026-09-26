import { z } from "zod";
import { RoundResultSchema } from "./evaluation.ts";

import {
  createApiResponseSchema,
  RequestIdSchema,
  UtcDateTimeSchema,
  UuidSchema,
} from "./common.ts";

const unicodeLength = (value: string) => Array.from(value).length;
const trimmedUnicodeString = (label: string, maxLength: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, `${label} cannot be empty.`)
        .refine((value) => unicodeLength(value) <= maxLength, {
          message: `${label} cannot exceed ${maxLength} Unicode characters.`,
        }),
    );

export const SlotSchema = z.enum(["A", "B"]);
export const PhaseSchema = z.enum([
  "lobby",
  "answering",
  "evaluating",
  "reveal",
  "finished",
]);
export const CurrentRoundSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export const RoundIndexSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export const NicknameSchema = trimmedUnicodeString("Nickname", 20);
export const AnswerSchema = trimmedUnicodeString("Answer", 300);
export const PromptTextSchema = trimmedUnicodeString("Prompt", 180);

export const PromptSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: PromptTextSchema,
    source: z.enum(["curated", "generated"]),
    version: z.string().min(1).max(50),
  })
  .strict();

export const PlayerSchema = z
  .object({
    slot: SlotSchema,
    nickname: NicknameSchema,
  })
  .strict();

export const EvaluationStateSchema = z.enum([
  "idle",
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const SubmissionFlagsSchema = z
  .object({ a: z.boolean(), b: z.boolean() })
  .strict();
export const ContinuedFlagsSchema = z
  .object({ a: z.boolean(), b: z.boolean() })
  .strict();

export const OverallResultSchema = z
  .object({
    overallDistance: z.number().int().min(0).max(1000).nullable(),
    validRounds: z.number().int().min(0).max(3),
    totalRounds: z.literal(3),
  })
  .strict();

export const RevealedRoundBaseSchema = z
  .object({
    roundIndex: RoundIndexSchema,
    prompt: PromptSchema,
    answers: z
      .object({
        a: AnswerSchema,
        b: AnswerSchema,
      })
      .strict(),
  })
  .strict();

export const GameSnapshotBaseSchema = z
  .object({
    roomId: UuidSchema,
    phase: PhaseSchema,
    currentRound: CurrentRoundSchema,
    revision: z.number().int().nonnegative(),
    expiresAt: UtcDateTimeSchema,
    players: z.array(PlayerSchema).min(1).max(2),
    currentPrompt: PromptSchema.nullable(),
    ownAnswer: AnswerSchema.nullable(),
    submitted: SubmissionFlagsSchema,
    continued: ContinuedFlagsSchema,
    evaluationState: EvaluationStateSchema,
    overall: OverallResultSchema.nullable(),
  })
  .strict();

// C owns RoundResultSchema. This factory keeps game.ts independent until C
// supplies that schema, while ensuring the final snapshot validates it once.
export const createGameSnapshotSchema = <TRoundResult extends z.ZodType>(
  roundResultSchema: TRoundResult,
) =>
  GameSnapshotBaseSchema.extend({
    revealedRounds: z.array(
      RevealedRoundBaseSchema.extend({ result: roundResultSchema }),
    ),
  });

const RoomRequestSchema = z.object({ roomId: UuidSchema }).strict();
const IdempotentRoomRequestSchema = RoomRequestSchema.extend({
  requestId: RequestIdSchema,
});

export const GameRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), requestId: RequestIdSchema }).strict(),
  z
    .object({
      action: z.literal("join"),
      joinCode: z.string().trim().min(1).max(32),
      requestId: RequestIdSchema,
    })
    .strict(),
  RoomRequestSchema.extend({ action: z.literal("prepare_prompts") }),
  IdempotentRoomRequestSchema.extend({ action: z.literal("start") }),
  RoomRequestSchema.extend({ action: z.literal("snapshot") }),
  IdempotentRoomRequestSchema.extend({
    action: z.literal("submit"),
    roundIndex: RoundIndexSchema,
    answer: AnswerSchema,
  }),
  IdempotentRoomRequestSchema.extend({
    action: z.literal("continue"),
    roundIndex: RoundIndexSchema,
  }),
]);

export const RoomCreatedSchema = z
  .object({ roomId: UuidSchema, joinCode: z.string().min(1).max(32) })
  .strict();

export const RoomJoinedSchema = z.object({ roomId: UuidSchema }).strict();
export const RoomCreatedResponseSchema = createApiResponseSchema(
  RoomCreatedSchema,
);
export const RoomJoinedResponseSchema = createApiResponseSchema(
  RoomJoinedSchema,
);

export type Slot = z.infer<typeof SlotSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type CurrentRound = z.infer<typeof CurrentRoundSchema>;
export type RoundIndex = z.infer<typeof RoundIndexSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type EvaluationState = z.infer<typeof EvaluationStateSchema>;
export type GameSnapshotBase = z.infer<typeof GameSnapshotBaseSchema>;
export type GameRequest = z.infer<typeof GameRequestSchema>;

// Final shared boundary: browser and server consume the same evaluated snapshot.
export const GameSnapshotSchema = createGameSnapshotSchema(RoundResultSchema);
export const GameSnapshotResponseSchema = createApiResponseSchema(
  GameSnapshotSchema,
);
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
export type RoomCreated = z.infer<typeof RoomCreatedSchema>;
export type RoomJoined = z.infer<typeof RoomJoinedSchema>;
