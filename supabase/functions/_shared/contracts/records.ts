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

const shortTextArray = z.array(z.string().max(100)).max(2);

export const SavedRoundSnapshotSchema = z
  .object({
    roundIndex: RoundIndexSchema,
    prompt: PromptSchema,
    distance: z.number().int().min(0).max(1000).nullable(),
    coverage: z.number().min(0).max(1),
    summary: z.string().max(120),
    commonality: shortTextArray,
    divergence: shortTextArray,
    unknowns: shortTextArray,
    rubricVersion: z.literal("fmp-v1"),
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
    rubricVersion: z.literal("fmp-v1"),
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
