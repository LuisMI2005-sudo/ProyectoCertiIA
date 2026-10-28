import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { z } from "zod";
import { ToolSchemas, parseContract } from "../shared/contracts.js";
import { DevGuardianError, ErrorCode } from "../shared/errors.js";
import type { JsonValue } from "../shared/errors.js";
import {
  ContextSchemas, OutputSchemas, PatchSafetyContextSchema, ROLE_TOOLS, TaskEnvelopeSchema
} from "./types.js";
import type {
  RoleOutputs, SubagentRole, SubagentTaskEnvelope, SubagentTaskRequest, SubagentTaskResult, SubagentToolName, ToolCallRecord
} from "./types.js";

export class ToolScopeError extends DevGuardianError {
  public constructor(message: string) { super(ErrorCode.AGENT_ERROR, message); }
}
export class TaskBudgetError extends DevGuardianError {
  public constructor(message: string) { super(ErrorCode.EXECUTION_TIMEOUT, message); }
}
export type ScopedToolHandler = (input: unknown, signal: AbortSignal) => Promise<unknown>;
export type ScopedToolHandlers = Partial<Record<SubagentToolName, ScopedToolHandler>>;
export function validateTask<R extends SubagentRole>(input: SubagentTaskEnvelope<R>): SubagentTaskEnvelope<R> {
  const parsed = parseContract(TaskEnvelopeSchema, input);
  const scopedContext = parseContract(ContextSchemas[parsed.role], parsed.scopedContext);
  if (parsed.allowedTools.some((name) => !ROLE_TOOLS[parsed.role].includes(name as SubagentToolName))) {
    throw new ToolScopeError("Task requests tools outside its role.");
  }
  // The dynamic role selects the context schema above; TypeScript cannot correlate that indexed schema with R.
  return structuredClone({ ...parsed, scopedContext }) as unknown as SubagentTaskEnvelope<R>;
}
const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
/** Keep test stdout/stderr and source bodies out of the per-call journal. Final reports retain bounded snippets. */
function summarizeOutput(name: SubagentToolName, value: unknown): JsonValue {
  const data = value as Record<string, unknown>;
  const keys = name === "run_tests" ? ["runId", "status", "summary", "complete", "workspaceStateHash", "configurationHash"]
    : name === "analyze_code" ? ["analysisId", "analyzedFiles", "truncated"]
    : name === "read_file_context" ? ["path", "startLine", "endLine", "fileHash", "truncated"] : Object.keys(data);
  return json(Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])));
}
export class ScopedToolProxy {
  private readonly request: SubagentTaskRequest<unknown>;
  private readonly started = performance.now();
  private readonly calls: ToolCallRecord[] = [];
  private dispatched = 0;
  private candidateRunId: string | null = null;
  private failure: ToolScopeError | TaskBudgetError | null = null;
  public constructor(request: SubagentTaskEnvelope, private readonly handlers: ScopedToolHandlers,
    private readonly signal: AbortSignal = new AbortController().signal) { this.request = validateTask(request); }
  public getToolCalls(): ToolCallRecord[] { return structuredClone(this.calls); }
  public getViolation(): ToolScopeError | TaskBudgetError | null { return this.failure; }
  private assertContext(name: SubagentToolName, input: unknown): void {
    const data = input as Record<string, unknown>;
    if (this.request.role === "diagnostic") {
      const context = parseContract(ContextSchemas.diagnostic, this.request.scopedContext);
      if (name === "analyze_code" && context.checks && JSON.stringify(data.checks) !== JSON.stringify(context.checks))
        throw new ToolScopeError("Diagnostic checks differ from the requested scope.");
      if ((name === "analyze_code" && JSON.stringify(data.paths) !== JSON.stringify([context.path])) ||
          (name === "read_file_context" && data.path !== context.path)) throw new ToolScopeError("Diagnostic tool escaped the target path.");
    } else if (this.request.role === "verification") {
      const context = parseContract(ContextSchemas.verification, this.request.scopedContext);
      if (name === "run_tests" && (data.runner !== context.runner || JSON.stringify(data.targets) !== JSON.stringify(context.targets))) {
        throw new ToolScopeError("Verification tool escaped the runner or test targets.");
      }
      if (name === "compare_test_runs" && (context.mode !== "candidate" ||
          data.baselineRunId !== context.baselineRunId || !this.candidateRunId || data.candidateRunId !== this.candidateRunId)) {
        throw new ToolScopeError("Comparison must use this task's baseline and candidate.");
      }
    } else if (JSON.stringify(input) !== JSON.stringify(this.request.scopedContext)) {
      throw new ToolScopeError("Patch inspection escaped the supplied context.");
    }
  }
  public async call(name: SubagentToolName, input: unknown): Promise<unknown> {
    const started = performance.now(), startedAt = new Date().toISOString();
    let dispatched = false, status: ToolCallRecord["status"] = "failed", output: JsonValue | null = null, reason: string | null = null;
    try {
      if (this.failure) throw this.failure;
      if (!this.request.allowedTools.includes(name) || !ROLE_TOOLS[this.request.role].includes(name)) {
        throw new ToolScopeError(`Tool ${name} is forbidden for ${this.request.role}.`);
      }
      if (this.signal.aborted || performance.now() - this.started >= this.request.budget.timeoutMs ||
          this.dispatched >= this.request.budget.maxToolCalls) throw new TaskBudgetError("Subagent tool/time budget exceeded.");
      const parsed = name === "inspect_patch" ? parseContract(PatchSafetyContextSchema, input) : parseContract(ToolSchemas[name].input, input);
      this.assertContext(name, parsed);
      const handler = this.handlers[name];
      if (!handler) throw new ToolScopeError(`Tool ${name} has no authorized handler.`);
      this.dispatched += 1; dispatched = true;
      const result = await handler(structuredClone(parsed), this.signal);
      if (this.signal.aborted || performance.now() - this.started >= this.request.budget.timeoutMs) throw new TaskBudgetError("Subagent time budget exceeded.");
      const validated = name === "inspect_patch" ? parseContract(OutputSchemas["patch-safety"], result) : parseContract(ToolSchemas[name].output, result);
      if (name === "run_tests") this.candidateRunId = (validated as { runId: string }).runId;
      output = summarizeOutput(name, validated); status = "completed";
      return structuredClone(validated);
    } catch (error: unknown) {
      if (error instanceof ToolScopeError || error instanceof TaskBudgetError) {
        this.failure = error; status = error instanceof ToolScopeError ? "denied" : "budget_exceeded";
      }
      reason = error instanceof DevGuardianError ? error.message : "Domain tool failed.";
      throw error;
    } finally {
      // Denied input may contain a secret or an attempted write: never serialize it.
      this.calls.push({ callId: randomUUID(), tool: name, input: dispatched && name !== "inspect_patch" ? json(input) : null,
        status, output, reason, startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - started, dispatched });
    }
  }
}
const RpcRequestSchema = z.strictObject({ type: z.literal("tool"), id: z.number().int().nonnegative(), name: z.string(), input: z.unknown() });
const WorkerDoneSchema = z.strictObject({ type: z.literal("done"), output: z.unknown() });
const WorkerFailureSchema = z.strictObject({ type: z.literal("failed"), reason: z.string().max(4096) });

