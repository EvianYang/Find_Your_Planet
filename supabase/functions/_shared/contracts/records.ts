import { z } from "zod";

import {
  RequestIdSchema,
  UtcDateTimeSchema,
  UuidSchema,
} from "./common.ts";
import {
  NicknameSchema,
  PromptSchema,
  RoundIndexSchema,
} from "./game.ts";
import { INTERPRETATION_MAX, LIST_ITEM_MAX, RubricVersionSchema } from "./evaluation.ts";

const shortTextArray = z.array(z.string().max(LIST_ITEM_MAX)).max(2);

export const SavedRoundSnapshotSchema = z
  .object({
    roundIndex: RoundIndexSchema,
    prompt: PromptSchema,
    distance: z.number().int().min(0).max(1000).nullable(),
    coverage: z.number().min(0).max(1),
    summary: z.string().max(INTERPRETATION_MAX),
    commonality: shortTextArray,
    divergence: shortTextArray,
    unknowns: shortTextArray,
    rubricVersion: RubricVersionSchema,
    modelId: z.string().min(1).max(100),
  })
  .strict();

export const SavedRecordSchema = z
  .object({
    id: UuidSchema,
    sourceRoomId: UuidSchema,
    partnerNickname: NicknameSchema,
    playedAt: UtcDateTimeSchema,
    savedAt: UtcDateTimeSchema,
    rounds: z.array(SavedRoundSnapshotSchema).length(3),
    overallDistance: z.number().int().min(0).max(1000).nullable(),
    validRounds: z.number().int().min(0).max(3),
    // A game played across the fmp-v2 rollout can mix versions; each round keeps its own version.
    rubricVersion: RubricVersionSchema,
  })
  .strict();

export const RankedRecordSchema = SavedRecordSchema.extend({
  rank: z.number().int().positive().nullable(),
});

export const RecordsRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      roomId: UuidSchema,
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("list"),
      cursor: z.string().min(1).max(512).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      recordId: UuidSchema,
      requestId: RequestIdSchema,
    })
    .strict(),
]);

export const RecordsListDataSchema = z
  .object({
    records: z.array(RankedRecordSchema),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();

export type SavedRoundSnapshot = z.infer<typeof SavedRoundSnapshotSchema>;
export type SavedRecord = z.infer<typeof SavedRecordSchema>;
export type RankedRecord = z.infer<typeof RankedRecordSchema>;
export type RecordsRequest = z.infer<typeof RecordsRequestSchema>;
