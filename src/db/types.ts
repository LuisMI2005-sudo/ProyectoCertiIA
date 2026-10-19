import path from "node:path";
import { z } from "zod";
import { CommitHashSchema, IdentifierSchema, RelativePathSchema, RunnerSchema, RunTestsOutputSchema } from "../shared/contracts.js";
import { DevGuardianError, ErrorCode } from "../shared/errors.js";
import type { JsonValue } from "../shared/errors.js";

const Timestamp = z.iso.datetime();
const Text = z.string().min(1).max(4096).refine((value) => !value.includes("\0"));
export const JsonObjectSchema = z.record(z.string(), z.json());
export const AuditStatusSchema = z.enum(["pending", "running", "committed", "rolled_back", "blocked", "failed"]);
export const ProjectRecordSchema = z.strictObject({
  id: IdentifierSchema, name: Text, repoPath: Text.refine(path.isAbsolute, "Absolute repository path required."),
  defaultBranch: Text, runnerType: RunnerSchema, createdAt: Timestamp
});
export const AuditSessionRecordSchema = z.strictObject({
  id: IdentifierSchema, projectId: IdentifierSchema, status: AuditStatusSchema,
  targetFile: RelativePathSchema, branchName: Text.nullable(), baselineRunId: IdentifierSchema.nullable(),
  candidateRunId: IdentifierSchema.nullable(), commitSha: CommitHashSchema.nullable(),
  startedAt: Timestamp, finishedAt: Timestamp.nullable(), summaryJson: JsonObjectSchema
}).refine((row) => row.finishedAt === null || Date.parse(row.finishedAt) >= Date.parse(row.startedAt), "Audit timestamps are out of order.")
  .refine((row) => ["pending", "running"].includes(row.status) ? row.finishedAt === null : row.finishedAt !== null,
    "Terminal audits require a finish time; active audits cannot have one.")
  .refine((row) => row.status !== "committed" || (row.commitSha !== null && row.baselineRunId !== null && row.candidateRunId !== null),
    "Committed audits require a commit and both test runs.");
export const PersistedTestRunSchema = RunTestsOutputSchema.safeExtend({ projectId: IdentifierSchema, auditId: IdentifierSchema });
export const HookLogRecordSchema = z.strictObject({
  id: IdentifierSchema, auditId: IdentifierSchema, hookId: Text, hookName: Text,
  event: z.enum(["pre:analyze", "pre:apply_patch", "pre:run_tests", "pre:git_commit", "post:test_run", "post:commit",
    "db:before_save_run", "db:after_save_run", "db:on_hook_decision", "pre:delegate", "post:delegate"]),
  decision: z.enum(["allow", "block", "warn"]), reason: Text, metadataJson: JsonObjectSchema,
  durationMs: z.number().finite().nonnegative(), createdAt: Timestamp
});
export const SubagentDelegationRecordSchema = z.strictObject({
  taskId: IdentifierSchema, parentSessionId: IdentifierSchema, subagentId: IdentifierSchema.nullable(),
  role: z.enum(["diagnostic", "verification", "patch-safety"]),
  status: z.enum(["delegated", "completed", "rejected", "budget_exceeded", "failed"]),
  objective: Text, scopedContextJson: z.json(), toolCallsJson: z.array(z.json()), outputJson: z.json(),
  consumptionStatus: Text.nullable(), durationMs: z.number().finite().nonnegative(),
  startedAt: Timestamp, finishedAt: Timestamp.nullable(), phase: z.enum(["delegated", "returned", "consumed"]),
  snapshots: z.array(z.json()).min(1)
}).refine((row) => row.phase === "delegated"
  ? row.status === "delegated" && row.subagentId === null && row.finishedAt === null
  : row.status !== "delegated" && row.subagentId !== null && row.finishedAt !== null,
"Delegation phase, result and timestamps must agree.")
  .refine((row) => (row.phase === "consumed") === (row.consumptionStatus !== null), "Only consumed delegations have a consumption decision.")
  .refine((row) => row.finishedAt === null || Date.parse(row.finishedAt) >= Date.parse(row.startedAt), "Delegation timestamps are out of order.");
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type AuditSessionRecord = z.infer<typeof AuditSessionRecordSchema>;
export type PersistedTestRun = z.infer<typeof PersistedTestRunSchema>;
export type HookLogRecord = z.infer<typeof HookLogRecordSchema>;
export type SubagentDelegationRecord = z.infer<typeof SubagentDelegationRecordSchema>;

/** Domain methods throw sanitized typed errors; tools may wrap them with captureResult. */
export interface DevGuardianRepository {
  createProject(record: ProjectRecord): Promise<ProjectRecord>;
  getProject(id: string): Promise<ProjectRecord | null>;
  listProjects(): Promise<ProjectRecord[]>;
  createAuditSession(record: AuditSessionRecord): Promise<AuditSessionRecord>;
  saveAuditSession(record: AuditSessionRecord): Promise<AuditSessionRecord>;
  getAuditSession(id: string): Promise<AuditSessionRecord | null>;
  listAuditSessions(projectId: string): Promise<AuditSessionRecord[]>;
  saveTestRun(record: PersistedTestRun): Promise<PersistedTestRun>;
  getTestRun(runId: string): Promise<PersistedTestRun | null>;
  listTestRuns(auditId: string): Promise<PersistedTestRun[]>;
  saveHookLog(record: HookLogRecord): Promise<HookLogRecord>;
  listHookLogs(auditId: string): Promise<HookLogRecord[]>;
  saveDelegation(record: SubagentDelegationRecord): Promise<SubagentDelegationRecord>;
  getDelegation(taskId: string): Promise<SubagentDelegationRecord | null>;
  listDelegations(parentSessionId: string): Promise<SubagentDelegationRecord[]>;
  close(): Promise<void>;
}
export class DatabaseError extends DevGuardianError {
  public constructor(message = "Database operation failed.") { super(ErrorCode.INTERNAL_ERROR, message); }
}
export function toJson(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue; }
export interface SqlResult { readonly rows: Record<string, unknown>[] }
export interface SqlConnection {
  query(text: string, values?: readonly unknown[]): Promise<SqlResult>;
  release(): void;
}
export interface SqlPool { connect(): Promise<SqlConnection>; end(): Promise<void> }
