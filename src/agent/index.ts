import { parseContract } from "../shared/contracts.js";
import type { AgentRunResult, McpToolClient, ToolInput, ToolName, ToolOutput } from "../shared/contracts.js";
import { AgentError, captureResult } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import type { AgentRunInput, AgentOptions, RepairPlanner } from "./types.js";
import { AgentRunInputSchema, RepairPlanSchema } from "./types.js";

function requireSuccess<T>(result: Result<T>, operation: string): T {
  if (result.ok) return result.data;
  throw new AgentError(`${operation} failed: ${result.error.code}.`, { details: { operation, code: result.error.code } });
}

/**
 * Coordinates only validated MCP operations. The planner cannot write files or issue Git
 * commands directly: every mutation is guarded by the server's patch and verification rules.
 */
export class AutonomousRepairAgent {
  private readonly maxAttempts: number;

  public constructor(private readonly client: McpToolClient, private readonly planner: RepairPlanner, options: AgentOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 10) {
      throw new AgentError("maxAttempts must be an integer between 1 and 10.");
    }
  }

  private async call<T extends ToolName>(name: T, input: ToolInput<T>): Promise<ToolOutput<T>> {
    return requireSuccess(await this.client.callTool(name, input), name);
  }

  public async run(input: AgentRunInput, signal?: AbortSignal): Promise<AgentRunResult> {
    const request = parseContract(AgentRunInputSchema, input);
    const status = await this.call("git_status", {});
    if (!status.clean || status.headCommit === null || status.branch === null) {
      throw new AgentError("A clean repository with an attached commit is required before repair.");
    }
    if (signal?.aborted) return { status: "cancelled", sessionId: null, attempts: 0, commit: null, lastVerification: null };
    const baseline = await this.call("run_tests", {
      runner: request.runner, ...(request.targets === undefined ? {} : { targets: request.targets })
    });
    if (baseline.status !== "failed" || !baseline.complete || baseline.summary.failed === 0) {
      return { status: "not_needed", sessionId: null, attempts: 0, commit: null, lastVerification: null };
    }
    if (signal?.aborted) return { status: "cancelled", sessionId: null, attempts: 0, commit: null, lastVerification: null };
    const afterBaseline = await this.call("git_status", {});
    if (!afterBaseline.clean || afterBaseline.headCommit !== status.headCommit || afterBaseline.branch !== status.branch) {
      throw new AgentError("Repository changed while the baseline tests were running; no repair branch was created.");
    }
    const analysis = await this.call("analyze_code", request.analysis);
    if (signal?.aborted) return { status: "cancelled", sessionId: null, attempts: 0, commit: null, lastVerification: null };
    const session = await this.call("git_create_fix_branch", { slug: request.slug, expectedHead: status.headCommit });
    let lastVerification = null;
    for (let attemptNumber = 1; attemptNumber <= this.maxAttempts; attemptNumber++) {
      if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId, attempts: attemptNumber - 1, commit: null, lastVerification };
      const attempt = await this.call("git_begin_attempt", { sessionId: session.sessionId });
      let committed = false;
      try {
        if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId,
          attempts: attemptNumber - 1, commit: null, lastVerification };
        const relevantPaths = [...new Set([
          ...analysis.diagnostics.map((diagnostic) => diagnostic.path), ...analysis.affectedSymbols.map((symbol) => symbol.path)
        ])].slice(0, 10);
        const fileContexts = await Promise.all(relevantPaths.map((file) =>
          this.call("read_file_context", { path: file })));
        const plan = parseContract(RepairPlanSchema, await this.planner.propose({
          input: request, analysis, baseline, attempt, attemptNumber, fileContexts
        }));
        if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId,
          attempts: attemptNumber - 1, commit: null, lastVerification };
        await this.call("git_apply_patch", { sessionId: session.sessionId, attemptId: attempt.attemptId,
          unifiedDiff: plan.unifiedDiff, expectedFileHashes: plan.expectedFileHashes });
        if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId,
          attempts: attemptNumber, commit: null, lastVerification };
        const candidate = await this.call("run_tests", {
          runner: request.runner, ...(request.targets === undefined ? {} : { targets: request.targets })
        });
        if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId,
          attempts: attemptNumber, commit: null, lastVerification };
        const verification = await this.call("compare_test_runs", { baselineRunId: baseline.runId, candidateRunId: candidate.runId });
        lastVerification = verification;
        if (signal?.aborted) return { status: "cancelled", sessionId: session.sessionId,
          attempts: attemptNumber, commit: null, lastVerification };
        if (!signal?.aborted && candidate.status === "passed" && verification.verdict === "success") {
          const diff = await this.call("git_diff", { sessionId: session.sessionId, attemptId: attempt.attemptId });
          const commitResult = await this.call("git_commit_fix", { sessionId: session.sessionId, attemptId: attempt.attemptId,
            message: plan.summary, expectedDiffHash: diff.diffHash, verificationRunId: candidate.runId });
          committed = true;
          return { status: "fixed", sessionId: session.sessionId, attempts: attemptNumber, commit: commitResult.commit, lastVerification };
        }
      } finally {
        // A committed attempt is immutable; every other exit must restore its checkpoint.
        if (!committed) {
          const rollback = await this.call("git_rollback_attempt", { sessionId: session.sessionId, attemptId: attempt.attemptId });
          if (!rollback.clean) throw new AgentError("Rollback left workspace changes; manual review is required.");
        }
      }
    }
    return { status: "exhausted", sessionId: session.sessionId, attempts: this.maxAttempts, commit: null, lastVerification };
  }

  public runSafe(input: AgentRunInput, signal?: AbortSignal) {
    return captureResult(() => this.run(input, signal));
  }
}

export type { AgentOptions, AgentRunInput, RepairPlan, RepairPlanner, RepairPlanningContext } from "./types.js";
export { AnthropicRepairPlanner } from "./anthropic-planner.js";
export type { AnthropicPlannerOptions } from "./anthropic-planner.js";
export { SdkMcpToolClient } from "./mcp-tool-client.js";
export type { McpCallResult, McpClientTransport } from "./mcp-tool-client.js";
