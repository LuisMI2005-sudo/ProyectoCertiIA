import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ContextSchema, PlatformError, Uuid } from "./contracts.js";
import type { PlatformConfig, ServiceName } from "./contracts.js";
import { listen, readBody, requestService, send } from "./http.js";
import { proxyService } from "./proxy.js";

export async function startGateway(config: PlatformConfig) {
  let active = 0;
  const attempts = new Map<string, { count: number; until: number }>();
  const server = await listen(config, async (request, response) => {
    const origin = request.headers.origin;
    if (origin && origin !== config.allowedOrigin) throw new PlatformError(403, "ORIGIN_DENIED", "Origen no autorizado.");
    response.setHeader("Access-Control-Allow-Origin", config.allowedOrigin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id, X-Idempotency-Key, MCP-Protocol-Version, MCP-Session-Id");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    if (active >= 32) throw new PlatformError(503, "CAPACITY", "Hay demasiadas operaciones; inténtalo más tarde.");
    active++;
    try {
      const url = new URL(request.url ?? "/", "http://gateway.local"), correlationId = randomUUID();
      response.setHeader("X-Request-Id", correlationId);
      if (url.pathname === "/api/platform") { send(response, 200, { mode: "multitenant", authentication: "session", version: 1 }); return; }
      const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const key = request.socket.remoteAddress ?? "unknown", now = Date.now();
        for (const [address, value] of attempts) if (value.until <= now) attempts.delete(address);
        const entry = attempts.get(key) ?? { count: 0, until: now + 60000 };
        if (entry.count >= 10 || attempts.size > 10000) throw new PlatformError(429, "LOGIN_LIMIT", "Demasiados intentos; espera un minuto.");
        entry.count++; attempts.set(key, entry);
        send(response, 200, await requestService(config, "identity", null, "/internal/login", await readBody(request, 10000))); return;
      }
      if (!token) throw new PlatformError(401, "SESSION_REQUIRED", "Inicia sesión para continuar.");
      if (url.pathname === "/api/auth/session" && request.method === "GET") { send(response, 200, await requestService(config, "identity", null, "/internal/session", { token, correlationId })); return; }
      if (url.pathname === "/api/auth/logout" && request.method === "POST") { send(response, 200, await requestService(config, "identity", null, "/internal/logout", { token })); return; }
      if (url.pathname === "/api/organizations" && request.method === "POST") {
        const body = z.strictObject({ name: z.string().trim().min(1).max(120) }).parse(await readBody(request));
        send(response, 201, await requestService(config, "identity", null, "/internal/organizations", { token, name: body.name })); return;
      }
      const selected = request.headers["x-tenant-id"];
      const tenantId = selected === undefined ? undefined : Uuid.parse(selected);
      const context = ContextSchema.parse(await requestService(config, "identity", null, "/internal/resolve", { token, correlationId, ...(tenantId ? { tenantId } : {}) }));
      if (url.pathname === "/api/organizations/members" && request.method === "POST") {
        send(response, 201, await requestService(config, "identity", context, "/internal/members", await readBody(request, 10000))); return;
      }
      let target: ServiceName;
      if (url.pathname === "/api/projects" || url.pathname.startsWith("/api/projects/")) target = "projects";
      else if (url.pathname === "/api/audits" || url.pathname.startsWith("/api/audits/")) target = "audits";
      else if (["/api/hooks/logs", "/api/subagents/delegations", "/api/telemetry/events"].includes(url.pathname)) target = "telemetry";
      else if (["/api/hooks/config", "/api/hooks/evaluate"].includes(url.pathname)) target = "policies";
      else if (url.pathname === "/api/planner/propose") target = "planner";
      else if (["/api/health", "/api/mcp"].includes(url.pathname)) target = "execution";
      else throw new PlatformError(404, "NOT_FOUND", "Ruta no encontrada.");
      await proxyService(config, target, context, request, response);
    } finally { active--; }
  });
  return { server, close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); } };
}
