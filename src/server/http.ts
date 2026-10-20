import { timingSafeEqual, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createDatabaseRepository } from "../db/index.js";
import { handleMcpHttp } from "../mcp/server.js";
import { parseContract } from "../shared/contracts.js";
import { DevGuardianError, failure } from "../shared/errors.js";
import { DevGuardianBackend } from "./application.js";
import type { BackendOptions } from "./application.js";
import { HttpError, ListQuerySchema } from "./contracts.js";

export interface RequestLog { readonly requestId: string; readonly method: string; readonly path: string; readonly status: number; readonly durationMs: number }
export interface HttpServerOptions extends Partial<BackendOptions> {
  readonly port?: number; readonly host?: string; readonly allowedOrigin?: string; readonly apiToken?: string;
  readonly maxBodyBytes?: number; readonly maxConcurrentRequests?: number;
  readonly logger?: (entry: RequestLog) => void;
}
export interface RunningHttpServer { readonly server: Server; readonly backend: DevGuardianBackend; readonly url: string; close(): Promise<void> }

function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers["content-type"] ?? "")) throw new HttpError(415, "Content-Type must be application/json.");
  if (Number(request.headers["content-length"] ?? 0) > maxBytes) { request.resume(); throw new HttpError(413, "Request body is too large."); }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    const cleanup = (): void => { clearTimeout(timer); request.off("data", onData); request.off("end", onEnd); request.off("error", onError); request.off("aborted", onAbort); };
    const fail = (error: Error): void => { cleanup(); request.resume(); reject(error); };
    const onData = (raw: unknown): void => {
      const chunk = typeof raw === "string" ? Buffer.from(raw) : Buffer.isBuffer(raw) ? raw : Buffer.alloc(0);
      size += chunk.length;
      if (size > maxBytes) { fail(new HttpError(413, "Request body is too large.")); return; }
      chunks.push(chunk);
    };
    const onError = (): void => fail(new HttpError(400, "Cannot read request body."));
    const onAbort = (): void => fail(new HttpError(400, "Request was aborted."));
    const onEnd = (): void => { cleanup(); try { const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); resolve(body); }
      catch { reject(new HttpError(400, "Invalid JSON body.")); } };
    const timer = setTimeout(() => fail(new HttpError(408, "Request body timed out.")), 10000);
    request.on("data", onData); request.once("end", onEnd); request.once("error", onError); request.once("aborted", onAbort);
  });
}
function statusFor(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  if (error instanceof DevGuardianError) {
    if (["VERIFICATION_FAILED", "PATH_OUTSIDE_WORKSPACE", "PATH_PROTECTED", "SYMLINK_FORBIDDEN"].includes(error.code)) return 403;
    if (["WORKTREE_DIRTY", "STATE_CONFLICT", "PATCH_CONFLICT"].includes(error.code)) return 409;
    if (["FILE_NOT_FOUND", "SESSION_NOT_FOUND", "ATTEMPT_NOT_FOUND"].includes(error.code)) return 404;
    if (["VALIDATION_ERROR", "PATH_INVALID", "PATCH_INVALID", "REPOSITORY_ERROR"].includes(error.code)) return 422;
  }
  return 500;
}
function json(response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(value));
}
function authenticated(request: IncomingMessage, token: string | undefined): boolean {
  if (!token) return true;
  const presented = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
  const supplied = Buffer.from(presented), expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export async function startHttpServer(options: HttpServerOptions = {}): Promise<RunningHttpServer> {
  const maxBodyBytes = options.maxBodyBytes ?? 2_000_000, maxRequests = options.maxConcurrentRequests ?? 32;
  const port = options.port ?? Number(process.env["PORT"] || 3001), host = options.host ?? process.env["HOST"] ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 5000000 ||
      !Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 128) throw new HttpError(422, "Invalid server port or limits.");
  const repository = options.repository ?? await createDatabaseRepository();
  let backend: DevGuardianBackend;
  try { backend = await DevGuardianBackend.create({ ...options, repository }); }
  catch (error: unknown) { await repository.close(); throw error; }
  const origins = (options.allowedOrigin ?? process.env["ALLOWED_ORIGIN"] ?? process.env["CORS_ORIGIN"] ?? "*").split(",").map((value) => value.trim());
  const token = options.apiToken ?? process.env["DEVGUARDIAN_API_TOKEN"];
  let active = 0;
  const server = createServer((request, response) => {
    const requestId = randomUUID(), started = performance.now();
    let pathname = "/invalid", logged = false;
    const log = (): void => {
      if (logged) return; logged = true;
      try { (options.logger ?? ((entry) => process.stdout.write(JSON.stringify(entry) + "\n")))({ requestId, method: request.method ?? "UNKNOWN",
        path: pathname.slice(0, 512), status: response.writableFinished ? response.statusCode : 499, durationMs: Math.round(performance.now() - started) }); }
      catch { /* Logging must not turn a completed operation into an error. */ }
    };
    response.once("finish", log); response.once("close", log);
    response.setHeader("X-Request-Id", requestId); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Cache-Control", "no-store");
    void (async () => {
      let counted = false;
      try {
        const url = new URL(request.url ?? "/", "http://devguardian.local"); pathname = url.pathname;
        const origin = request.headers.origin;
        response.setHeader("Vary", "Origin");
        if (origin && !origins.includes("*") && !origins.includes(origin)) throw new HttpError(403, "Origin is not allowed.");
        response.setHeader("Access-Control-Allow-Origin", origins.includes("*") ? "*" : origin ?? origins[0] ?? "null");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id");
        response.setHeader("Access-Control-Expose-Headers", "X-Request-Id, MCP-Session-Id");
        if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
        const health = pathname === "/health" || pathname === "/api/health";
        if (!health && !authenticated(request, token)) throw new HttpError(401, "Authentication required.");
        if (active >= maxRequests) throw new HttpError(503, "Server request capacity reached."); active += 1; counted = true;
        const method = request.method;
        const query = (): ReturnType<typeof ListQuerySchema.parse> => {
          const values: Record<string, string> = {};
          for (const [key, value] of url.searchParams) { if (key in values) throw new HttpError(422, "Duplicate query parameter."); values[key] = value; }
          return parseContract(ListQuerySchema, values);
        };
        if (health && method === "GET") { const data = await backend.health(); json(response, data.database.connected ? 200 : 503, { ok: data.database.connected, data }); return; }
        if (pathname === "/api/projects" && method === "GET") { json(response, 200, { ok: true, data: await backend.projects() }); return; }
        if (pathname === "/api/projects" && method === "POST") { json(response, 201, { ok: true, data: await backend.registerProject(await readJson(request, maxBodyBytes)) }); return; }
        if (pathname === "/api/demo/prepare" && method === "POST") { json(response, 201, { ok: true, data: await backend.prepareDemo(await readJson(request, maxBodyBytes)) }); return; }
        if (pathname === "/api/audits" && method === "GET") { json(response, 200, { ok: true, data: await backend.auditDetails(query()) }); return; }
        if (pathname === "/api/audits/run" && method === "POST") { const data = await backend.runAudit(await readJson(request, maxBodyBytes)); json(response, 200, { ok: true, data }); return; }
        const audit = pathname.match(/^\/api\/audits\/([^/]+)$/u);
        if (audit && method === "GET") { json(response, 200, { ok: true, data: await backend.audit(audit[1] ?? "") }); return; }
        if (pathname === "/api/hooks/config" && method === "GET") { json(response, 200, { ok: true, data: backend.hookConfiguration() }); return; }
        if (pathname === "/api/hooks/logs" && method === "GET") { json(response, 200, { ok: true, data: await backend.hookLogs(query()) }); return; }
        if (pathname === "/api/hooks/evaluate" && method === "POST") { const data = await backend.evaluateHook(await readJson(request, maxBodyBytes)); json(response, data.decision === "block" ? 403 : 200, { ok: data.decision !== "block", data }); return; }
        if (pathname === "/api/subagents/delegations" && method === "GET") { json(response, 200, { ok: true, data: await backend.delegations(query()) }); return; }
        if (pathname === "/api/mcp" && method === "POST") {
          let body: unknown;
          try { body = await readJson(request, maxBodyBytes); }
          catch (error: unknown) {
            if (error instanceof HttpError && error.message === "Invalid JSON body.") { json(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); return; }
            throw error;
          }
          if (!request.headers.accept || request.headers.accept === "*/*") request.headers.accept = "application/json, text/event-stream";
          await handleMcpHttp(backend, request, response, body); return;
        }
        const known = health || /^\/api\/(?:projects|demo\/prepare|audits(?:\/run|\/[^/]+)?|hooks\/(?:logs|config|evaluate)|subagents\/delegations|mcp)$/u.test(pathname);
        if (known) response.setHeader("Allow", pathname === "/api/projects" ? "GET, POST, OPTIONS"
          : ["/api/mcp", "/api/audits/run", "/api/hooks/evaluate", "/api/demo/prepare"].includes(pathname) ? "POST, OPTIONS" : "GET, OPTIONS");
        throw new HttpError(known ? 405 : 404, known ? "Method not allowed." : "Endpoint not found.");
      } catch (error: unknown) {
        const status = statusFor(error);
        json(response, status, { ...failure(error), requestId });
      } finally { if (counted) active -= 1; }
    })();
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, host, () => { server.off("error", reject); resolve(); }); });
  } catch (error: unknown) { await backend.close(); throw error; }
  const address = server.address() as AddressInfo;
  let closing: Promise<void> | undefined;
  return { server, backend, url: `http://${address.address.includes(":") ? `[${address.address}]` : address.address}:${address.port}`,
    close() { closing ??= (async () => {
      await new Promise<void>((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeIdleConnections(); });
      await backend.close();
    })(); return closing; } };
}
