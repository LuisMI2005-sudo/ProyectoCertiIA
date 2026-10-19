import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseError } from "./types.js";
import type { SqlPool } from "./types.js";

export const MIGRATION_VERSION = 1;
export async function loadSchemaSql(): Promise<string> { return readFile(new URL("./schema.sql", import.meta.url), "utf8"); }
export async function runMigrations(pool: SqlPool): Promise<void> {
  const sql = await loadSchemaSql();
  const checksum = createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
  const client = await pool.connect().catch(() => { throw new DatabaseError("Cannot acquire a migration connection."); });
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(714219870)");
    await client.query("CREATE TABLE IF NOT EXISTS devguardian_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const previous = await client.query("SELECT checksum FROM devguardian_migrations WHERE version = $1", [MIGRATION_VERSION]);
    if (previous.rows[0]) {
      if (previous.rows[0]["checksum"] !== checksum) throw new DatabaseError("Applied migration checksum does not match the schema; create a new migration.");
    } else {
      await client.query(sql);
      await client.query("INSERT INTO devguardian_migrations (version, checksum) VALUES ($1, $2)", [MIGRATION_VERSION, checksum]);
    }
    await client.query("COMMIT");
  } catch {
    try { await client.query("ROLLBACK"); } catch { /* Original operation has already failed. */ }
    throw new DatabaseError("Database migration failed; no partial schema was committed.");
  } finally { client.release(); }
}
