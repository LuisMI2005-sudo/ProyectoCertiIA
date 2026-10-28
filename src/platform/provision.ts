import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { BootstrapSchema, ServiceSchema } from "./contracts.js";
import type { ServiceName } from "./contracts.js";
import { passwordHash } from "./security.js";

const services = ServiceSchema.options;
const tables = { identity: ["users", "tenants", "memberships", "sessions"], execution: ["projects", "audit_sessions", "test_runs", "hook_logs", "subagent_delegations"], domain: ["domain_records", "outbox", "inbox"] };
/** Provision ONLY new local databases. Never upgrades or imports the legacy database. */
export async function provision(adminUrl: string, directory: string, bootstrap: unknown, basePort = 4100) {
  const admin = new URL(adminUrl), input = BootstrapSchema.parse(bootstrap);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(admin.hostname)) throw new Error("Provisioning is restricted to loopback PostgreSQL.");
  if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65520) throw new Error("Invalid base port.");
  const destination = path.resolve(directory);
  // mkdir without recursive prevents accidentally reusing existing credentials or databases.
  await mkdir(destination);
  const prefix = `dg_${randomBytes(5).toString("hex")}`;
  const registry = Object.fromEntries(services.map((service, index) => {
    const keys = generateKeyPairSync("ed25519");
    return [service, { port: basePort + index, publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), signingKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString() }];
  })) as Record<ServiceName, { port: number; publicKey: string; signingKey: string }>;
  const published = Object.fromEntries(services.map(service => [service, { port: registry[service].port, publicKey: registry[service].publicKey }]));
  const administrator = new Pool({ connectionString: adminUrl, max: 1 });
  const tenantId = randomUUID(), subjectId = randomUUID();
  try {
    for (const service of services) {
      let databaseUrl: string | undefined;
      if (service !== "gateway") {
        const database = `${prefix}_${service}`, role = `${prefix}_${service}_runtime`, password = randomBytes(32).toString("hex");
        // Identifiers and password are generated from fixed enums and hex, not request values.
        await administrator.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
        await administrator.query(`CREATE DATABASE ${database}`);
        const url = new URL(adminUrl); url.pathname = `/${database}`;
        const owner = new Pool({ connectionString: url.toString(), max: 1 });
        try {
          await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
          await owner.query(`REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC`);
          await owner.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
          await owner.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
          const kind = service === "identity" ? "identity" : service === "execution" ? "execution" : "domain";
          await owner.query(await readFile(new URL(`./sql/${kind}.sql`, import.meta.url), "utf8"));
          for (const table of tables[kind]) {
            if (kind !== "identity") {
              await owner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
              await owner.query(`CREATE POLICY tenant_isolation ON ${table} USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)`);
            }
            await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO ${role}`);
          }
          await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
          if (service === "identity") {
            await owner.query("INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)", [subjectId, input.email.toLowerCase(), await passwordHash(input.password)]);
            await owner.query("INSERT INTO tenants(id,name) VALUES($1,$2)", [tenantId, input.name]);
            await owner.query("INSERT INTO memberships(tenant_id,subject_id,role) VALUES($1,$2,'owner')", [tenantId, subjectId]);
          }
        } finally { await owner.end(); }
        url.username = role; url.password = password; databaseUrl = url.toString();
      }
      await writeFile(path.join(destination, `${service}.json`), JSON.stringify({ version: 1, host: "127.0.0.1", gatewayPort: registry.gateway.port, service, signingKey: registry[service].signingKey,
        ...(databaseUrl ? { databaseUrl } : {}), services: published, workspaceRoot: path.join(destination, "workspaces"), allowedOrigin: "http://127.0.0.1:5173" }, null, 2), { flag: "wx", mode: 0o600 });
    }
    return { tenantId, subjectId, gateway: `http://127.0.0.1:${registry.gateway.port}`, directory: destination };
  } finally { await administrator.end(); }
}
