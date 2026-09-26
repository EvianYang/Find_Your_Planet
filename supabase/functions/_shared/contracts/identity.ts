import { z } from "zod";

import {
  RequestIdSchema,
  UtcDateTimeSchema,
  UuidSchema,
} from "./common.ts";
import { NicknameSchema } from "./game.ts";

export const IdentityProfileSchema = z
  .object({
    id: UuidSchema,
    nickname: NicknameSchema,
    credentialVersion: z.number().int().positive(),
    createdAt: UtcDateTimeSchema,
  })
  .strict();

// Formatting is intentionally permissive here; the identity implementation
// will normalize separators before checking the server-side SHA-256 hash.
export const RecoveryCodeSchema = z.string().trim().min(20).max(100);

export const IdentityRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      nickname: NicknameSchema,
      requestId: RequestIdSchema,
    })
    .strict(),
  z.object({ action: z.literal("me") }).strict(),
  z
    .object({
      action: z.literal("recover"),
      recoveryCode: RecoveryCodeSchema,
      requestId: RequestIdSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("rotate_recovery"),
      requestId: RequestIdSchema,
    })
    .strict(),
]);

export const IdentityDataSchema = z
  .object({
    profile: IdentityProfileSchema,
    recoveryCode: RecoveryCodeSchema.optional(),
  })
  .strict();

export const IdentityMeDataSchema = z
  .object({ profile: IdentityProfileSchema.nullable() })
  .strict();

export type IdentityProfile = z.infer<typeof IdentityProfileSchema>;
export type IdentityRequest = z.infer<typeof IdentityRequestSchema>;
export type IdentityData = z.infer<typeof IdentityDataSchema>;
