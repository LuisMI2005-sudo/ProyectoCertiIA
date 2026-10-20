import { randomUUID } from "node:crypto";
import { RelativePathSchema, parseContract } from "../shared/contracts.js";
import { DevGuardianError, ErrorCode, ValidationError } from "../shared/errors.js";
import { AgentConfigSchema, PatchProposalSchema } from "./types.js";
import type { AgentConfig, AgentConfigInput, AgentExecutionResult, AgentHistoryEntry, AgentState, HookDecisionCaught,
  PatchPlanner, PatchProposal, StdioConnectionOptions, StructuredPatchModel } from "./types.js";
import { McpClientAdapter, McpOutcomeUnknownError, McpToolError } from "./mcp-bridge.js";
import { RepairPlanner, sanitizeFeedback } from "./planner.js";

const TRANSITIONS: Record<AgentState, readonly AgentState[]> = {
  idle: ["analyzing", "failed"], analyzing: ["baseline_testing", "failed"],
  baseline_testing: ["generating_patch", "failed"], generating_patch: ["applying_patch", "rolled_back", "failed"],
  applying_patch: ["verifying_candidate", "rolled_back", "failed"], verifying_candidate: ["committed", "rolled_back", "failed"],
  rolled_back: ["analyzing", "failed"], committed: [], failed: []
};
export function isAuthorizedSourcePath(target: string): boolean {
  return RelativePathSchema.safeParse(target).success && /^[A-Za-z0-9_./-]+\.(?:[cm]?[jt]s|[jt]sx)$/u.test(target) &&
    !target.toLowerCase().split("/").some((part) => [".git", ".github", "node_modules", "dist", "test", "tests", "__tests__"].includes(part) || /^\.env(?:\.|$)/u.test(part)) &&
    !/\.(?:test|spec)\.[^.]+$/iu.test(target);
}
function patchLines(text: string, prefix: string): string {
  return (text.match(/[^\n]*\n|[^\n]+$/gu) ?? []).map((line) => prefix + line +
    (line.endsWith("\n") ? "" : "\n\\ No newline at end of file\n")).join("");
}
/** Full-file text diff, preserving CRLF and missing final newlines; the server revalidates applicability. */
export function buildReplacementDiff(target: string, before: string, after: string): string {
  if (!isAuthorizedSourcePath(target) || before === after) throw new ValidationError("Replacement must change the authorized source file.");
  const count = (text: string): number => (text.match(/[^\n]*\n|[^\n]+$/gu) ?? []).length;
  const oldCount = count(before), newCount = count(after);
  return `diff --git a/${target} b/${target}\n--- a/${target}\n+++ b/${target}\n` +
    `@@ -${oldCount ? 1 : 0},${oldCount} +${newCount ? 1 : 0},${newCount} @@\n` + patchLines(before, "-") + patchLines(after, "+");
}
export function proposalDiff(raw: PatchProposal, target: string, source: string): string {
  const proposal = parseContract(PatchProposalSchema, raw);
  if (proposal.targetPath !== target) throw new ValidationError("Policy: proposal must modify only the authorized targetPath.");
  if (proposal.replacementCode !== undefined) return buildReplacementDiff(target, source, proposal.replacementCode);
  const diff = proposal.unifiedDiff ?? "";
  const lines = diff.split("\n");
  const headers = lines.filter((line) => /^(?:diff --git |--- |\+\+\+ )/u.test(line));
  if (headers.length !== 3 || headers[0] !== `diff --git a/${target} b/${target}` ||
      headers[1] !== `--- a/${target}` || headers[2] !== `+++ b/${target}` || diff.includes("\0") ||
      /^(?:new file mode|deleted file mode|old mode|new mode|rename |copy |GIT binary|Binary files)/mu.test(diff)) {
    throw new ValidationError("Policy: diff must be a single existing source file with no mode or path changes.");
  }
  return diff;
}
export interface AgentDependencies {
  readonly bridge?: McpClientAdapter; readonly planner?: PatchPlanner; readonly model?: StructuredPatchModel;
  readonly stdio?: StdioConnectionOptions;
}
export class DevGuardianAgent {
  private state: AgentState = "idle";
  private started = false;
  private readonly history: AgentHistoryEntry[] = [];
  private readonly decisions: HookDecisionCaught[] = [];
  private readonly feedback: string[] = [];
  private attempts = 0;
  private recoveryRequired = false;
  private constructor(public readonly config: AgentConfig, public readonly bridge: McpClientAdapter,
    private readonly planner: PatchPlanner) {}
  public static async create(raw: AgentConfigInput, dependencies: AgentDependencies = {}): Promise<DevGuardianAgent> {
    const config = parseContract(AgentConfigSchema, raw);
    if (!isAuthorizedSourcePath(config.targetPath)) throw new ValidationError("Target must be an authorized application source file, outside tests/dependencies/configuration.");
    const bridge = dependencies.bridge ?? await McpClientAdapter.connect(config, dependencies.stdio);
    if (bridge.config.projectId !== config.projectId || bridge.config.targetPath !== config.targetPath) throw new ValidationError("Agent and MCP project scope differ.");
    return new DevGuardianAgent(config, bridge, dependencies.planner ?? new RepairPlanner(config, dependencies.model));
  }
  private move(next: AgentState, message: string): void {
    if (!TRANSITIONS[this.state].includes(next)) throw new ValidationError("Invalid agent state transition.");
    this.state = next; this.history.push({ state: next, attempt: this.attempts, message: this.safe(message), timestamp: new Date().toISOString() });
  }
  private safe(message: string): string {
    let text = message;
    for (const secret of [this.config.apiKey, this.config.apiToken, process.env["ANTHROPIC_API_KEY"]]) {
      if (secret) text = text.replaceAll(secret, "[REDACTED]");
    }
    return sanitizeFeedback(text);
  }
  private note(message: string): void { this.feedback.push(this.safe(message)); }
  private currentState(): AgentState { return this.state; }
  private async restore(): Promise<void> {
    const id = this.bridge.activeAttemptId;
    if (!id) return;
    const restored = await this.bridge.rollback(id);
    if (!restored.clean) { this.recoveryRequired = true; throw new ValidationError("Rollback preserved external work; automatic retries stopped."); }
    this.move("rolled_back", "Attempt restored to its checkpoint; HEAD preserved.");
  }
  public async run(signal?: AbortSignal): Promise<AgentExecutionResult> {
    if (this.started) throw new ValidationError("An agent instance executes exactly once.");
    this.started = true;
    const started = performance.now();
    this.history.push({ state: "idle", attempt: 0, message: "Agent initialized with fixed project and target scope.", timestamp: new Date().toISOString() });
    const deadline = AbortSignal.timeout(this.config.maxDurationMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const check = (): void => combined.throwIfAborted();
    let commitSha: string | undefined;
    try {
      check(); const initial = await this.bridge.status();
      if (!initial.clean || !initial.headCommit || !initial.branch) throw new ValidationError("A clean repository on an attached committed branch is required.");
      const initialHead = initial.headCommit;
      for (let index = 0; index < this.config.maxAttempts; index += 1) {
        check(); this.move("analyzing", "Reading bounded diagnostics and the authorized source through MCP.");
        const context = await this.bridge.runAnalysis(this.config.targetPath);
        if (context.source.truncated || context.source.content.length > this.config.maxContextCharacters || context.analysis.truncated) {
          throw new ValidationError("Analysis or source exceeds the agent context budget.");
        }
        check(); this.move("baseline_testing", "Capturing a fresh failing baseline with the configured test targets.");
        const baseline = await this.bridge.runBaseline(this.config.runner, [...this.config.targets]);
        if (!baseline.complete || baseline.status !== "failed" || !baseline.summary.failed || baseline.truncated ||
            baseline.summary.skipped || baseline.summary.todo) throw new ValidationError("Baseline must be complete, failing and free of skipped/todo tests.");
        check(); const status = await this.bridge.status();
        if (status.headCommit !== initialHead || !status.clean) throw new ValidationError("Workspace changed since diagnosis/baseline.");
        await this.bridge.prepareAttempt(`agent-${randomUUID()}`);
        this.attempts += 1;
        this.move("generating_patch", "Requesting a structured proposal; system IDs and hashes remain outside model control.");
        try {
          check(); const proposal = await this.planner.plan({ ...context, targetPath: this.config.targetPath,
            baseline, feedback: [...this.feedback], attempt: this.attempts }, combined);
          check(); const diff = proposalDiff(proposal, this.config.targetPath, context.source.content);
          this.move("applying_patch", "Applying a single-file proposal through hash validation and server hooks.");
          const id = this.bridge.activeAttemptId;
          if (!id) throw new ValidationError("Attempt was lost before patch application.");
          await this.bridge.applyProposedPatch(id, this.config.targetPath, diff, context.source.fileHash);
          check(); this.move("verifying_candidate", "Running the same test targets and registering trusted comparison evidence.");
          const candidate = await this.bridge.runCandidate(this.config.runner, [...this.config.targets]);
          const comparison = await this.bridge.verifyCandidate(baseline.runId, candidate.runId);
          check();
          const green = candidate.complete && candidate.status === "passed" && !candidate.truncated &&
            candidate.summary.skipped === 0 && candidate.summary.todo === 0 && comparison.comparable &&
            comparison.verdict === "success" && comparison.resolvedFailures.length > 0 &&
            comparison.newFailures.length === 0 && comparison.missingTests.length === 0;
          if (green) {
            const commit = await this.bridge.commitSuccess(candidate.runId, `fix: repair ${this.config.targetPath} with verified tests`);
            commitSha = commit.commit;
            this.move("committed", "Server confirmed a commit using the candidate runId and the current diffHash."); break;
          }
          this.note(`Candidate rejected: ${comparison.verdict}. ${candidate.cases.filter((entry) => entry.status === "failed")
            .slice(0, 5).map((entry) => `${entry.name}: ${entry.failureMessage ?? "failed"}`).join("; ") || candidate.status}`);
          await this.restore();
        } catch (error: unknown) {
          if (this.recoveryRequired || error instanceof McpOutcomeUnknownError || error instanceof McpToolError && error.code === ErrorCode.INTERNAL_ERROR) {
            this.recoveryRequired = true; throw error;
          }
          if (error instanceof McpToolError) {
            const evidence = await this.bridge.hookEvidence(error);
            for (const entry of evidence) this.decisions.push({ ...entry, reason: this.safe(entry.reason) });
            if (evidence.length) this.note(`POLICY BLOCK: ${evidence.map((entry) => entry.reason).join("; ")}. Replan within the authorized file without bypassing hooks.`);
            else this.note(`Tool rejected proposal: ${error.code}. ${error.message}`);
          } else this.note(error instanceof DevGuardianError ? error.message : "Model proposal failed validation or planning.");
          try { await this.restore(); }
          catch { this.recoveryRequired = true; throw new ValidationError("Rollback could not safely restore the attempt; manual recovery is required."); }
          check();
        }
        if (index === this.config.maxAttempts - 1) this.move("failed", "Repair attempt budget exhausted; all owned changes were rolled back.");
      }
    } catch (error: unknown) {
      if (error instanceof McpOutcomeUnknownError) this.recoveryRequired = true;
      if (!this.recoveryRequired && this.bridge.activeAttemptId) {
        try { await this.restore(); } catch { this.recoveryRequired = true; }
      }
      if (!["committed", "failed"].includes(this.currentState())) this.move("failed", error instanceof DevGuardianError
        ? error.message : "Execution cancelled or its time budget expired.");
    }
    return { success: this.currentState() === "committed", finalState: this.currentState(), attemptsUsed: this.attempts,
      ...(this.bridge.lastAuditId ? { auditId: this.bridge.lastAuditId } : {}), ...(commitSha ? { commitSha } : {}),
      history: structuredClone(this.history), hookDecisionsCaught: structuredClone(this.decisions),
      durationMs: Math.round(performance.now() - started), recoveryRequired: this.recoveryRequired };
  }
  public close(): Promise<void> { return this.bridge.close(); }
}
export const createDevGuardianAgent = (config: AgentConfigInput, dependencies?: AgentDependencies): Promise<DevGuardianAgent> =>
  DevGuardianAgent.create(config, dependencies);
