import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { IdentifierSchema, parseContract } from "../shared/contracts.js";
import { ValidationError } from "../shared/errors.js";
import {
  AuditSessionRecordSchema, DatabaseError, HookLogRecordSchema, PersistedTestRunSchema, ProjectRecordSchema,
  SubagentDelegationRecordSchema
} from "./types.js";
import type { AuditSessionRecord, DevGuardianRepository, HookLogRecord, PersistedTestRun, ProjectRecord, SubagentDelegationRecord } from "./types.js";

export const EntitySchemas: { [K in keyof Entities]: z.ZodType<Entities[K]> } = {
  projects: ProjectRecordSchema, audit_sessions: AuditSessionRecordSchema, test_runs: PersistedTestRunSchema,
  hook_logs: HookLogRecordSchema, subagent_delegations: SubagentDelegationRecordSchema
};
export interface Entities {
  projects: ProjectRecord; audit_sessions: AuditSessionRecord; test_runs: PersistedTestRun;
  hook_logs: HookLogRecord; subagent_delegations: SubagentDelegationRecord;
}
export type Table = keyof Entities;
export const TABLES = Object.keys(EntitySchemas) as Table[];
export const EntityId: { [K in Table]: keyof Entities[K] & string } = { projects: "id", audit_sessions: "id", test_runs: "runId", hook_logs: "id", subagent_delegations: "taskId" };
export type Filter = { readonly field: "projectId" | "auditId" | "parentSessionId"; readonly value: string };
export interface Transaction {
  get<T extends Table>(table: T, id: string): Promise<Entities[T] | null>;
  list<T extends Table>(table: T, filter?: Filter): Promise<Entities[T][]>;
  put<T extends Table>(table: T, row: Entities[T], update: boolean): Promise<void>;
}
export function parseEntity<T extends Table>(table: T, value: unknown): Entities[T] {
  return parseContract(EntitySchemas[table], value);
}
// JSON records can cross worker/Jest realms; prototypes are not part of their persisted identity.
export const sameJson = (a: unknown, b: unknown): boolean => isDeepStrictEqual(a, b, { skipPrototype: true });
const same = sameJson;
export function isActive(audit: AuditSessionRecord): boolean { return audit.status === "pending" || audit.status === "running"; }

