import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { ProjectRecordSchema } from "../db/types.js";
import { PlatformError, requireWrite, Uuid } from "./contracts.js";
import type { PlatformConfig } from "./contracts.js";
import { listen, readBody, requestService, send } from "./http.js";
import { verifyServiceToken } from "./security.js";
import { DomainStore } from "./store.js";
import { proxyService } from "./proxy.js";

const JsonResult = z.object({ ok: z.boolean(), data: z.json().optional() });
/** Domain boundaries own their records; execution retains authoritative safety evidence. */
export async function startDomain(config: PlatformConfig) {
  if (!config.databaseUrl) throw new Error("Domain database required.");
  const store = new DomainStore(config.databaseUrl, config.service);
  const server = await listen(config, async (request, response) => {
    const url = new URL(request.url ?? "/", "http://internal.local");
    const context = verifyServiceToken(config, config.service, request.headers.authorization?.slice(7), url.pathname === "/internal/events" ? ["telemetry"] : url.pathname === "/internal/project" ? ["execution"] : ["gateway"]);
    if (!context) throw new PlatformError(401, "TENANT_REQUIRED", "Contexto de organización requerido.");
    if (url.pathname === "/internal/events" && request.method === "GET") {
      const after = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(url.searchParams.get("after") ?? 0);
      send(response, 200, { events: await store.events(context, after) }); return;
    }
    if (url.pathname === "/internal/project" && config.service === "projects" && request.method === "POST") {
      requireWrite(context);
      const project = ProjectRecordSchema.parse(await readBody(request));
      const previous = await store.get(context, "project", project.id);
      if (previous && JSON.stringify(previous.data) !== JSON.stringify(project)) throw new PlatformError(409, "PROJECT_CONFLICT", "Registro de proyecto incompatible.");
      if (!previous) await store.save(context, "project", project.id, project, "registered", null);
      send(response, 200, { ok: true }); return;
    }
    if (config.service === "projects") {
      if (url.pathname === "/api/projects" && request.method === "GET") {
        // Reconcile a technical registration if the engine succeeded but its callback was interrupted.
        const technical = z.object({ data: z.array(ProjectRecordSchema) }).parse(await requestService(config, "execution", context, "/api/projects"));
        for (const project of technical.data) if (!await store.get(context, "project", project.id)) await store.save(context, "project", project.id, project, "registered", null);
        const records = await store.list(context, "project", 200); send(response, 200, { ok: true, data: records.map(record => record.data) }); return;
      }
      if (url.pathname === "/api/projects" || url.pathname === "/api/projects/import" || /^\/api\/projects\/[a-f0-9-]+\/files$/u.test(url.pathname)) {
        if (request.method === "POST") requireWrite(context);
        await proxyService(config, "execution", context, request, response); return;
      }
    }
    if (config.service === "audits") {
      if (url.pathname === "/api/audits/run" && request.method === "POST") {
        requireWrite(context);
        const command = request.headers["x-idempotency-key"] === undefined ? randomUUID() : Uuid.parse(request.headers["x-idempotency-key"]), input = await readBody(request);
        const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
        const previous = await store.get(context, "audit-command", command);
        if (previous) {
          const data = z.object({ requestHash: z.string(), result: z.json().optional() }).parse(previous.data);
          if (data.requestHash !== requestHash) throw new PlatformError(409, "IDEMPOTENCY_CONFLICT", "La clave de operación pertenece a otra solicitud.");
          if (previous.status === "completed") { send(response, 200, data.result); return; }
          throw new PlatformError(409, "RECOVERY_REQUIRED", "La operación ya fue enviada. Consulta el historial; no se ejecutará otra vez.");
        }
        await store.save(context, "audit-command", command, { requestHash }, "dispatched", null);
        try {
          const result = JsonResult.parse(await requestService(config, "execution", context, "/api/audits/run", input));
          await store.save(context, "audit-command", command, { requestHash, result }, "completed", 1);
          send(response, 200, result);
        } catch (error: unknown) {
          // A lost response does not prove execution failed. Never auto-retry a patch/commit.
          await store.save(context, "audit-command", command, { requestHash, recoveryRequired: true }, "outcome_unknown", 1);
          throw error;
        }
        return;
      }
      if (/^\/api\/audits(?:\/[a-f0-9-]+)?$/u.test(url.pathname) && request.method === "GET") { await proxyService(config, "execution", context, request, response); return; }
    }
    if (config.service === "policies" && /^\/api\/hooks\/(?:config|evaluate)$/u.test(url.pathname)) {
      if (request.method === "POST") requireWrite(context);
      if (request.method === "GET" && url.pathname === "/api/hooks/config") {
        const result = JsonResult.parse(await requestService(config, "execution", context, "/api/hooks/config"));
        const id = "00000000-0000-4000-8000-000000000100", previous = await store.get(context, "effective-policy", id);
        if (!previous || JSON.stringify(previous.data) !== JSON.stringify(result)) await store.save(context, "effective-policy", id, result, "active", previous?.version ?? null);
        send(response, 200, result); return;
      }
      await proxyService(config, "execution", context, request, response); return;
    }
    if (config.service === "telemetry" && request.method === "GET" && ["/api/hooks/logs", "/api/subagents/delegations"].includes(url.pathname)) {
      const result = JsonResult.parse(await requestService(config, "execution", context, url.pathname + url.search));
      // Tenant-scoped read projection; never consumed as authorization for committing.
      await store.save(context, "telemetry-snapshot", randomUUID(), result, "observed", null);
      send(response, 200, result); return;
    }
    if (config.service === "telemetry" && request.method === "GET" && url.pathname === "/api/telemetry/events") {
      const sources = ["projects", "audits", "policies"] as const;
      for (const [index, source] of sources.entries()) {
        const cursorId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
        const prior = await store.get(context, "event-cursor", cursorId);
        const after = prior ? z.object({ sequence: z.number() }).parse(prior.data).sequence : 0;
        const batch = z.object({ events: z.array(z.unknown()) }).parse(await requestService(config, source, context, `/internal/events?after=${after}`));
        await store.projectEvents(context, source, cursorId, batch.events);
      }
      send(response, 200, { ok: true, data: (await store.list(context, "service-event")).map(record => record.data) }); return;
    }
    throw new PlatformError(404, "NOT_FOUND", "Ruta no disponible en este servicio.");
  });
  return { server, close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.close(); } };
}
