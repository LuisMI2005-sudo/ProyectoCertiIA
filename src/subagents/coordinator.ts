import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CodeAnalyzer } from "../analyzer/index.js";
import type { AnalyzerOptions } from "../analyzer/types.js";
import { GitController } from "../git-controller/index.js";
import { createHookManager } from "../hooks/index.js";
import type { HookManager } from "../hooks/registry.js";
import {
  AnalyzeCodeInputSchema, CompareTestRunsInputSchema, FileHashSchema, IdentifierSchema, ReadFileContextInputSchema,
  RelativePathSchema, RunnerSchema, RunTestsInputSchema, parseContract
} from "../shared/contracts.js";
import type { GitCommitFixOutput, RunnerConfiguration, RunTestsOutput } from "../shared/contracts.js";
import { DevGuardianError, ValidationError } from "../shared/errors.js";
import { TestRunner } from "../test-runner/index.js";
import { SubagentRuntime, validateTask } from "./runtime.js";
import type { ScopedToolHandlers } from "./runtime.js";
import { DelegationStore } from "./store.js";
import { PatchSafetyContextSchema, ROLE_TOOLS } from "./types.js";
import type {
  DelegationPersistenceAdapter, DiagnosticReport, RoleContexts, RoleOutputs, SubagentRole,
  SubagentTaskEnvelope, SubagentTaskResult, TaskBudget, VerificationVerdict
} from "./types.js";

/** Delegation host: packages contexts, dispatches workers and journals their results. */
export class AgentCoordinator {
  public readonly coordinatorId = randomUUID();
  public constructor(private readonly runtime: SubagentRuntime, public readonly hooks: HookManager,
    public readonly store: DelegationStore = new DelegationStore()) {}
  public async delegate<R extends SubagentRole>(raw: SubagentTaskEnvelope<R>): Promise<SubagentTaskResult<RoleOutputs[R]>> {
    const request = validateTask(raw);
    const delegationId = await this.store.start(this.coordinatorId, request);
    const delegation = { taskId: request.taskId, parentSessionId: request.parentSessionId, role: request.role };
    let result: SubagentTaskResult<RoleOutputs[R]>;
    try {
      await this.hooks.assertAllowed("pre:delegate", { delegation });
      result = await this.runtime.execute(request);
    } catch (error: unknown) {
      const timestamp = new Date().toISOString();
      result = { taskId: request.taskId, subagentId: randomUUID(), role: request.role, status: "rejected", output: null,
        reason: error instanceof DevGuardianError ? error.message : "Delegation could not start.",
        toolCallsExecuted: [], startedAt: timestamp, finishedAt: timestamp, durationMs: 0, workerThreadId: null };
    }
    await this.store.returned(delegationId, result);
    await this.hooks.notify("post:delegate", { delegation: { ...delegation, subagentId: result.subagentId } });
    return result;
  }
  public createTask<R extends SubagentRole>(role: R, parentSessionId: string, objective: string, scopedContext: RoleContexts[R],
    budget: TaskBudget = { maxToolCalls: 6, timeoutMs: 60_000 }): SubagentTaskEnvelope<R> {
    return { taskId: randomUUID(), parentSessionId, role, objective, scopedContext: structuredClone(scopedContext),
      allowedTools: [...ROLE_TOOLS[role]], budget: { ...budget } };
  }
}
export interface DevGuardianCoordinatorOptions {
  readonly workspaceRoot: string;
  readonly runners: readonly RunnerConfiguration[];
  readonly analyzer?: Omit<AnalyzerOptions, "workspaceRoot">;
  readonly hookManager?: HookManager;
  readonly delegationAdapter?: DelegationPersistenceAdapter;
  /** Trusted lifecycle observers; failures stop the repair before its next mutation. */
  readonly onTestRun?: (run: RunTestsOutput) => Promise<void>;
  readonly onAttemptStarted?: (attempt: { sessionId: string; attemptId: string; checkpointCommit: string; branch: string }) => Promise<void>;
}
export const RepairRequestSchema = z.strictObject({
  parentSessionId: IdentifierSchema.optional(), path: RelativePathSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(128), message: z.string().trim().min(1).max(4096),
  unifiedDiff: z.string().min(1).max(1_000_000), expectedFileHashes: z.record(RelativePathSchema, FileHashSchema),
  runner: RunnerSchema, targets: z.array(RelativePathSchema).min(1).max(200),
  budget: z.strictObject({ maxToolCalls: z.number().int().min(1).max(100), timeoutMs: z.number().int().min(1).max(300_000) }).optional()
}).refine((request) => Object.keys(request.expectedFileHashes).length === 1 && request.path in request.expectedFileHashes,
  "A repair is scoped to exactly the diagnosed file.");
