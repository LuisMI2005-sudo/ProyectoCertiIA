import path from "node:path";
import { ValidationError } from "../shared/errors.js";
import { LocalFileDatabaseAdapter } from "./local-adapter.js";
import { PostgresDatabaseAdapter } from "./postgres-adapter.js";
import type { DevGuardianRepository, SqlPool } from "./types.js";

export interface DatabaseRepositoryOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly baseDirectory?: string;
  /** Trusted injectable pool, primarily for tests; never accepted from tool inputs. */
  readonly postgresPool?: SqlPool;
}
export async function createDatabaseRepository(options: DatabaseRepositoryOptions = {}): Promise<DevGuardianRepository> {
  const env = options.environment ?? process.env;
  const mode = env["DEVGUARDIAN_DB_MODE"] ?? env["DB_MODE"];
  if (mode !== undefined && mode !== "local" && mode !== "postgres") throw new ValidationError("Unknown database mode.");
  const url = env["DATABASE_URL"]?.trim();
  if (mode === "postgres" && !url) throw new ValidationError("PostgreSQL mode requires DATABASE_URL.");
  if (url && mode !== "local") return PostgresDatabaseAdapter.create({ connectionString: url,
    ...(options.postgresPool ? { pool: options.postgresPool } : {}) });
  return LocalFileDatabaseAdapter.create({ filePath: path.resolve(options.baseDirectory ?? process.cwd(),
    env["DEVGUARDIAN_DB_PATH"] ?? "data/devguardian-db.json") });
}
export { LocalFileDatabaseAdapter } from "./local-adapter.js";
export { PostgresDatabaseAdapter } from "./postgres-adapter.js";
export { loadSchemaSql, runMigrations } from "./migrations.js";
export * from "./types.js";
export * from "./bridges.js";
