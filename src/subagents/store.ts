import { randomUUID, createHash } from "node:crypto";
import { ValidationError } from "../shared/errors.js";
import type { DelegationPersistenceAdapter, DelegationRecord, DelegationSummary, SubagentTaskRequest, SubagentTaskResult } from "./types.js";

export class DelegationStore {
  private readonly records: DelegationRecord[] = [];
  public constructor(private readonly adapter?: DelegationPersistenceAdapter) {}
  private async append(record: DelegationRecord): Promise<void> {
    this.records.push(structuredClone(record));
    await this.adapter?.append(structuredClone(record));
  }
  public async start(coordinatorId: string, request: SubagentTaskRequest<unknown>): Promise<string> {
    if (this.records.some((record) => record.request.taskId === request.taskId)) throw new ValidationError("Task ID already delegated.");
    const delegationId = randomUUID();
    const snapshot = structuredClone(request);
    const context = snapshot.scopedContext;
    const logged = request.role === "patch-safety" && typeof context === "object" && context !== null && "unifiedDiff" in context
      ? { ...snapshot, scopedContext: { ...context, unifiedDiff: `[sha256:${createHash("sha256").update(String(context.unifiedDiff)).digest("hex")}]` } } : snapshot;
    await this.append({ delegationId, coordinatorId, request: logged, result: null, phase: "delegated", consumption: null, timestamp: new Date().toISOString() });
    return delegationId;
  }
  public async returned(delegationId: string, result: SubagentTaskResult<unknown>): Promise<void> {
    const record = this.latest(delegationId);
    if (record.phase !== "delegated" || record.request.taskId !== result.taskId || record.request.role !== result.role) throw new ValidationError("Invalid delegation result correlation.");
    await this.append({ ...record, phase: "returned", result, timestamp: new Date().toISOString() });
  }
  public async consume(taskId: string, decision: string, reason: string): Promise<void> {
    const record = [...this.records].reverse().find((entry) => entry.request.taskId === taskId);
    if (!record || !record.result) throw new ValidationError("Delegation must return before consumption.");
    const timestamp = new Date().toISOString();
    await this.append({ ...record, phase: "consumed", consumption: { decision, reason, timestamp }, timestamp });
  }
  private latest(id: string): DelegationRecord {
    const record = [...this.records].reverse().find((entry) => entry.delegationId === id);
    if (!record) throw new ValidationError("Unknown delegation.");
    return record;
  }
  public getDelegationLogs(): DelegationRecord[] { return structuredClone(this.records); }
  public getDelegationSummary(): DelegationSummary {
    const tasks = new Map(this.records.map((record) => [record.request.taskId, record]));
    const results = [...tasks.values()].flatMap((entry) => entry.result ? [entry.result] : []);
    return { tasks: tasks.size, completed: results.filter((result) => result.status === "completed").length,
      rejected: results.filter((result) => result.status === "rejected").length, failed: results.filter((result) => result.status === "failed").length,
      budgetExceeded: results.filter((result) => result.status === "budget_exceeded").length,
      toolCalls: results.reduce((sum, result) => sum + result.toolCallsExecuted.filter((call) => call.dispatched).length, 0) };
  }
}
export { DelegationStore as DelegationTraceLog };
export function getDelegationLogs(store: DelegationStore): DelegationRecord[] { return store.getDelegationLogs(); }
export function getDelegationSummary(store: DelegationStore): DelegationSummary { return store.getDelegationSummary(); }