export type RepairRequest = z.infer<typeof RepairRequestSchema>;
export interface CoordinatedRepairResult {
  readonly parentSessionId: string;
  readonly status: "committed" | "rolled_back" | "rejected" | "recovery_required";
  readonly diagnostic: DiagnosticReport | null;
  readonly verification: VerificationVerdict | null;
  readonly commit: GitCommitFixOutput | null;
  readonly reason: string;
}

export class DevGuardianCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private constructor(public readonly agent: AgentCoordinator, public readonly git: GitController,
    public readonly runner: TestRunner, private readonly onAttemptStarted?: DevGuardianCoordinatorOptions["onAttemptStarted"]) {}
  public get hooks(): HookManager { return this.agent.hooks; }
  public get delegationStore(): DelegationStore { return this.agent.store; }
  public static async create(options: DevGuardianCoordinatorOptions): Promise<DevGuardianCoordinator> {
    const hooks = options.hookManager ?? createHookManager();
    const analyzer = await CodeAnalyzer.create({ ...options.analyzer, workspaceRoot: options.workspaceRoot });
    let git: GitController;
    const runner = await TestRunner.create({ workspaceRoot: options.workspaceRoot, runners: options.runners,
      workspaceStateHash: () => git.workspaceStateHash() });
    git = await GitController.create({ workspaceRoot: options.workspaceRoot, verificationStore: runner, hookManager: hooks });
    const handlers: ScopedToolHandlers = {
      analyze_code: async (input) => {
        const parsed = parseContract(AnalyzeCodeInputSchema, input);
        await hooks.assertAllowed("pre:analyze", { files: parsed.paths });
        return analyzer.analyzeCode(parsed);
      },
      read_file_context: async (input) => analyzer.readFileContext(parseContract(ReadFileContextInputSchema, input)),
      run_tests: async (input, signal) => {
        const parsed = parseContract(RunTestsInputSchema, input);
        await hooks.assertAllowed("pre:run_tests", { files: parsed.targets ?? [] });
        signal.throwIfAborted();
        const result = await runner.runTests(parsed, signal);
        await options.onTestRun?.(structuredClone(result));
        await hooks.notify("post:test_run", { workspaceStateHash: result.workspaceStateHash, timestamp: result.finishedAt });
        return result;
      },
      compare_test_runs: async (input) => {
        const parsed = parseContract(CompareTestRunsInputSchema, input);
        // The domain comparison also stores the trusted evidence consumed by GitController.
        return runner.verify(parsed.baselineRunId, parsed.candidateRunId);
      },
      inspect_patch: async (input) => {
        const parsed = parseContract(PatchSafetyContextSchema, input);
        const result = await hooks.trigger("pre:apply_patch", parsed);
        return { allowed: result.ok, reason: result.ok ? "Patch preflight allowed; Git revalidates before applying." : result.error.message };
      }
    };
    return new DevGuardianCoordinator(new AgentCoordinator(new SubagentRuntime(handlers), hooks,
      new DelegationStore(options.delegationAdapter)), git, runner, options.onAttemptStarted);
  }
  public diagnose(path: string, parentSessionId: string = randomUUID(), budget?: TaskBudget): Promise<SubagentTaskResult<DiagnosticReport>> {
    return this.agent.delegate(this.agent.createTask("diagnostic", parentSessionId, "Locate and prioritize static defects in one target file.", { path }, budget));
  }
  public async repair(raw: RepairRequest): Promise<CoordinatedRepairResult> {
    const request = parseContract(RepairRequestSchema, raw);
    const previous = this.tail;
    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await this.repairSerialized(request); }
    finally { release(); }
  }
  private async repairSerialized(request: RepairRequest): Promise<CoordinatedRepairResult> {
    const parentSessionId = request.parentSessionId ?? randomUUID();
    let diagnostic: DiagnosticReport | null = null, verification: VerificationVerdict | null = null;
    let ids: { sessionId: string; attemptId: string } | null = null;
    let commit: GitCommitFixOutput | null = null;
    let activeTask: string | null = null;
    const result = (status: CoordinatedRepairResult["status"], reason: string): CoordinatedRepairResult => ({ parentSessionId, status, diagnostic, verification, commit, reason });
    try {
      const diagnosis = await this.diagnose(request.path, parentSessionId, request.budget);
      activeTask = diagnosis.taskId;
      diagnostic = diagnosis.output;
      if (diagnosis.status !== "completed" || !diagnostic?.remediationCandidate) {
        await this.delegationStore.consume(diagnosis.taskId, "stop", "No complete actionable diagnosis was returned.");
        return result("rejected", "Diagnostic delegation did not authorize a bounded repair.");
      }
      if (request.expectedFileHashes[request.path] !== diagnostic.snippet.fileHash) throw new ValidationError("Proposed patch does not match diagnosed source hash.");
      await this.delegationStore.consume(diagnosis.taskId, "prepare_repair", `Diagnosis ${diagnostic.analysisId} authorizes patching ${diagnostic.path}.`);
      const status = await this.git.status({});
      if (!status.headCommit) throw new ValidationError("Repair requires a committed baseline.");
      const session = await this.git.createFixBranch({ slug: request.slug, expectedHead: status.headCommit });
      const attempt = await this.git.beginAttempt({ sessionId: session.sessionId });
      ids = { sessionId: session.sessionId, attemptId: attempt.attemptId };
      await this.onAttemptStarted?.({ ...ids, checkpointCommit: attempt.checkpointCommit, branch: session.branch });
      const baseline = await this.agent.delegate(this.agent.createTask("verification", parentSessionId,
        "Capture failing baseline before any patch is applied.", { mode: "baseline", runner: request.runner, targets: request.targets }, request.budget));
      activeTask = baseline.taskId;
      if (baseline.status !== "completed" || !baseline.output) throw new ValidationError("Baseline delegation failed.");
      const baselineRun = this.runner.getRun(baseline.output.baselineRunId);
      if (!baselineRun.ok || !baselineRun.data.complete || baselineRun.data.status !== "failed" || baselineRun.data.summary.failed === 0 || baselineRun.data.truncated ||
          baselineRun.data.summary.skipped || baselineRun.data.summary.todo || baselineRun.data.workspaceStateHash !== await this.git.workspaceStateHash()) {
        throw new ValidationError("Baseline is incomplete, stale, skipped or has no failing tests.");
      }
      await this.delegationStore.consume(baseline.taskId, "apply_patch", `Baseline ${baseline.output.baselineRunId} captures the failing checkpoint.`);
      await this.git.applyPatch({ ...ids, unifiedDiff: request.unifiedDiff, expectedFileHashes: request.expectedFileHashes });
      const verified = await this.agent.delegate(this.agent.createTask("verification", parentSessionId,
        "Verify the patched candidate against the captured baseline and decide whether to commit.", {
          mode: "candidate", runner: request.runner, targets: request.targets, baselineRunId: baseline.output.baselineRunId
        }, request.budget));
      activeTask = verified.taskId;
      verification = verified.output;
      if (verified.status !== "completed" || verification?.verdict !== "ready_to_commit" || !verification.verificationId) {
        await this.git.rollbackAttempt(ids); ids = null;
        await this.delegationStore.consume(verified.taskId, "rolled_back", verification?.reason ?? verified.reason ?? "Verification did not authorize commit.");
        return result("rolled_back", verification?.reason ?? "Verification delegation failed; patch rolled back.");
      }
      await this.delegationStore.consume(verified.taskId, "commit_authorized", `Use trusted evidence ${verification.verificationId} for Git commit.`);
      const diff = await this.git.diff(ids);
      commit = await this.git.commitFix({ ...ids, message: request.message, expectedDiffHash: diff.diffHash, verificationRunId: verification.verificationId });
      ids = null;
      await this.delegationStore.consume(verified.taskId, "committed", `Committed ${commit.commit} after independent verification and commit hooks.`);
      return result("committed", "Delegated diagnosis and verification produced a verified commit.");
    } catch (error: unknown) {
      const reason = error instanceof DevGuardianError ? error.message : "Coordinated repair failed.";
      if (commit) return result("recovery_required", "Commit completed; delegation audit persistence requires recovery.");
      if (ids) {
        try { await this.git.rollbackAttempt(ids); }
        catch { return result("recovery_required", `${reason} Automatic rollback failed; inspect the active attempt.`); }
        if (activeTask) {
          try { await this.delegationStore.consume(activeTask, "rolled_back", reason); }
          catch { return result("recovery_required", `${reason} Patch restored; delegation audit persistence requires recovery.`); }
        }
        return result("rolled_back", reason);
      }
      if (activeTask) {
        try { await this.delegationStore.consume(activeTask, "stop", reason); } catch { /* Original error is retained. */ }
      }
      return result("rejected", reason);
    }
  }
}
export function createDevGuardianCoordinator(options: DevGuardianCoordinatorOptions): Promise<DevGuardianCoordinator> {
  return DevGuardianCoordinator.create(options);
}
