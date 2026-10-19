import { matchesGlob } from "node:path";
import { CompareTestRunsOutputSchema, FileHashSchema, RunTestsOutputSchema, TimestampSchema } from "../shared/contracts.js";
import { isWorkspaceRelativePath } from "../shared/path-security.js";
import type { HookDefinition, HookOutcome } from "./types.js";
import type { HookManager } from "./registry.js";
const allow = (reason: string): HookOutcome => ({ decision: "allow", reason });
const block = (reason: string): HookOutcome => ({ decision: "block", reason });

export const ProtectedFilesAndSecretsGuardHook: HookDefinition = {
  id: "protected-files-and-secrets", name: "ProtectedFilesAndSecretsGuardHook", priority: 10,
  events: ["pre:apply_patch", "pre:git_commit"],
  execute(payload, config, event) {
    const files = payload.files;
    if (!files?.length || typeof payload.unifiedDiff !== "string") return block("File list and diff are required.");
    if (files.length > config.maxFiles || payload.unifiedDiff.length > config.maxPatchCharacters) return block("Patch safety limit exceeded.");
    for (const file of files) {
      if (!isWorkspaceRelativePath(file) || file.includes("\\")) return block("Unsafe patch path.");
      if (config.protectedFiles.some((pattern) => matchesGlob(file.toLowerCase(), pattern.toLowerCase()))) return block(`Protected file: ${file}`);
    }
    if (event === "pre:git_commit" && config.allowedBranches.length &&
        (!payload.branch || !config.allowedBranches.some((pattern) => matchesGlob(payload.branch ?? "", pattern)))) return block("Commit branch is not allowed.");
    const added = payload.unifiedDiff.split(/\r?\n/u).filter((line) => line.startsWith("+") && !line.startsWith("+++ ")).join("\n");
    if (/AKIA[A-Z0-9]{16}|SECRET_KEY\s*=|(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)\s*[:=]\s*["'][^"'\r\n]+["']|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/iu.test(added)) {
      return block("Secret pattern detected in added content.");
    }
    return allow("Files and added content satisfy guardrails.");
  }
};
export const VerifiedEvidenceCommitHook: HookDefinition = {
  id: "verified-evidence-commit", name: "VerifiedEvidenceCommitHook", priority: 20, events: ["pre:git_commit"],
  execute({ evidence, workspaceStateHash }) {
    if (!evidence || !RunTestsOutputSchema.safeParse(evidence.baseline).success ||
        !RunTestsOutputSchema.safeParse(evidence.candidate).success ||
        !CompareTestRunsOutputSchema.safeParse(evidence.comparison).success) return block("Verified test evidence is missing or invalid.");
    const { baseline, candidate, comparison } = evidence;
    const cases = new Map(candidate.cases.map((test) => [test.id, test]));
    const resolved = baseline.cases.filter((test) => test.status === "failed" && cases.get(test.id)?.status === "passed");
    if (!baseline.complete || baseline.status !== "failed" || !candidate.complete || candidate.status !== "passed" ||
        candidate.summary.skipped !== 0 || candidate.summary.todo !== 0 || candidate.truncated ||
        candidate.workspaceStateHash !== workspaceStateHash || baseline.configurationHash !== candidate.configurationHash ||
        baseline.runner !== candidate.runner || baseline.runId === candidate.runId || !comparison.comparable ||
        comparison.verdict !== "success" || comparison.newFailures.length || comparison.missingTests.length ||
        !resolved.length || resolved.length !== comparison.resolvedFailures.length ||
        resolved.some((test) => !comparison.resolvedFailures.includes(test.id)) ||
        baseline.cases.some((test) => { const current = cases.get(test.id); return current?.status !== "passed" ||
          current.path !== test.path || current.name !== test.name; })) return block("Evidence is incomplete, stale, skipped or reports regression.");
    return allow("Complete green evidence verified without regressions or skipped tests.");
  }
};
export function DatabaseAuditTrailHook(manager: HookManager): HookDefinition {
  return { id: "database-audit-trail", name: "DatabaseAuditTrailHook", priority: 0,
    events: ["db:before_save_run", "db:on_hook_decision"],
    async execute(payload, _config, event) {
      if (!TimestampSchema.safeParse(payload.timestamp).success ||
          (event === "db:before_save_run" && !FileHashSchema.safeParse(payload.workspaceStateHash).success)) {
        return block("Persistence requires valid workspaceStateHash and timestamp.");
      }
      if (event === "db:on_hook_decision") {
        if (!payload.execution) return block("Audit decision is missing.");
        await manager.logStore.audit(payload.execution);
      }
      return allow(event === "db:on_hook_decision" ? "Decision audit recorded." : "Run entity integrity verified.");
    }
  };
}
export function registerDefaultHooks(manager: HookManager): HookManager {
  manager.register(ProtectedFilesAndSecretsGuardHook);
  manager.register(VerifiedEvidenceCommitHook);
  manager.register(DatabaseAuditTrailHook(manager));
  return manager;
}
