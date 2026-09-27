import type { ApiError, ApiErrorCode } from "@contracts/common.ts";

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

export function throwApiClientError(error: ApiError): never {
  throw new ApiClientError(error);
}
