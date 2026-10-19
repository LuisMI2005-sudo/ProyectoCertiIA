import type { VerificationEvidence } from "../shared/contracts.js";
import type { JsonValue } from "../shared/errors.js";

export type HookEvent = "pre:analyze" | "pre:apply_patch" | "pre:run_tests" | "pre:git_commit" |
  "post:test_run" | "post:commit" | "db:before_save_run" | "db:after_save_run" | "db:on_hook_decision";
export type HookDecision = "allow" | "block" | "warn";
export interface HookPayload {
  readonly files?: readonly string[];
  readonly unifiedDiff?: string;
  readonly branch?: string;
  readonly evidence?: VerificationEvidence;
  readonly workspaceStateHash?: string;
  readonly timestamp?: string;
  readonly execution?: HookExecutionResult;
}
export interface HookOutcome {
  readonly decision: HookDecision;
  readonly reason: string;
  readonly metadata?: Record<string, JsonValue>;
}
export interface HookExecutionResult {
  readonly hookId: string;
  readonly hookName: string;
  readonly event: HookEvent;
  readonly decision: "allow" | "block";
  readonly reason: string;
  readonly timestamp: string;
  readonly metadata: Record<string, JsonValue>;
  readonly durationMs: number;
}
export interface HookConfig {
  readonly enabled: boolean;
  readonly rules: Readonly<Record<string, boolean>>;
  readonly protectedFiles: readonly string[];
  readonly allowedBranches: readonly string[];
  readonly maxPatchCharacters: number;
  readonly maxFiles: number;
}
export interface HookDefinition {
  readonly id: string;
  readonly name: string;
  readonly events: readonly HookEvent[];
  /** Lower values execute first. Equal priorities preserve registration order. */
  readonly priority?: number;
  readonly execute: (payload: HookPayload, config: HookConfig, event: HookEvent) => HookOutcome | Promise<HookOutcome>;
}
/** Implement writes transactionally in a DB adapter. Never persist raw diffs or secrets. */
export interface HookPersistenceAdapter {
  appendExecution(execution: HookExecutionResult): Promise<void>;
  appendAudit(execution: HookExecutionResult): Promise<void>;
}
