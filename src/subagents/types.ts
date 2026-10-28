import { z } from "zod";
import {
  AnalyzeCodeInputSchema, DiagnosticSchema, FileHashSchema, IdentifierSchema, RelativePathSchema, RunnerSchema
} from "../shared/contracts.js";
import type { ToolName } from "../shared/contracts.js";
import type { JsonValue } from "../shared/errors.js";

export type SubagentRole = "diagnostic" | "verification" | "patch-safety";
export type SubagentToolName = ToolName | "inspect_patch";
export interface TaskBudget { readonly maxToolCalls: number; readonly timeoutMs: number }
export interface SubagentTaskRequest<TPayload> {
  readonly taskId: string;
  readonly parentSessionId: string;
  readonly role: SubagentRole;
  readonly objective: string;
  readonly scopedContext: TPayload;
  readonly allowedTools: readonly SubagentToolName[];
  readonly budget: TaskBudget;
}
export interface ToolCallRecord {
  readonly callId: string;
  readonly tool: SubagentToolName;
  readonly input: JsonValue;
  readonly status: "completed" | "denied" | "failed" | "budget_exceeded";
  readonly output: JsonValue | null;
  readonly reason: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  /** Denied attempts are visible but never dispatched to a domain service. */
  readonly dispatched: boolean;
}
export interface SubagentTaskResult<TOutput> {
  readonly taskId: string;
  readonly subagentId: string;
  readonly role: SubagentRole;
  readonly status: "completed" | "rejected" | "budget_exceeded" | "failed";
  readonly output: TOutput | null;
  readonly reason: string | null;
  readonly toolCallsExecuted: readonly ToolCallRecord[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly workerThreadId: number | null;
}
export const DiagnosticContextSchema = z.strictObject({ path: RelativePathSchema, checks: AnalyzeCodeInputSchema.shape.checks.optional() });
export const VerificationContextSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("baseline"), runner: RunnerSchema, targets: z.array(RelativePathSchema).min(1).max(200) }),
  z.strictObject({ mode: z.literal("candidate"), runner: RunnerSchema, targets: z.array(RelativePathSchema).min(1).max(200), baselineRunId: IdentifierSchema })
]);
export const PatchSafetyContextSchema = z.strictObject({
  files: z.array(RelativePathSchema).min(1).max(200), unifiedDiff: z.string().min(1).max(1_000_000)
});
export type DiagnosticContext = z.infer<typeof DiagnosticContextSchema>;
export type VerificationContext = z.infer<typeof VerificationContextSchema>;
export type PatchSafetyContext = z.infer<typeof PatchSafetyContextSchema>;
export const DiagnosticReportSchema = z.strictObject({
  path: RelativePathSchema, analysisId: IdentifierSchema,
  findings: z.array(DiagnosticSchema).max(10),
  snippet: z.strictObject({ content: z.string().max(100_000), startLine: z.number().int().positive(),
    endLine: z.number().int().nonnegative(), fileHash: FileHashSchema }),
  rootCause: z.string().min(1).max(100_000), remediationCandidate: z.boolean(), truncated: z.boolean()
});
export interface DiagnosticReport extends z.infer<typeof DiagnosticReportSchema> {}
export const VerificationVerdictSchema = z.strictObject({
  verdict: z.enum(["ready_to_commit", "regression_detected", "inconclusive"]),
  baselineRunId: IdentifierSchema, candidateRunId: IdentifierSchema.nullable(), verificationId: IdentifierSchema.nullable(),
  reason: z.string().min(1).max(4096)
}).refine((value) => value.verdict !== "ready_to_commit" ||
  (value.candidateRunId !== null && value.verificationId === value.candidateRunId), "Commit requires candidate evidence ID.");
export interface VerificationVerdict extends z.infer<typeof VerificationVerdictSchema> {}
export interface RoleContexts { diagnostic: DiagnosticContext; verification: VerificationContext; "patch-safety": PatchSafetyContext }
export interface RoleOutputs { diagnostic: DiagnosticReport; verification: VerificationVerdict; "patch-safety": { allowed: boolean; reason: string } }
export type SubagentTaskEnvelope<R extends SubagentRole = SubagentRole> = SubagentTaskRequest<RoleContexts[R]> & { readonly role: R };
export const ROLE_TOOLS: Readonly<Record<SubagentRole, readonly SubagentToolName[]>> = {
  diagnostic: ["analyze_code", "read_file_context"], verification: ["run_tests", "compare_test_runs"],
  "patch-safety": ["inspect_patch"]
};
export const TaskEnvelopeSchema = z.strictObject({
  taskId: IdentifierSchema, parentSessionId: IdentifierSchema, role: z.enum(["diagnostic", "verification", "patch-safety"]),
  objective: z.string().min(1).max(4096), scopedContext: z.unknown(),
  allowedTools: z.array(z.string()).max(12).refine((tools) => new Set(tools).size === tools.length),
  budget: z.strictObject({ maxToolCalls: z.number().int().min(1).max(100), timeoutMs: z.number().int().min(1).max(300_000) })
});
export const ContextSchemas = { diagnostic: DiagnosticContextSchema, verification: VerificationContextSchema, "patch-safety": PatchSafetyContextSchema };
export const OutputSchemas = { diagnostic: DiagnosticReportSchema, verification: VerificationVerdictSchema,
  "patch-safety": z.strictObject({ allowed: z.boolean(), reason: z.string().min(1).max(4096) }) };
export interface DelegationRecord {
  readonly delegationId: string;
  readonly coordinatorId: string;
  readonly request: SubagentTaskRequest<unknown>;
  readonly result: SubagentTaskResult<unknown> | null;
  readonly phase: "delegated" | "returned" | "consumed";
  readonly consumption: { readonly decision: string; readonly reason: string; readonly timestamp: string } | null;
  readonly timestamp: string;
}
export interface DelegationPersistenceAdapter { append(record: DelegationRecord): Promise<void> }
export interface DelegationSummary { tasks: number; completed: number; rejected: number; failed: number; budgetExceeded: number; toolCalls: number }
