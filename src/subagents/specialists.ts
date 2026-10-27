import { parseContract, AnalyzeCodeOutputSchema, ReadFileContextOutputSchema, RunTestsOutputSchema, CompareTestRunsOutputSchema } from "../shared/contracts.js";
import type { SubagentToolName, DiagnosticContext, DiagnosticReport, VerificationContext, VerificationVerdict, PatchSafetyContext } from "./types.js";
import { OutputSchemas } from "./types.js";

/** Worker-side capability client. No analyzer, runner, Git controller or global session is available here. */
export interface SubagentToolClient { call(name: SubagentToolName, input: unknown): Promise<unknown> }
export class DiagnosticSubagent {
  public readonly role = "diagnostic";
  public async execute(context: DiagnosticContext, tools: SubagentToolClient): Promise<DiagnosticReport> {
    const analysis = parseContract(AnalyzeCodeOutputSchema, await tools.call("analyze_code", {
      paths: [context.path], checks: context.checks ?? ["syntax", "semantic", "lint"]
    }));
    const rank = { error: 0, warning: 1, info: 2 };
    const findings = analysis.diagnostics.filter((entry) => entry.path === context.path)
      .sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 10);
    const first = findings.find((entry) => entry.range !== null);
    const line = first?.range?.start.line ?? 1;
    const source = parseContract(ReadFileContextOutputSchema, await tools.call("read_file_context", {
      path: context.path, startLine: Math.max(1, line - 1), endLine: Math.max(line, first?.range?.end.line ?? line) + 1
    }));
    const remediationCandidate = findings.some((finding) => finding.severity === "error") && !analysis.truncated && !source.truncated;
    return { path: context.path, analysisId: analysis.analysisId, findings,
      snippet: { content: source.content, startLine: source.startLine, endLine: source.endLine, fileHash: source.fileHash },
      rootCause: findings[0]?.message ?? "Static analysis found no localized cause; behavioral evidence is required.",
      remediationCandidate, truncated: analysis.truncated || source.truncated };
  }
}
export class VerificationSubagent {
  public readonly role = "verification";
  public async execute(context: VerificationContext, tools: SubagentToolClient): Promise<VerificationVerdict> {
    const run = parseContract(RunTestsOutputSchema, await tools.call("run_tests", { runner: context.runner, targets: context.targets }));
    if (context.mode === "baseline") {
      return { verdict: "inconclusive", baselineRunId: run.runId, candidateRunId: null, verificationId: null,
        reason: run.complete && run.status === "failed" && run.summary.failed > 0 && !run.truncated && run.summary.skipped === 0 && run.summary.todo === 0
          ? "Failing baseline captured before patching." : "Baseline is not a complete failing run without skipped tests." };
    }
    const comparison = parseContract(CompareTestRunsOutputSchema, await tools.call("compare_test_runs", {
      baselineRunId: context.baselineRunId, candidateRunId: run.runId
    }));
    const green = run.status === "passed" && run.complete && !run.truncated && run.summary.skipped === 0 && run.summary.todo === 0;
    const regression = comparison.verdict === "regression" || run.summary.skipped > 0 || run.summary.todo > 0;
    const verdict = regression ? "regression_detected" : green && comparison.verdict === "success" ? "ready_to_commit" : "inconclusive";
    return { verdict, baselineRunId: context.baselineRunId, candidateRunId: run.runId,
      verificationId: verdict === "ready_to_commit" ? run.runId : null,
      reason: verdict === "ready_to_commit" ? "All tests pass; baseline failures resolved with no regressions or omissions."
        : regression ? "Regression, missing tests or skipped tests detected." : "Evidence does not prove a complete repair." };
  }
}
export class PatchSafetySubagent {
  public readonly role = "patch-safety";
  public async execute(context: PatchSafetyContext, tools: SubagentToolClient): Promise<{ allowed: boolean; reason: string }> {
    return parseContract(OutputSchemas["patch-safety"], await tools.call("inspect_patch", context));
  }
}
