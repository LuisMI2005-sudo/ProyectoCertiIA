import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { hasSystemErrorCode, ValidationError } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { EntityId, EntitySchemas, RepositoryBase, sanitizedDatabaseError } from "./repository.js";
import type { Entities, Filter, Table, Transaction } from "./repository.js";
import { DatabaseError } from "./types.js";

const SnapshotSchema = z.strictObject({ version: z.literal(1),
  projects: z.array(EntitySchemas.projects), audit_sessions: z.array(EntitySchemas.audit_sessions),
  test_runs: z.array(EntitySchemas.test_runs), hook_logs: z.array(EntitySchemas.hook_logs),
  subagent_delegations: z.array(EntitySchemas.subagent_delegations)
});
type Snapshot = z.infer<typeof SnapshotSchema>;
const empty = (): Snapshot => ({ version: 1, projects: [], audit_sessions: [], test_runs: [], hook_logs: [], subagent_delegations: [] });
const MAX_BYTES = 32_000_000;
function systemCode(error: unknown): string {
  let cause: unknown = error;
  for (let depth = 0; depth < 3 && cause instanceof Error && cause.cause; depth += 1) cause = cause.cause;
  return typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string" && /^[A-Z_]+$/u.test(cause.code)
    ? cause.code : "IO_ERROR";
}
const isSharingConflict = (error: unknown): boolean => process.platform === "win32" && ["EPERM", "EACCES", "EBUSY"].includes(systemCode(error));
export interface LocalDatabaseOptions { readonly filePath: string; readonly lockTimeoutMs?: number }

