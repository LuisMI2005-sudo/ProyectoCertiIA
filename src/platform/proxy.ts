import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PlatformError } from "./contracts.js";
import type { PlatformConfig, ServiceName, TenantContext } from "./contracts.js";
import { issueServiceToken } from "./security.js";
import { readBody } from "./http.js";

export async function proxy(request: IncomingMessage, response: ServerResponse, url: string, authorization: string): Promise<void> {
  const method = request.method ?? "GET";
  const body = method === "POST" ? JSON.stringify(await readBody(request)) : undefined;
  const controller = new AbortController();
  const disconnected = () => { if (!response.writableFinished) controller.abort(); };
  response.once("close", disconnected);
  try {
    const key = request.headers["x-idempotency-key"];
    const forwarded: Record<string, string> = {};
    for (const header of ["accept", "mcp-protocol-version", "mcp-session-id"]) {
      const value = request.headers[header]; if (typeof value === "string") forwarded[header] = value;
    }
    const upstream = await fetch(url, { method, headers: { ...forwarded, "Content-Type": "application/json", Authorization: `Bearer ${authorization}`, ...(typeof key === "string" ? { "X-Idempotency-Key": key } : {}) },
      ...(body === undefined ? {} : { body }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]) });
    response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    if (upstream.body) {
      const reader = upstream.body.getReader();
      async function* chunks() {
        try { for (;;) { const part = await reader.read(); if (part.done) return; yield part.value; } }
        finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      }
      await pipeline(Readable.from(chunks()), response);
    } else response.end();
  } catch (error: unknown) {
    if (response.headersSent) { response.destroy(); return; }
    if (controller.signal.aborted) return;
    throw new PlatformError(503, "SERVICE_UNAVAILABLE", error instanceof Error && error.name === "TimeoutError" ? "El servicio agotó el tiempo de espera; consulta el historial antes de repetir." : "El servicio no está disponible; consulta el historial antes de repetir.");
  } finally { response.off("close", disconnected); }
}
export async function proxyService(config: PlatformConfig, target: ServiceName, context: TenantContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  await proxy(request, response, `http://${config.host}:${config.services[target].port}${request.url ?? "/"}`, issueServiceToken(config, config.service, target, context));
}
