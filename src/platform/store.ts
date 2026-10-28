import { Pool } from "pg";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PlatformError } from "./contracts.js";
import type { TenantContext } from "./contracts.js";

export class DomainStore {
  public readonly pool: Pool;
  public constructor(databaseUrl: string, public readonly domain: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 15000, idle_in_transaction_session_timeout: 20000 });
    this.pool.on("error", () => {});
  }
  public async transaction<T>(context: TenantContext, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
      const result = await operation(client); await client.query("COMMIT"); return result;
    } catch (error: unknown) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }
  public async get(context: TenantContext, kind: string, id: string) {
    return this.transaction(context, async client => {
      const result = await client.query("SELECT id, version, status, data FROM domain_records WHERE entity_type=$1 AND id=$2", [kind, id]);
      const row: unknown = result.rows[0]; return row === undefined ? null : StoredRecord.parse(row);
    });
  }
  public async list(context: TenantContext, kind: string, limit = 100, offset = 0) {
    return this.transaction(context, async client => {
      const result = await client.query("SELECT id, version, status, data FROM domain_records WHERE entity_type=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3", [kind, Math.min(200, Math.max(1, limit)), Math.max(0, offset)]);
      return z.array(StoredRecord).parse(result.rows);
    });
  }
  public async save(context: TenantContext, kind: string, id: string, data: unknown, status: string, expectedVersion: number | null) {
    const json = z.json().parse(data);
    return this.transaction(context, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [context.tenantId + kind + id]);
      const prior = await client.query("SELECT version FROM domain_records WHERE entity_type=$1 AND id=$2 FOR UPDATE", [kind, id]);
      const version = prior.rows[0] ? Number((prior.rows[0] as Record<string, unknown>)["version"]) : null;
      if (version !== expectedVersion) throw new PlatformError(409, "VERSION_CONFLICT", "La operación cambió; consulta su estado antes de repetirla.");
      const next = (version ?? 0) + 1;
      await client.query("INSERT INTO domain_records(tenant_id,entity_type,id,version,status,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,entity_type,id) DO UPDATE SET version=EXCLUDED.version,status=EXCLUDED.status,data=EXCLUDED.data,updated_at=now()", [context.tenantId, kind, id, next, status, JSON.stringify(json)]);
      await client.query("INSERT INTO outbox(tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,correlation_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7)", [context.tenantId, randomUUID(), kind, id, next, context.correlationId, JSON.stringify({ domain: this.domain, status })]);
      return { id, version: next, status, data: json };
    });
  }
  public async events(context: TenantContext, after: number) {
    return this.transaction(context, async client => {
      const result = await client.query("SELECT sequence,event_id,aggregate_type,aggregate_id,aggregate_version,correlation_id,payload FROM outbox WHERE sequence>$1 ORDER BY sequence LIMIT 100", [after]);
      return result.rows as Record<string, unknown>[];
    });
  }
  /** Inbox deduplication, projection and cursor move commit in one local transaction. */
  public async projectEvents(context: TenantContext, source: string, cursorId: string, batch: readonly unknown[]) {
    const events = z.array(z.object({ sequence: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER), event_id: z.uuid(), aggregate_type: z.string(), aggregate_id: z.uuid(), aggregate_version: z.number().int().positive(), correlation_id: z.uuid(), payload: z.json() })).parse(batch);
    return this.transaction(context, async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [context.tenantId + source]);
      const previous = await client.query("SELECT data FROM domain_records WHERE entity_type='event-cursor' AND id=$1 FOR UPDATE", [cursorId]);
      let cursor = previous.rows[0] ? z.object({ sequence: z.number() }).parse(previous.rows[0]["data"]).sequence : 0;
      for (const event of events) {
        if (event.sequence <= cursor) continue;
        const inserted = await client.query("INSERT INTO inbox(tenant_id,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id", [context.tenantId, event.event_id]);
        if (inserted.rowCount) await client.query("INSERT INTO domain_records(tenant_id,entity_type,id,version,status,data) VALUES($1,'service-event',$2,1,'observed',$3)", [context.tenantId, event.event_id, JSON.stringify({ source, ...event })]);
        cursor = event.sequence;
      }
      await client.query("INSERT INTO domain_records(tenant_id,entity_type,id,version,status,data) VALUES($1,'event-cursor',$2,1,'active',$3) ON CONFLICT(tenant_id,entity_type,id) DO UPDATE SET data=EXCLUDED.data,version=domain_records.version+1,updated_at=now()", [context.tenantId, cursorId, JSON.stringify({ sequence: cursor })]);
      return cursor;
    });
  }
  public async close(): Promise<void> { await this.pool.end(); }
}
export const StoredRecord = z.object({ id: z.uuid(), version: z.coerce.number().int().positive(), status: z.string(), data: z.json() });
