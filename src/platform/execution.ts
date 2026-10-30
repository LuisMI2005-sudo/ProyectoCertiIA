import { mkdir, lstat } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PostgresDatabaseAdapter } from "../db/postgres-adapter.js";
import { startHttpServer } from "../server/http.js";
import type { RunningHttpServer } from "../server/http.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { ContextSchema, PlatformError, requireWrite } from "./contracts.js";
import type { PlatformConfig, TenantContext, ServiceName } from "./contracts.js";
import { listen, requestService, send } from "./http.js";
import { verifyServiceToken } from "./security.js";
import { proxy } from "./proxy.js";
import { configuredTestSandbox } from "../test-runner/sandbox-config.js";

export async function startExecution(config: PlatformConfig) {
  if (!config.databaseUrl) throw new Error("Execution database required.");
  const databaseUrl = config.databaseUrl;
  const sandbox = configuredTestSandbox();
  const runtimes = new Map<string, Promise<{ host: RunningHttpServer; token: string }>>();
  async function runtime(context: TenantContext) {
    const existing = runtimes.get(context.tenantId); if (existing) return existing;
    if (runtimes.size >= 16) throw new PlatformError(503, "TENANT_CAPACITY", "Capacidad local de organizaciones alcanzada.");
    const pending = (async () => {
      const root = path.join(config.workspaceRoot, context.tenantId);
      await mkdir(root, { recursive: true });
      if ((await lstat(root)).isSymbolicLink()) throw new PlatformError(403, "INVALID_ROOT", "No se permiten enlaces entre workspaces de organizaciones.");
      const guard = await WorkspacePathGuard.create(config.workspaceRoot);
      // Reject a preexisting external symlink before creating a legacy runtime.
      await guard.resolve(context.tenantId, { mustExist: true, kind: "directory" });
      const repository = await PostgresDatabaseAdapter.create({ connectionString: databaseUrl, tenantId: context.tenantId, externallyMigrated: true });
      const original = repository.createProject.bind(repository);
      repository.createProject = async input => {
        const record = await original(input);
        await requestService(config, "projects", context, "/internal/project", record);
        return record;
      };
      const token = randomBytes(32).toString("hex");
      const host = await startHttpServer({ port: 0, host: "127.0.0.1", repository, workspaceRoots: [root], demoEnabled: false, apiToken: token, logger: () => {}, requireSandbox: true, ...(sandbox ? { sandbox } : {}) });
      return { host, token };
    })();
    runtimes.set(context.tenantId, pending);
    try { return await pending; } catch (error: unknown) { runtimes.delete(context.tenantId); throw error; }
  }
  const server = await listen(config, async (request, response) => {
    const url = new URL(request.url ?? "/", "http://internal.local");
    const allowed: readonly ServiceName[] = url.pathname.startsWith("/api/projects") ? ["projects"]
      : url.pathname.startsWith("/api/audits") ? ["audits"]
      : ["/api/hooks/logs", "/api/subagents/delegations"].includes(url.pathname) ? ["telemetry"]
      : url.pathname.startsWith("/api/hooks/") ? ["policies"] : ["gateway"];
    const context = verifyServiceToken(config, "execution", request.headers.authorization?.slice(7), allowed);
    if (!context) throw new PlatformError(401, "TENANT_REQUIRED", "Contexto de organización requerido.");
    ContextSchema.parse(context);
    if (!/^\/api\/(?:health|projects(?:\/[a-f0-9-]+\/files|\/import)?|audits(?:\/[a-f0-9-]+|\/run)?|hooks\/(?:config|logs|evaluate)|subagents\/delegations|mcp)$/u.test(url.pathname)) throw new PlatformError(404, "NOT_FOUND", "Operación no disponible.");
    if (request.method === "POST") requireWrite(context);
    if (request.method !== "GET" && request.method !== "POST") throw new PlatformError(405, "METHOD_NOT_ALLOWED", "Método no permitido.");
    // A viewer cannot issue arbitrary MCP methods over POST; safe reads use REST.
    const selected = await runtime(context);
    if (url.pathname === "/api/mcp" && request.method === "GET") { send(response, 405, { ok: false }); return; }
    await proxy(request, response, selected.host.url + url.pathname + url.search, selected.token);
  });
  return { server, close: async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await Promise.all([...runtimes.values()].map(async pending => { const value = await pending; await value.host.close(); }));
  } };
}
