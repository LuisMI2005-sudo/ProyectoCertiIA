import { performance } from "node:perf_hooks";
import { DevGuardianError, ErrorCode, ValidationError, captureResult } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import type { HookConfig, HookDefinition, HookEvent, HookExecutionResult, HookOutcome, HookPayload, HookPersistenceAdapter } from "./types.js";

export const DEFAULT_HOOK_CONFIG: HookConfig = {
  enabled: true, rules: {}, protectedFiles: [".env", ".env.*", "**/.env", "**/.env.*", ".github/workflows/**", "package-lock.json"],
  allowedBranches: ["fix/*"], maxPatchCharacters: 1_000_000, maxFiles: 200
};
export class HookExecutionLogStore {
  private readonly executions: HookExecutionResult[] = [];
  private readonly audits: HookExecutionResult[] = [];
  public constructor(private readonly adapter?: HookPersistenceAdapter) {}
  public async append(execution: HookExecutionResult): Promise<void> {
    this.executions.push(structuredClone(execution));
    await this.adapter?.appendExecution(structuredClone(execution));
  }
  public async audit(execution: HookExecutionResult): Promise<void> {
    this.audits.push(structuredClone(execution));
    await this.adapter?.appendAudit(structuredClone(execution));
  }
  public getHookLogs(): HookExecutionResult[] { return structuredClone(this.executions); }
  public getAuditLogs(): HookExecutionResult[] { return structuredClone(this.audits); }
  public getHookStats(): { total: number; allow: number; block: number } {
    return { total: this.executions.length, allow: this.executions.filter((log) => log.decision === "allow").length,
      block: this.executions.filter((log) => log.decision === "block").length };
  }
}
export class HookManager {
  private readonly hooks: HookDefinition[] = [];
  private readonly config: HookConfig;
  public readonly logStore: HookExecutionLogStore;
  public constructor(config: Partial<HookConfig> = {}, adapter?: HookPersistenceAdapter) {
    this.config = structuredClone({ ...DEFAULT_HOOK_CONFIG, ...config });
    for (const limit of [this.config.maxFiles, this.config.maxPatchCharacters]) {
      if (!Number.isSafeInteger(limit) || limit < 1) throw new ValidationError("Invalid hook safety limit.");
    }
    this.logStore = new HookExecutionLogStore(adapter);
  }
  public getConfig(): HookConfig { return structuredClone(this.config); }
  public register(hook: HookDefinition): void {
    if (!hook.id || this.hooks.some((entry) => entry.id === hook.id)) throw new ValidationError("Duplicate or empty hook ID.");
    this.hooks.push({ ...hook, events: [...hook.events] });
    this.hooks.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }
  public getHookLogs(): HookExecutionResult[] { return this.logStore.getHookLogs(); }
  public getHookStats(): ReturnType<HookExecutionLogStore["getHookStats"]> { return this.logStore.getHookStats(); }
  public async trigger(event: HookEvent, payload: HookPayload): Promise<Result<HookExecutionResult[]>> {
    return captureResult(async () => {
      const results: HookExecutionResult[] = [];
      const active = this.config.enabled ? this.hooks.filter((hook) => hook.events.includes(event) && this.config.rules[hook.id] !== false) : [];
      // Explicit approval also records events with no active rules, including disabled policy.
      const hooks: HookDefinition[] = active.length ? active : [{ id: "hook-manager", name: "Lifecycle event", events: [event],
        execute: () => ({ decision: "allow", reason: this.config.enabled ? "No active rules for event." : "Hooks disabled by configuration." }) }];
      for (const hook of hooks) {
        const started = performance.now();
        let outcome: HookOutcome;
        try {
          outcome = await hook.execute(structuredClone(payload), this.getConfig(), event);
          if (!["allow", "block", "warn"].includes(outcome.decision) || !outcome.reason) throw new Error("Invalid outcome");
        } catch {
          outcome = { decision: "block", reason: "Hook failed; operation blocked." };
        }
        const execution: HookExecutionResult = { hookId: hook.id, hookName: hook.name, event,
          decision: outcome.decision === "block" ? "block" : "allow", reason: outcome.reason,
          timestamp: new Date().toISOString(), durationMs: performance.now() - started,
          metadata: { ...outcome.metadata, warning: outcome.decision === "warn", config: this.getConfig() as unknown as import("../shared/errors.js").JsonValue,
            workspaceStateHash: payload.workspaceStateHash ?? null } };
        await this.logStore.append(execution);
        results.push(execution);
        // The audit event never dispatches itself, preventing recursive audit loops.
        if (event !== "db:on_hook_decision") {
          const audit = await this.trigger("db:on_hook_decision", { execution,
            timestamp: execution.timestamp, ...(payload.workspaceStateHash ? { workspaceStateHash: payload.workspaceStateHash } : {}) });
          if (!audit.ok) throw new DevGuardianError(audit.error.code, audit.error.message);
        }
        if (execution.decision === "block") throw new DevGuardianError(ErrorCode.VERIFICATION_FAILED, execution.reason,
          { details: { hookId: execution.hookId, event } });
      }
      return results;
    });
  }
  public async assertAllowed(event: HookEvent, payload: HookPayload): Promise<void> {
    const result = await this.trigger(event, payload);
    if (!result.ok) throw new DevGuardianError(result.error.code, result.error.message,
      { ...(result.error.details ? { details: result.error.details } : {}) });
  }
  /** Post events are notifications: failure must not misreport an already completed mutation. */
  public async notify(event: HookEvent, payload: HookPayload): Promise<Result<HookExecutionResult[]>> {
    return this.trigger(event, payload);
  }
}
export { HookManager as HookRegistry };
export function getHookLogs(manager: HookManager): HookExecutionResult[] { return manager.getHookLogs(); }
export function getHookStats(manager: HookManager): ReturnType<HookManager["getHookStats"]> { return manager.getHookStats(); }
