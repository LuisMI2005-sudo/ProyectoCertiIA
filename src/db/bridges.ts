import { createHash, randomUUID } from "node:crypto";
import type { TestSandbox } from "../test-runner/types.js";
import { createHookManager } from "../hooks/index.js";
import type { HookConfig, HookExecutionResult, HookPersistenceAdapter } from "../hooks/types.js";
import { IdentifierSchema, parseContract } from "../shared/contracts.js";
import type { RunTestsOutput } from "../shared/contracts.js";
import { ValidationError } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { DevGuardianCoordinator, RepairRequestSchema } from "../subagents/coordinator.js";
import type { CoordinatedRepairResult, DevGuardianCoordinatorOptions, RepairRequest } from "../subagents/coordinator.js";
import { TaskEnvelopeSchema } from "../subagents/types.js";
import type { DelegationPersistenceAdapter, DelegationRecord } from "../subagents/types.js";
import { isActive, sameJson } from "./repository.js";
import { DatabaseError, ProjectRecordSchema, toJson } from "./types.js";
import type { AuditSessionRecord, DevGuardianRepository, ProjectRecord } from "./types.js";

function decisionId(auditId: string, execution: HookExecutionResult): string {
  const hex = createHash("sha256").update(auditId).update(JSON.stringify(execution)).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export class DatabaseHookPersistenceAdapter implements HookPersistenceAdapter {
  public constructor(private readonly repository: DevGuardianRepository, private readonly auditId: string) { parseContract(IdentifierSchema, auditId); }
  public async appendExecution(execution: HookExecutionResult): Promise<void> {
    await this.repository.saveHookLog({ id: decisionId(this.auditId, execution), auditId: this.auditId,
      hookId: execution.hookId, hookName: execution.hookName, event: execution.event,
      decision: execution.metadata["warning"] === true ? "warn" : execution.decision, reason: execution.reason,
      metadataJson: structuredClone(execution.metadata), durationMs: execution.durationMs, createdAt: execution.timestamp });
  }
  // Registry sends the same audit decision through both callbacks: deterministic IDs make retries idempotent.
  public appendAudit(execution: HookExecutionResult): Promise<void> { return this.appendExecution(execution); }
}
export class DatabaseDelegationPersistenceAdapter implements DelegationPersistenceAdapter {
  public constructor(private readonly repository: DevGuardianRepository) {}
  public async append(input: DelegationRecord): Promise<void> {
    const record = structuredClone(input);
    parseContract(TaskEnvelopeSchema, record.request);
    if (record.request.role === "patch-safety" && typeof record.request.scopedContext === "object" && record.request.scopedContext !== null &&
        "unifiedDiff" in record.request.scopedContext) {
      const diff = String(record.request.scopedContext.unifiedDiff);
      if (!/^\[sha256:[a-f0-9]{64}\]$/u.test(diff)) record.request.scopedContext.unifiedDiff = `[sha256:${createHash("sha256").update(diff).digest("hex")}]`;
    }
    const previous = await this.repository.getDelegation(record.request.taskId);
    const snapshot = toJson(record);
    if (previous && sameJson(previous.snapshots.at(-1), snapshot)) return;
    await this.repository.saveDelegation({ taskId: record.request.taskId, parentSessionId: record.request.parentSessionId,
      subagentId: record.result?.subagentId ?? null, role: record.request.role, status: record.result?.status ?? "delegated",
      objective: record.request.objective, scopedContextJson: toJson(record.request.scopedContext),
      toolCallsJson: (record.result?.toolCallsExecuted ?? []).map(toJson), outputJson: toJson(record.result?.output ?? null),
      consumptionStatus: record.consumption?.decision ?? null, durationMs: record.result?.durationMs ?? 0,
      startedAt: previous?.startedAt ?? record.result?.startedAt ?? record.timestamp, finishedAt: record.result?.finishedAt ?? null,
      phase: record.phase, snapshots: [...(previous?.snapshots ?? []), snapshot] });
  }
}
export interface PersistedRepairOptions {
  readonly sandbox?: TestSandbox;
  readonly runners: DevGuardianCoordinatorOptions["runners"];
  readonly analyzer?: DevGuardianCoordinatorOptions["analyzer"];
  readonly hookConfig?: Partial<HookConfig>;
}
export class AuditPersistenceService {
  public constructor(public readonly repository: DevGuardianRepository) {}
  public async registerProject(input: Omit<ProjectRecord, "id" | "createdAt">): Promise<ProjectRecord> {
    const parsed = parseContract(ProjectRecordSchema, { ...input, id: randomUUID(), createdAt: new Date().toISOString() });
    const guard = await WorkspacePathGuard.create(parsed.repoPath);
    return this.repository.createProject({ ...parsed, repoPath: guard.root });
  }
  public async beginAudit(projectId: string, targetFile: string, id: string = randomUUID()): Promise<AuditSessionRecord> {
    return this.repository.createAuditSession({ id, projectId, targetFile, status: "running", branchName: null,
      baselineRunId: null, candidateRunId: null, commitSha: null, startedAt: new Date().toISOString(), finishedAt: null, summaryJson: {} });
  }
  public async saveTestRun(auditId: string, run: RunTestsOutput): Promise<void> {
    const audit = await this.requiredAudit(auditId);
    if (!isActive(audit)) throw new ValidationError("Cannot add a test run to a finished audit.");
    // Logs may contain credentials printed by arbitrary tests. Keep structured cases, not raw streams.
    await this.repository.saveTestRun({ ...run, stdout: "", stderr: "", auditId, projectId: audit.projectId });
    await this.repository.saveAuditSession({ ...audit,
      baselineRunId: audit.baselineRunId ?? run.runId,
      candidateRunId: audit.baselineRunId === null || audit.baselineRunId === run.runId ? audit.candidateRunId : run.runId });
  }
  public async finishAudit(auditId: string, result: CoordinatedRepairResult): Promise<AuditSessionRecord> {
    const audit = await this.requiredAudit(auditId);
    if (result.parentSessionId !== auditId) throw new ValidationError("Repair result belongs to another audit.");
    const status = result.status === "committed" || result.status === "rolled_back" ? result.status
      : result.status === "rejected" ? "blocked" : "failed";
    return this.repository.saveAuditSession({ ...audit, status, commitSha: result.commit?.commit ?? null,
      branchName: result.commit?.branch ?? audit.branchName,
      baselineRunId: result.verification?.baselineRunId ?? audit.baselineRunId,
      candidateRunId: result.verification?.candidateRunId ?? audit.candidateRunId,
      finishedAt: new Date().toISOString(), summaryJson: { ...audit.summaryJson, result: toJson(result),
        findings: toJson(result.diagnostic?.findings ?? []) } });
  }
  /** Wires durable adapters and lifecycle observers before any Git mutation. No cloud account is required locally. */
  public async repairProject(projectId: string, raw: RepairRequest, options: PersistedRepairOptions): Promise<{ audit: AuditSessionRecord; result: CoordinatedRepairResult }> {
    const project = await this.repository.getProject(projectId);
    if (!project) throw new ValidationError("Unknown project.");
    const request = parseContract(RepairRequestSchema, raw);
    if (request.runner !== project.runnerType) throw new ValidationError("Repair runner does not match the registered project.");
    const audit = await this.beginAudit(projectId, request.path, request.parentSessionId);
    const hooks = createHookManager(options.hookConfig ?? {}, new DatabaseHookPersistenceAdapter(this.repository, audit.id));
    let result: CoordinatedRepairResult;
    try {
      const coordinator = await DevGuardianCoordinator.create({ workspaceRoot: project.repoPath, runners: options.runners,
        ...(options.sandbox ? { sandbox: options.sandbox } : {}),
        ...(options.analyzer ? { analyzer: options.analyzer } : {}), hookManager: hooks,
        delegationAdapter: new DatabaseDelegationPersistenceAdapter(this.repository),
        onTestRun: (run) => this.saveTestRun(audit.id, run),
        onAttemptStarted: async (attempt) => {
          const current = await this.requiredAudit(audit.id);
          await this.repository.saveAuditSession({ ...current, branchName: attempt.branch,
            summaryJson: { ...current.summaryJson, attempts: [toJson(attempt)] } });
        } });
      result = await coordinator.repair({ ...request, parentSessionId: audit.id });
    } catch {
      const current = await this.requiredAudit(audit.id);
      if (isActive(current)) await this.repository.saveAuditSession({ ...current, status: "failed", finishedAt: new Date().toISOString(),
        summaryJson: { ...current.summaryJson, persistenceError: "Coordinator initialization or execution failed; inspect recovery state." } });
      throw new DatabaseError("Audit execution failed; consult its persisted recovery state.");
    }
    // If this write fails after Git committed, propagate failure. Never retry the repair automatically.
    return { result, audit: await this.finishAudit(audit.id, result) };
  }
  public async getAuditDetails(auditId: string) {
    const audit = await this.requiredAudit(auditId);
    const [project, testRuns, hookLogs, delegations] = await Promise.all([
      this.repository.getProject(audit.projectId), this.repository.listTestRuns(auditId),
      this.repository.listHookLogs(auditId), this.repository.listDelegations(auditId)
    ]);
    return { project, audit, testRuns, hookLogs, delegations };
  }
  private async requiredAudit(id: string): Promise<AuditSessionRecord> {
    const audit = await this.repository.getAuditSession(id);
    if (!audit) throw new ValidationError("Unknown audit.");
    return audit;
  }
}
