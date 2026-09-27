import { ApiErrorCodeSchema, type ApiErrorCode } from "@contracts/common.ts";
import { JoinCodeSchema } from "@contracts/game.ts";

/**
 * Reads an API error code from whatever the service layer throws: B's ApiClientError carries `code`;
 * a plain `Error("CODE: message")` is still understood. The UI shows its own English copy, never the server message.
 */
export function errorCodeOf(error: unknown): ApiErrorCode | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const parsed = ApiErrorCodeSchema.safeParse((error as { code: unknown }).code);
    if (parsed.success) return parsed.data;
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match = /^([A-Z_]+):/.exec(message);
  if (!match) return null;
  const parsed = ApiErrorCodeSchema.safeParse(match[1]);
  return parsed.success ? parsed.data : null;
}

export type ErrorContext =
  | "identity" | "create" | "join" | "recover" | "rotate" | "room" | "start" | "submit" | "continue" | "save" | "records" | "delete";

const GENERIC = "Something went wrong. Please try again.";

export function errorCopy(error: unknown, context: ErrorContext): string {
  const code = errorCodeOf(error);
  switch (code) {
    case "ROOM_FULL":
      return "This room already has two players.";
    case "EXPIRED":
      return context === "save"
        ? "This room has closed, so this game can't be saved anymore."
        : "This room has closed. Ask your partner to start a new one.";
    case "NOT_FOUND":
      return context === "join"
        ? "We couldn't find that room. Check the code, or ask for a new invite."
        : context === "room"
          ? "We couldn't find this room."
          : GENERIC;
    case "INVALID_PHASE":
      return context === "join"
        ? "This game has already started."
        : context === "start"
          ? "Couldn't start the game. Try again."
          : context === "continue"
            ? "The game has already moved on."
            : GENERIC;
    case "RATE_LIMITED":
      return "Too many tries. Please wait 15 minutes and try again.";
    case "RECOVERY_FAILED":
      return "That code didn't work. Check it and try again.";
    case "RECOVERY_TARGET_NOT_EMPTY":
      return "This browser has already played as someone else. Open a private window or another browser to restore.";
    case "UNAUTHORIZED":
    case "IDENTITY_REPLACED":
      return "This browser no longer has access. Restore with your recovery code.";
    case "INVALID_INPUT":
      return context === "identity" ? "Check your nickname and try again." : context === "submit" ? "Check your answer and try again." : GENERIC;
    case "CONFLICT":
      return context === "submit" ? "Your answer for this round was already saved." : GENERIC;
    default:
      return code === null && context !== "records" ? "Couldn't connect. Check your connection and try again." : GENERIC;
  }
}

/** Reads the envelope's `retryable` flag when the service layer passes it through; null when it isn't available. */
export function retryableOf(error: unknown): boolean | null {
  if (typeof error === "object" && error !== null && "retryable" in error) {
    const value = (error as { retryable: unknown }).retryable;
    if (typeof value === "boolean") return value;
  }
  return null;
}

/** Unicode-aware helpers shared by the forms (limits come from CONTRACTS §2). */
export const unicodeLength = (value: string) => Array.from(value).length;
export const clipUnicode = (value: string, max: number) => Array.from(value).slice(0, max).join("");

/** Join codes: 8 characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (JoinCodeSchema in the shared contracts). */
export const JOIN_CODE_LENGTH = 8;
export const normalizeJoinCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const isValidJoinCode = (value: string) => JoinCodeSchema.safeParse(value).success;

/** Recovery codes: 26 characters from the same alphabet, shown in groups of four; dashes and spaces are optional. */
export const normalizeRecoveryCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const isValidRecoveryCode = (value: string) => /^[A-HJ-NP-Z2-9]{26}$/.test(normalizeRecoveryCode(value));