/** Atomic snapshots; each operation reloads disk, including across independent Node processes. */
export class LocalFileDatabaseAdapter extends RepositoryBase {
  private closed = false;
  private readonly pending = new Set<Promise<unknown>>();
  private constructor(private readonly guard: WorkspacePathGuard, private readonly name: string, private readonly lockTimeoutMs: number) { super(); }
  public static async create(options: LocalDatabaseOptions): Promise<LocalFileDatabaseAdapter> {
    const file = path.resolve(options.filePath);
    const timeout = options.lockTimeoutMs ?? 5000;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000 || file.split(/[\\/]/u).some((part) => part.toLowerCase() === ".git")) {
      throw new ValidationError("Invalid database location or lock timeout.");
    }
    // The location is trusted startup configuration; no existing parent may redirect it through a link.
    let current = path.parse(file).root;
    for (const segment of path.relative(current, path.dirname(file)).split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try { if ((await lstat(current)).isSymbolicLink()) throw new ValidationError("Database parents cannot be symbolic links."); }
      catch (error: unknown) { if (!hasSystemErrorCode(error, "ENOENT")) throw error; }
    }
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const instance = new LocalFileDatabaseAdapter(await WorkspacePathGuard.create(path.dirname(file)), path.basename(file), timeout);
    await instance.access(true, async () => undefined);
    return instance;
  }
  private async resolve(name: string): Promise<string> {
    return (await this.guard.resolve(name, { operation: "write", mustExist: false, kind: "file" })).absolutePath;
  }
  private async acquire(): Promise<{ handle: FileHandle; file: string }> {
    const until = Date.now() + this.lockTimeoutMs;
    while (true) {
      try {
        const file = await this.resolve(`${this.name}.lock`);
        const handle = await open(file, "wx", 0o600);
        return { handle, file };
      } catch (error: unknown) {
        // Another cooperating owner may unlink the lock during path-security inspection.
        if (!hasSystemErrorCode(error, "EEXIST") && !hasSystemErrorCode(error, "FILE_NOT_FOUND") && !isSharingConflict(error)) throw error;
        if (Date.now() >= until) throw new DatabaseError("Database write lock timed out; inspect an abandoned lock before removing it.");
        await delay(15);
      }
    }
  }
  private async retrySharingConflict<T>(operation: () => Promise<T>): Promise<T> {
    const until = Date.now() + this.lockTimeoutMs;
    while (true) {
      try { return await operation(); }
      catch (error: unknown) {
        if (!isSharingConflict(error) || Date.now() >= until) throw error;
        await delay(15);
      }
    }
  }
  private async read(): Promise<Snapshot> {
    const file = await this.resolve(this.name);
    let handle: FileHandle;
    try { handle = await open(file, "r"); }
    catch (error: unknown) { if (hasSystemErrorCode(error, "ENOENT")) return empty(); throw error; }
    try {
      const size = (await handle.stat()).size;
      if (size > MAX_BYTES) throw new DatabaseError("Local database exceeds its size limit.");
      const buffer = Buffer.alloc(size + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (result.bytesRead === 0) break;
        length += result.bytesRead;
      }
      if (length > size) throw new DatabaseError("Local database changed while reading.");
      const parsed = SnapshotSchema.safeParse(JSON.parse(buffer.subarray(0, length).toString("utf8")));
      if (!parsed.success) throw new DatabaseError("Local database schema is invalid; the file was preserved.");
      return parsed.data;
    } finally { await handle.close(); }
  }
  private async write(snapshot: Snapshot): Promise<void> {
    const data = JSON.stringify(snapshot);
    if (Buffer.byteLength(data) > MAX_BYTES) throw new DatabaseError("Local database exceeds its size limit.");
    const temp = await this.resolve(`${this.name}.${randomUUID()}.tmp`);
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(data); await handle.sync(); await handle.close();
      const target = await this.resolve(this.name);
      await this.retrySharingConflict(() => rename(temp, target));
      if (process.platform !== "win32") {
        const parent = await open(this.guard.root, "r");
        try { await parent.sync(); } finally { await parent.close(); }
      }
    } finally { await handle.close(); await rm(temp, { force: true }); }
  }
  protected override async access<T>(write: boolean, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    const task = this.performAccess(write, operation);
    this.pending.add(task);
    try { return await task; } finally { this.pending.delete(task); }
  }
  private async performAccess<T>(write: boolean, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    if (this.closed) throw new DatabaseError("Database repository is closed.");
    let lock: Awaited<ReturnType<LocalFileDatabaseAdapter["acquire"]>> | undefined;
    let stage = "lock";
    try {
      if (write) lock = await this.acquire();
      if (this.closed) throw new DatabaseError("Database repository is closed.");
      stage = "read";
      const data = await this.read();
      const rows = <K extends Table>(table: K): Entities[K][] => data[table] as Entities[K][];
      const tx: Transaction = {
        get: async <K extends Table>(table: K, id: string): Promise<Entities[K] | null> =>
          structuredClone(rows(table).find((row) => row[EntityId[table] as keyof Entities[K]] === id) ?? null),
        list: async <K extends Table>(table: K, filter?: Filter): Promise<Entities[K][]> => structuredClone(rows(table)
          .filter((row) => !filter || (row as Record<string, unknown>)[filter.field] === filter.value)),
        put: async <K extends Table>(table: K, row: Entities[K], update: boolean): Promise<void> => {
          const list = rows(table); const key = EntityId[table] as keyof Entities[K];
          const index = list.findIndex((entry) => entry[key] === row[key]);
          if (update && index >= 0) list[index] = structuredClone(row);
          else if (!update && index < 0) list.push(structuredClone(row));
          else throw new ValidationError("Unexpected database write conflict.");
        }
      };
      stage = "transaction";
      const result = await operation(tx);
      stage = "atomic replacement";
      if (write) await this.write(data);
      return structuredClone(result);
    } catch (error: unknown) {
      const sanitized = sanitizedDatabaseError(error);
      if (error instanceof ValidationError || error instanceof DatabaseError) throw sanitized;
      throw new DatabaseError(`Local database ${stage} failed (${systemCode(error)}).`);
    }
    finally { if (lock) { await lock.handle.close(); const file = lock.file; await this.retrySharingConflict(() => rm(file, { force: true })); } }
  }
  public override async close(): Promise<void> { this.closed = true; await Promise.allSettled([...this.pending]); }
}