/** Each invocation creates a fresh worker. Only this host owns domain engines and tool permissions. */
export class SubagentRuntime {
  public constructor(private readonly handlers: ScopedToolHandlers) {}
  public async execute<R extends SubagentRole>(raw: SubagentTaskEnvelope<R>): Promise<SubagentTaskResult<RoleOutputs[R]>> {
    const started = performance.now(), startedAt = new Date().toISOString();
    const subagentId = randomUUID();
    let request: SubagentTaskEnvelope<R>;
    try { request = validateTask(raw); }
    catch (error: unknown) {
      return { taskId: raw.taskId, subagentId, role: raw.role, status: "rejected", output: null,
        reason: error instanceof DevGuardianError ? error.message : "Invalid task envelope.", toolCallsExecuted: [],
        startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - started, workerThreadId: null };
    }
    const controller = new AbortController();
    const proxy = new ScopedToolProxy(request, this.handlers, controller.signal);
    return new Promise((resolve) => {
      const worker = new Worker(new URL("./worker.js", import.meta.url), {
        workerData: request, env: {}, execArgv: [], stdout: true, stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: 64 }
      });
      const workerThreadId = worker.threadId;
      worker.stdout?.resume(); worker.stderr?.resume();
      const pending = new Set<Promise<void>>();
      let settled = false;
      const finish = async (status: SubagentTaskResult<unknown>["status"], output: unknown, reason: string | null): Promise<void> => {
        if (settled) return;
        settled = true; clearTimeout(timer); controller.abort();
        await worker.terminate();
        // Await cancellation/cleanup before the coordinator can roll back the workspace.
        await Promise.allSettled([...pending]);
        const violation = proxy.getViolation();
        const finalStatus = violation instanceof ToolScopeError ? "rejected" : violation instanceof TaskBudgetError ? "budget_exceeded" : status;
        resolve({ taskId: request.taskId, subagentId, role: request.role, status: finalStatus,
          output: finalStatus === "completed" ? output as RoleOutputs[R] : null, reason: violation?.message ?? reason,
          toolCallsExecuted: proxy.getToolCalls(), startedAt, finishedAt: new Date().toISOString(),
          durationMs: performance.now() - started, workerThreadId });
      };
      const timer = setTimeout(() => { void finish("budget_exceeded", null, "Subagent deadline exceeded."); }, request.budget.timeoutMs);
      worker.on("message", (message: unknown) => {
        if (settled) return;
        const call = RpcRequestSchema.safeParse(message);
        if (call.success) {
          const operation = (async () => {
            try {
              const output = await proxy.call(call.data.name as SubagentToolName, call.data.input);
              if (!settled) worker.postMessage({ type: "tool_result", id: call.data.id, ok: true, output });
            } catch (error: unknown) {
              if (!settled) worker.postMessage({ type: "tool_result", id: call.data.id, ok: false,
                reason: error instanceof DevGuardianError ? error.message : "Domain tool failed." });
            }
          })();
          pending.add(operation); void operation.finally(() => pending.delete(operation));
          return;
        }
        const done = WorkerDoneSchema.safeParse(message);
        if (done.success) {
          const parsed = OutputSchemas[request.role].safeParse(done.data.output);
          void finish(parsed.success ? "completed" : "failed", parsed.success ? parsed.data : null,
            parsed.success ? null : "Subagent output violated its role contract.");
          return;
        }
        const failed = WorkerFailureSchema.safeParse(message);
        void finish("failed", null, failed.success ? failed.data.reason : "Invalid subagent RPC message.");
      });
      worker.on("error", () => { void finish("failed", null, "Subagent worker failed."); });
      worker.on("exit", () => { if (!settled) void finish("failed", null, "Subagent exited without a result."); });
    });
  }
}
