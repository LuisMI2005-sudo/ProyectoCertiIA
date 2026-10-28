import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { PlatformError } from "./contracts.js";
import { ZodError } from "zod";
import { issueServiceToken } from "./security.js";
import type { PlatformConfig, ServiceName, TenantContext } from "./contracts.js";

export async function readBody(request: IncomingMessage, limit = 2_000_000): Promise<unknown> {
  if (!/^application\/json(?:;|$)/iu.test(request.headers["content-type"] ?? "")) throw new PlatformError(415, "JSON_REQUIRED", "Se requiere application/json.");
  const chunks: Buffer[] = []; let size = 0;
  const timer = setTimeout(() => request.destroy(), 15000);
  try {
    for await (const part of request) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(String(part)); size += chunk.length;
      if (size > limit) throw new PlatformError(413, "BODY_TOO_LARGE", "La solicitud supera el límite.");
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
    catch { throw new PlatformError(400, "INVALID_JSON", "JSON inválido."); }
  } finally { clearTimeout(timer); }
}
export function send(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}
export function reportError(response: ServerResponse, error: unknown): void {
  if (error instanceof ZodError) { send(response, 400, { ok: false, error: { code: "VALIDATION_ERROR", message: "Los argumentos no cumplen el contrato." } }); return; }
  const known = error instanceof PlatformError;
  send(response, known ? error.status : 500, { ok: false, error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "No se pudo completar la operación del servicio." } });
}
export async function requestService(config: PlatformConfig, target: ServiceName, context: TenantContext | null, route: string, body?: unknown, method?: string): Promise<unknown> {
  const response = await fetch(`http://${config.host}:${config.services[target].port}${route}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${issueServiceToken(config, config.service, target, context)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(180000)
  });
  let result: unknown; try { result = await response.json(); } catch { throw new PlatformError(502, "UPSTREAM_INVALID", "El servicio no devolvió JSON válido."); }
  if (!response.ok) {
    const data = typeof result === "object" && result !== null && "error" in result ? result.error : null;
    const message = typeof data === "object" && data !== null && "message" in data && typeof data.message === "string" ? data.message : "La operación fue rechazada por el servicio.";
    throw new PlatformError(response.status, "UPSTREAM_REJECTED", message);
  }
  return result;
}
export async function listen(config: PlatformConfig, handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>): Promise<Server> {
  const server = createServer((request, response) => { void handler(request, response).catch(error => reportError(response, error)); });
  server.requestTimeout = 200000; server.headersTimeout = 20000;
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(config.services[config.service].port, config.host, resolve); });
  return server;
}
