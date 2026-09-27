import { z } from "zod";

export const UuidSchema = z.string().uuid();
export const UtcDateTimeSchema = z.string().datetime({ offset: true });
export const RequestIdSchema = UuidSchema;

export const ApiErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "UNAUTHORIZED",
  "IDENTITY_REPLACED",
  "NOT_FOUND",
  "ROOM_FULL",
  "INVALID_PHASE",
  "CONFLICT",
  "EXPIRED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "EVALUATION_FAILED",
  "RECOVERY_FAILED",
  "RECOVERY_TARGET_NOT_EMPTY",
]);

export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1).max(200),
    retryable: z.boolean(),
  })
  .strict();

export const createApiResponseSchema = <TData extends z.ZodType>(
  dataSchema: TData,
) =>
  z.union([
    z
      .object({
        data: dataSchema,
        error: z.null(),
        requestId: RequestIdSchema,
      })
      .strict(),
    z
      .object({
        data: z.null(),
        error: ApiErrorSchema,
        requestId: RequestIdSchema,
      })
      .strict(),
  ]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
