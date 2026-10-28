import { Pool } from "pg";
import { ValidationError } from "../shared/errors.js";
import { runMigrations } from "./migrations.js";
import { EntityId, parseEntity, RepositoryBase, sanitizedDatabaseError } from "./repository.js";
import type { Entities, Filter, Table, Transaction } from "./repository.js";
import { DatabaseError } from "./types.js";
import type { SqlConnection, SqlPool } from "./types.js";

// SQL identifiers come exclusively from these constants, never from API/tool input.
const Fields: Record<Table, readonly string[]> = {
  projects: ["id", "name", "repoPath", "defaultBranch", "runnerType", "createdAt"],
  audit_sessions: ["id", "projectId", "status", "targetFile", "branchName", "baselineRunId", "candidateRunId", "commitSha", "startedAt", "finishedAt", "summaryJson"],
  test_runs: ["runId", "projectId", "auditId", "runner", "status", "complete", "workspaceStateHash", "configurationHash", "summary", "cases", "startedAt", "finishedAt"],
  hook_logs: ["id", "auditId", "hookId", "hookName", "event", "decision", "reason", "metadataJson", "durationMs", "createdAt"],
  subagent_delegations: ["taskId", "parentSessionId", "subagentId", "role", "status", "objective", "scopedContextJson", "toolCallsJson", "outputJson", "consumptionStatus", "durationMs", "startedAt", "finishedAt"]
};
const column = (field: string): string => field === "summary" || field === "cases" ? `${field}_json`
  : field.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
export interface PostgresDatabaseOptions {
  readonly connectionString?: string; readonly pool?: SqlPool;
  /** Trusted platform binding; requires an explicitly provisioned tenant schema. */
  readonly tenantId?: string; readonly externallyMigrated?: boolean;
}

export class PostgresDatabaseAdapter extends RepositoryBase {
  private closed = false;
  private constructor(private readonly pool: SqlPool, private readonly tenantId?: string) { super(); }
  public static async create(options: PostgresDatabaseOptions): Promise<PostgresDatabaseAdapter> {
    if (options.tenantId !== undefined && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(options.tenantId) || options.externallyMigrated !== true))
      throw new ValidationError("Tenant storage requires a valid tenant and provisioned schema.");
    let pool = options.pool;
    if (!pool) {
      let url: URL;
      try { url = new URL(options.connectionString ?? ""); }
      catch { throw new ValidationError("A valid PostgreSQL DATABASE_URL is required."); }
      if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new ValidationError("DATABASE_URL must use PostgreSQL.");
      const native = new Pool({ connectionString: options.connectionString, max: 5, connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000, statement_timeout: 15000, query_timeout: 20000, idle_in_transaction_session_timeout: 20000 });
      // Idle errors are handled without logging driver details or crashing the host process.
      native.on("error", () => {});
      pool = {
        async connect() {
          const client = await native.connect();
          return { async query(text, values) {
            const result = await client.query(text, values === undefined ? undefined : [...values]);
            return { rows: result.rows as Record<string, unknown>[] };
          }, release() { client.release(); } };
        }, async end() { await native.end(); }
      };
    }
    try { if (!options.externallyMigrated) await runMigrations(pool); return new PostgresDatabaseAdapter(pool, options.tenantId); }
    catch { try { await pool.end(); } catch { /* Preserve the sanitized initialization error. */ }
      throw new DatabaseError("Cannot initialize PostgreSQL database."); }
  }
  protected override async access<T>(write: boolean, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    if (this.closed) throw new DatabaseError("Database repository is closed.");
    let client: SqlConnection | undefined;
    try {
      client = await this.pool.connect();
      const connection = client;
      await connection.query(write ? "BEGIN" : "BEGIN READ ONLY");
      if (this.tenantId) await connection.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      if (write) {
        if (this.tenantId) await connection.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 714219871))", [this.tenantId]);
        else await connection.query("SELECT pg_advisory_xact_lock(714219871)");
      }
      const tx: Transaction = {
        get: async <K extends Table>(table: K, id: string): Promise<Entities[K] | null> => {
          const result = await connection.query(`SELECT record_json FROM ${table} WHERE ${column(EntityId[table])} = $1`, [id]);
          return result.rows[0] ? parseEntity(table, result.rows[0]["record_json"]) : null;
        },
        list: async <K extends Table>(table: K, filter?: Filter): Promise<Entities[K][]> => {
          const result = await connection.query(`SELECT record_json FROM ${table}${filter ? ` WHERE ${column(filter.field)} = $1` : ""} ORDER BY ${column(EntityId[table])}`,
            filter ? [filter.value] : []);
          return result.rows.map((row) => parseEntity(table, row["record_json"]));
        },
        put: async <K extends Table>(table: K, row: Entities[K], update: boolean): Promise<void> => {
          const fields = Fields[table];
          const record = row as Record<string, unknown>;
          const values = fields.map((key) => key.endsWith("Json") || key === "summary" || key === "cases" ? JSON.stringify(record[key]) : record[key]);
          values.push(JSON.stringify(row));
          const columns = [...fields.map(column), "record_json"];
          if (update) {
            values.push(record[EntityId[table]]);
            await connection.query(`UPDATE ${table} SET ${columns.map((name, i) => `${name} = $${i + 1}`).join(", ")} WHERE ${column(EntityId[table])} = $${values.length}`, values);
          } else {
            if (this.tenantId) { columns.push("tenant_id"); values.push(this.tenantId); }
            await connection.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")})`, values);
          }
        }
      };
      const result = await operation(tx); await client.query("COMMIT"); return result;
    } catch (error: unknown) {
      if (client) { try { await client.query("ROLLBACK"); } catch { /* Connection may already be closed. */ } }
      throw sanitizedDatabaseError(error);
    } finally { client?.release(); }
  }
  public override async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      try { await this.pool.end(); } catch { throw new DatabaseError("Cannot close the database pool."); }
    }
  }
}
