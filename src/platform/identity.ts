import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { CredentialsSchema, PlatformError, Uuid } from "./contracts.js";
import type { PlatformConfig, TenantContext } from "./contracts.js";
import { DomainStore } from "./store.js";
import { passwordHash, passwordMatches, sessionHash, verifyServiceToken } from "./security.js";
import { listen, readBody, send } from "./http.js";

const Session = z.strictObject({ token: z.string().min(32).max(256) });
const Resolve = Session.extend({ tenantId: Uuid.optional(), correlationId: Uuid });
const UserRow = z.object({ id: Uuid, email: z.string(), password_hash: z.string() });
export async function startIdentity(config: PlatformConfig) {
  if (!config.databaseUrl) throw new Error("Identity database is required.");
  const store = new DomainStore(config.databaseUrl, "identity");
  async function userFor(token: string) {
    const result = await store.pool.query("SELECT u.id,u.email,u.password_hash FROM users u JOIN sessions s ON s.subject_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()", [sessionHash(token)]);
    if (!result.rows[0]) throw new PlatformError(401, "SESSION_REQUIRED", "Inicia sesión para continuar.");
    return UserRow.parse(result.rows[0]);
  }
  async function organizations(subjectId: string) {
    const result = await store.pool.query("SELECT t.id,t.name,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id WHERE m.subject_id=$1 ORDER BY t.name,t.id", [subjectId]);
    return z.array(z.object({ id: Uuid, name: z.string(), role: z.enum(["owner", "member", "viewer"]) })).parse(result.rows);
  }
  const server = await listen(config, async (request, response) => {
    const url = new URL(request.url ?? "/", "http://internal.local");
    if (url.pathname === "/health" && request.method === "GET") { await store.pool.query("SELECT 1"); send(response, 200, { ok: true, service: "identity" }); return; }
    const context = verifyServiceToken(config, "identity", request.headers.authorization?.slice(7), ["gateway"]);
    if (request.method !== "POST") throw new PlatformError(405, "METHOD_NOT_ALLOWED", "Método no permitido.");
    const body = await readBody(request, 10000);
    if (url.pathname === "/internal/login") {
      const input = CredentialsSchema.parse(body);
      const result = await store.pool.query("SELECT id,email,password_hash FROM users WHERE email=$1", [input.email.toLowerCase()]);
      const raw: unknown = result.rows[0];
      const user = raw ? UserRow.parse(raw) : null;
      // Derive a hash even for unknown accounts to avoid a cheap account-enumeration timing signal.
      const reference = user?.password_hash ?? `00000000000000000000000000000000:${"00".repeat(64)}`;
      if (!await passwordMatches(input.password, reference) || !user) throw new PlatformError(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos.");
      const token = randomBytes(32).toString("base64url");
      await store.pool.query("INSERT INTO sessions(token_hash,subject_id,expires_at) VALUES($1,$2,now()+interval '8 hours')", [sessionHash(token), user.id]);
      send(response, 200, { token, user: { id: user.id, email: user.email }, organizations: await organizations(user.id) }); return;
    }
    if (url.pathname === "/internal/session" || url.pathname === "/internal/resolve") {
      const input = Resolve.parse(body), user = await userFor(input.token), list = await organizations(user.id);
      if (url.pathname === "/internal/session") { send(response, 200, { user: { id: user.id, email: user.email }, organizations: list }); return; }
      const selected = input.tenantId ? list.find(item => item.id === input.tenantId) : list.length === 1 ? list[0] : undefined;
      if (!selected) throw new PlatformError(input.tenantId ? 403 : 409, "TENANT_REQUIRED", "Selecciona una organización a la que tengas acceso.");
      const resolved: TenantContext = { tenantId: selected.id, subjectId: user.id, role: selected.role, correlationId: input.correlationId };
      send(response, 200, resolved); return;
    }
    if (url.pathname === "/internal/logout") {
      const { token } = Session.parse(body); await store.pool.query("DELETE FROM sessions WHERE token_hash=$1", [sessionHash(token)]); send(response, 200, { revoked: true }); return;
    }
    if (url.pathname === "/internal/organizations") {
      const input = Session.extend({ name: z.string().trim().min(1).max(120) }).parse(body);
      const user = await userFor(input.token), id = randomUUID(), client = await store.pool.connect();
      try { await client.query("BEGIN"); await client.query("INSERT INTO tenants(id,name) VALUES($1,$2)", [id, input.name]); await client.query("INSERT INTO memberships(tenant_id,subject_id,role) VALUES($1,$2,'owner')", [id, user.id]); await client.query("COMMIT"); }
      catch (error: unknown) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
      send(response, 201, { id, name: input.name, role: "owner" }); return;
    }
    if (url.pathname === "/internal/members") {
      if (!context || context.role !== "owner") throw new PlatformError(403, "OWNER_REQUIRED", "Solo el propietario administra miembros.");
      const input = CredentialsSchema.extend({ role: z.enum(["member", "viewer"]) }).parse(body), client = await store.pool.connect();
      try {
        await client.query("BEGIN");
        const membership = await client.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND subject_id=$2 AND role='owner'", [context.tenantId, context.subjectId]);
        if (!membership.rows[0]) throw new PlatformError(403, "OWNER_REQUIRED", "Permiso de propietario no vigente.");
        const exists = await client.query("SELECT id FROM users WHERE email=$1", [input.email.toLowerCase()]);
        if (exists.rows[0]) throw new PlatformError(409, "USER_EXISTS", "Esta cuenta ya existe; no se cambió su contraseña.");
        const subject = randomUUID(); await client.query("INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)", [subject, input.email.toLowerCase(), await passwordHash(input.password)]);
        await client.query("INSERT INTO memberships(tenant_id,subject_id,role) VALUES($1,$2,$3)", [context.tenantId, subject, input.role]); await client.query("COMMIT");
        send(response, 201, { id: subject, email: input.email.toLowerCase(), role: input.role });
      } catch (error: unknown) { await client.query("ROLLBACK").catch(() => undefined); throw error; } finally { client.release(); }
      return;
    }
    throw new PlatformError(404, "NOT_FOUND", "Ruta de identidad no encontrada.");
  });
  return { server, close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.close(); } };
}