/** One place enforces the same invariants for local files and PostgreSQL. */
export abstract class RepositoryBase implements DevGuardianRepository {
  protected abstract access<T>(write: boolean, operation: (tx: Transaction) => Promise<T>): Promise<T>;
  public abstract close(): Promise<void>;
  public async createProject(input: ProjectRecord): Promise<ProjectRecord> {
    const row = parseEntity("projects", input);
    return this.access(true, async (tx) => {
      if (await tx.get("projects", row.id)) throw new ValidationError("Project already exists.");
      await tx.put("projects", row, false); return row;
    });
  }
  public async saveProject(input: ProjectRecord): Promise<ProjectRecord> {
    const row = parseEntity("projects", input);
    return this.access(true, async (tx) => {
      const old = await tx.get("projects", row.id);
      if (!old) throw new ValidationError("Unknown project.");
      if (old.createdAt !== row.createdAt || old.repoPath !== row.repoPath || old.name !== row.name ||
          old.defaultBranch !== row.defaultBranch || old.runnerType !== row.runnerType) {
        throw new ValidationError("Project identity is immutable.");
      }
      await tx.put("projects", row, true); return row;
    });
  }
  public getProject(id: string): Promise<ProjectRecord | null> { return this.get("projects", id); }
  public listProjects(): Promise<ProjectRecord[]> { return this.access(false, (tx) => tx.list("projects")); }
  public async createAuditSession(input: AuditSessionRecord): Promise<AuditSessionRecord> {
    const row = parseEntity("audit_sessions", input);
    return this.access(true, async (tx) => {
      if (!isActive(row)) throw new ValidationError("New audit must be pending or running.");
      if (await tx.get("audit_sessions", row.id)) throw new ValidationError("Audit already exists.");
      await this.checkAudit(tx, row); await tx.put("audit_sessions", row, false); return row;
    });
  }
  public async saveAuditSession(input: AuditSessionRecord): Promise<AuditSessionRecord> {
    const row = parseEntity("audit_sessions", input);
    return this.access(true, async (tx) => {
      const old = await tx.get("audit_sessions", row.id);
      if (!old) throw new ValidationError("Unknown audit.");
      if (!isActive(old) && !same(old, row)) throw new ValidationError("Finished audit is immutable.");
      if (old.projectId !== row.projectId || old.targetFile !== row.targetFile || old.startedAt !== row.startedAt ||
          (old.status === "running" && row.status === "pending")) throw new ValidationError("Invalid audit transition.");
      await this.checkAudit(tx, row); await tx.put("audit_sessions", row, true); return row;
    });
  }
  private async checkAudit(tx: Transaction, row: AuditSessionRecord): Promise<void> {
    if (!await tx.get("projects", row.projectId)) throw new ValidationError("Unknown project.");
    for (const id of [row.baselineRunId, row.candidateRunId]) {
      if (id === null) continue;
      const run = await tx.get("test_runs", id);
      if (!run || run.auditId !== row.id || run.projectId !== row.projectId) throw new ValidationError("Audit references an unrelated test run.");
      if (row.status === "committed" && (!run.complete ||
          (id === row.baselineRunId ? run.status !== "failed" : run.status !== "passed"))) {
        throw new ValidationError("Committed audit requires a complete failing baseline and passing candidate.");
      }
    }
    if (row.baselineRunId !== null && row.baselineRunId === row.candidateRunId) throw new ValidationError("Baseline and candidate must be distinct.");
  }
  public getAuditSession(id: string): Promise<AuditSessionRecord | null> { return this.get("audit_sessions", id); }
  public listAuditSessions(projectId: string): Promise<AuditSessionRecord[]> { return this.list("audit_sessions", "projectId", projectId); }
  public async saveTestRun(input: PersistedTestRun): Promise<PersistedTestRun> {
    const row = parseEntity("test_runs", input);
    return this.access(true, async (tx) => {
      const audit = await tx.get("audit_sessions", row.auditId);
      if (!audit || audit.projectId !== row.projectId) throw new ValidationError("Test run has no matching project/audit.");
      const old = await tx.get("test_runs", row.runId);
      if (!old && !isActive(audit)) throw new ValidationError("Cannot add tests to a finished audit.");
      if (old && !same(old, row)) throw new ValidationError("Test run is immutable.");
      await tx.put("test_runs", row, old !== null); return row;
    });
  }
  public getTestRun(id: string): Promise<PersistedTestRun | null> { return this.get("test_runs", id); }
  public listTestRuns(auditId: string): Promise<PersistedTestRun[]> { return this.list("test_runs", "auditId", auditId); }
  public async saveHookLog(input: HookLogRecord): Promise<HookLogRecord> {
    const row = parseEntity("hook_logs", input);
    return this.access(true, async (tx) => {
      if (!await tx.get("audit_sessions", row.auditId)) throw new ValidationError("Unknown audit for hook.");
      const old = await tx.get("hook_logs", row.id);
      if (old && !same(old, row)) throw new ValidationError("Hook decision is immutable.");
      await tx.put("hook_logs", row, old !== null); return row;
    });
  }
  public listHookLogs(auditId: string): Promise<HookLogRecord[]> { return this.list("hook_logs", "auditId", auditId); }
  public async saveDelegation(input: SubagentDelegationRecord): Promise<SubagentDelegationRecord> {
    const row = parseEntity("subagent_delegations", input);
    return this.access(true, async (tx) => {
      if (!await tx.get("audit_sessions", row.parentSessionId)) throw new ValidationError("Delegation requires a persisted parent audit.");
      const old = await tx.get("subagent_delegations", row.taskId);
      if (old && (old.parentSessionId !== row.parentSessionId || old.role !== row.role || old.objective !== row.objective ||
          !same(old.scopedContextJson, row.scopedContextJson) ||
          ({ delegated: 0, returned: 1, consumed: 2 }[row.phase] < { delegated: 0, returned: 1, consumed: 2 }[old.phase]) ||
          !same(row.snapshots.slice(0, old.snapshots.length), old.snapshots) ||
          row.snapshots.length < old.snapshots.length)) throw new ValidationError("Delegation journal cannot be rewritten.");
      await tx.put("subagent_delegations", row, old !== null); return row;
    });
  }
  public getDelegation(id: string): Promise<SubagentDelegationRecord | null> { return this.get("subagent_delegations", id); }
  public listDelegations(parentSessionId: string): Promise<SubagentDelegationRecord[]> { return this.list("subagent_delegations", "parentSessionId", parentSessionId); }
  private async get<T extends Table>(table: T, id: string): Promise<Entities[T] | null> {
    const parsed = parseContract(IdentifierSchema, id); return this.access(false, (tx) => tx.get(table, parsed));
  }
  private async list<T extends Table>(table: T, field: Filter["field"], id: string): Promise<Entities[T][]> {
    const value = parseContract(IdentifierSchema, id); return this.access(false, (tx) => tx.list(table, { field, value }));
  }
}
export function sanitizedDatabaseError(error: unknown): Error {
  return error instanceof ValidationError || error instanceof DatabaseError ? error : new DatabaseError();
}
