export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PATH_INVALID: "PATH_INVALID",
  PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",
  PATH_PROTECTED: "PATH_PROTECTED",
  SYMLINK_FORBIDDEN: "SYMLINK_FORBIDDEN",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_TYPE_INVALID: "FILE_TYPE_INVALID",
  FILE_SYSTEM_ERROR: "FILE_SYSTEM_ERROR",
  WORKSPACE_UNAVAILABLE: "WORKSPACE_UNAVAILABLE",
  REPOSITORY_ERROR: "REPOSITORY_ERROR",
  WORKTREE_DIRTY: "WORKTREE_DIRTY",
  STATE_CONFLICT: "STATE_CONFLICT",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  ATTEMPT_NOT_FOUND: "ATTEMPT_NOT_FOUND",
  PATCH_INVALID: "PATCH_INVALID",
  PATCH_CONFLICT: "PATCH_CONFLICT",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  TEST_EXECUTION_ERROR: "TEST_EXECUTION_ERROR",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  OPERATION_CANCELLED: "OPERATION_CANCELLED",
  ANALYSIS_ERROR: "ANALYSIS_ERROR",
  AGENT_ERROR: "AGENT_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ErrorPayload {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ErrorPayload };

export interface DevGuardianErrorOptions {
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly cause?: unknown;
}

export class DevGuardianError extends Error {
  public readonly retryable: boolean;
  public readonly details: Readonly<Record<string, JsonValue>> | undefined;

  public constructor(
    public readonly code: ErrorCode,
    message: string,
    options: DevGuardianErrorOptions = {}
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  public toPayload(): ErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details === undefined ? {} : { details: this.details })
    };
  }
}

export class ValidationError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

export type PathErrorCode =
  | "PATH_INVALID" | "PATH_OUTSIDE_WORKSPACE" | "PATH_PROTECTED"
  | "SYMLINK_FORBIDDEN" | "FILE_NOT_FOUND" | "FILE_TYPE_INVALID";

export class PathSecurityError extends DevGuardianError {
  public constructor(code: PathErrorCode, message: string, options: DevGuardianErrorOptions = {}) {
    super(code, message, options);
  }
}

export class FileSystemError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.FILE_SYSTEM_ERROR, message, options);
  }
}

export type RepositoryErrorCode =
  | "REPOSITORY_ERROR" | "WORKTREE_DIRTY" | "STATE_CONFLICT"
  | "SESSION_NOT_FOUND" | "ATTEMPT_NOT_FOUND" | "PATCH_INVALID"
  | "PATCH_CONFLICT" | "VERIFICATION_FAILED";

export class RepositoryError extends DevGuardianError {
  public constructor(code: RepositoryErrorCode, message: string, options: DevGuardianErrorOptions = {}) {
    super(code, message, options);
  }
}

export class TestExecutionError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.TEST_EXECUTION_ERROR, message, options);
  }
}

export class ExecutionTimeoutError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.EXECUTION_TIMEOUT, message, options);
  }
}

export class AnalysisError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.ANALYSIS_ERROR, message, options);
  }
}

export class AgentError extends DevGuardianError {
  public constructor(message: string, options: DevGuardianErrorOptions = {}) {
    super(ErrorCode.AGENT_ERROR, message, options);
  }
}

export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure(error: unknown): Result<never> {
  if (error instanceof DevGuardianError) {
    return { ok: false, error: error.toPayload() };
  }
  return {
    ok: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: "Unexpected internal error.", retryable: false }
  };
}

export async function captureResult<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return success(await operation());
  } catch (error: unknown) {
    return failure(error);
  }
}

export function hasSystemErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
