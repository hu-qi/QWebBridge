import { ERROR_CODES, type ErrorCode, type ErrorDetail } from "@qweb/protocol";

export class ToolError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export function toErrorDetail(error: unknown): ErrorDetail {
  if (error instanceof ToolError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: ERROR_CODES.EXECUTION_ERROR,
    message: error instanceof Error ? error.message : "Unknown error",
  };
}
