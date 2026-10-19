import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema, JSONRPCRequestSchema, JSONRPCNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { toJson } from "../db/types.js";
import { IdentifierSchema, parseContract, ToolSchemas } from "../shared/contracts.js";
import type { ToolHandler, ToolName, ToolInput } from "../shared/contracts.js";
import { captureResult, DevGuardianError, ValidationError } from "../shared/errors.js";
import type { DevGuardianBackend, ToolContext } from "../server/application.js";
import { ListQuerySchema } from "../server/contracts.js";

const Descriptions: Record<ToolName, string> = {
  read_file_context: "Read bounded UTF-8 source and its SHA-256 hash.", analyze_code: "Analyze syntax, semantics and ESLint diagnostics.",
  get_symbol_context: "Read the most specific enclosing symbol and local references.", git_status: "Inspect the registered Git workspace.",
  git_create_fix_branch: "Create fix/... with a clean tree and matching expectedHead.", git_begin_attempt: "Create an attempt checkpoint in an existing fix session.",
  git_apply_patch: "Apply a checked unified diff with exact file hashes.", git_diff: "Inspect the current attempt and diffHash.",
  git_commit_fix: "Commit only with current trusted test evidence.", git_rollback_attempt: "Restore only the current attempt, preserving unrelated work.",
  run_tests: "Run a trusted Jest/pytest configuration with time and output limits.", compare_test_runs: "Compare stored runs and register trusted verification evidence."
};
interface Definition { readonly description: string; readonly schema: z.ZodType; readonly execute: (input: unknown, context: ToolContext) => Promise<unknown> }
// Object.entries loses the key/schema relationship; the source covers every ToolName.
const Inputs = Object.fromEntries(Object.entries(ToolSchemas).map(([name, definition]) => [name, definition.input])) as unknown as { [K in ToolName]: z.ZodType<ToolInput<K>> };
async function domainCall<K extends ToolName>(name: K, raw: unknown, context: ToolContext) {
  const schema = ToolSchemas[name].input.safeExtend({ projectId: IdentifierSchema });
  const parsed = parseContract(schema, raw);
  if (parsed.projectId !== context.project.id) throw new ValidationError("Project correlation failed.");
  const args = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "projectId"));
  // Input/output stay correlated by ToolName; domain handlers validate the original contract again.
  const domainSchema: z.ZodType<ToolInput<K>> = Inputs[name];
  const input = parseContract(domainSchema, args);
  const runtime = await context.runtime();
  const handlers: { [T in ToolName]: ToolHandler<T> } = {
    ...runtime.analyzer.tools, ...runtime.git.tools,
    analyze_code: (value) => captureResult(async () => {
      await context.hooks.assertAllowed("pre:analyze", { files: value.paths }); return runtime.analyzer.analyzeCode(value);
    }),
    run_tests: (value) => captureResult(async () => {
      await context.hooks.assertAllowed("pre:run_tests", { files: value.targets ?? [] });
      const result = await runtime.runner.runTests(value);
      await context.hooks.notify("post:test_run", { workspaceStateHash: result.workspaceStateHash, timestamp: result.finishedAt });
      return result;
    }),
    compare_test_runs: (value) => captureResult(() => runtime.runner.verify(value.baselineRunId, value.candidateRunId))
  };
  const result = await handlers[name](input);
  if (!result.ok) throw new DevGuardianError(result.error.code, result.error.message, { retryable: result.error.retryable });
  return parseContract(ToolSchemas[name].output, result.data);
}
export function createMcpServer(backend: DevGuardianBackend): Server {
  const definitions = new Map<string, Definition>();
  for (const name of Object.keys(ToolSchemas) as ToolName[]) definitions.set(name, {
    description: Descriptions[name], schema: ToolSchemas[name].input.safeExtend({ projectId: IdentifierSchema }),
    execute: (input, context) => domainCall(name, input, context)
  });
  definitions.set("git_rollback", { ...definitions.get("git_rollback_attempt")! });
  const projectSchema = z.strictObject({ projectId: IdentifierSchema });
  const querySchema = ListQuerySchema.safeExtend({ projectId: IdentifierSchema });
  definitions.set("hooks_get_logs", { description: "Read persisted hook decisions for a registered project.", schema: querySchema,
    execute: async (raw) => backend.hookLogs(parseContract(querySchema, raw)) });
  definitions.set("hooks_get_config", { description: "Read trusted hook configuration; it cannot be changed by a tool.", schema: projectSchema,
    execute: async (raw) => { await backend.project(parseContract(projectSchema, raw).projectId); return backend.hookConfiguration(); } });
  definitions.set("subagents_get_delegations", { description: "Read durable delegation traces and consumed decisions.", schema: querySchema,
    execute: async (raw) => backend.delegations(parseContract(querySchema, raw)) });
  definitions.set("db_list_projects", { description: "Read projects within the configured workspace roots.", schema: z.strictObject({}),
    execute: async (raw) => { parseContract(z.strictObject({}), raw); return backend.projects(); } });
  definitions.set("db_list_audits", { description: "Read persisted audits, test runs, hooks and delegations.", schema: querySchema,
    execute: async (raw) => backend.auditDetails(parseContract(querySchema, raw)) });
  const auditSchema = z.strictObject({ projectId: IdentifierSchema, auditId: IdentifierSchema });
  definitions.set("db_get_audit", { description: "Read one durable audit belonging to a registered project.", schema: auditSchema,
    execute: async (raw) => { const value = parseContract(auditSchema, raw); return backend.audit(value.auditId, value.projectId); } });

  // Low-level SDK API is intentional: audit the call before validating tool-specific arguments.
  const server = new Server({ name: "devguardian", version: backend.version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...definitions].map(([name, definition]): Tool => ToolSchema.parse({
    name, description: definition.description, inputSchema: { ...z.toJSONSchema(definition.schema, { io: "input" }), type: "object" }
  })) }));
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const args = request.params.arguments ?? {};
    const result = await backend.withToolAudit(request.params.name, args, async (context) => {
      const definition = definitions.get(request.params.name);
      if (!definition) throw new ValidationError("Unknown MCP tool.");
      const input = parseContract(definition.schema, args);
      const value = await definition.execute(input, context);
      if (request.params.name === "run_tests") {
        const run = parseContract(ToolSchemas.run_tests.output, value);
        await backend.persistence.saveTestRun(context.audit.id, run);
      }
      return value;
    });
    const structuredContent = result.ok ? { ok: true, data: toJson(result.data) } : { ok: false, error: toJson(result.error) };
    return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent, isError: !result.ok };
  });
  return server;
}

/** POST-only stateless JSON transport. The SDK owns negotiation, dispatch and protocol errors. */
class JsonHttpTransport implements Transport {
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage) => void;
  public constructor(private readonly response: ServerResponse) {}
  public async start(): Promise<void> {}
  public async send(message: JSONRPCMessage): Promise<void> {
    if (this.response.writableEnded || this.response.destroyed) return;
    this.response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" }); this.response.end(JSON.stringify(message));
  }
  public async close(): Promise<void> { this.onclose?.(); }
}
export async function handleMcpHttp(backend: DevGuardianBackend, _request: IncomingMessage, response: ServerResponse, body: unknown): Promise<void> {
  const parsed = JSONRPCRequestSchema.safeParse(body);
  const notification = JSONRPCNotificationSchema.safeParse(body);
  if (!parsed.success && !notification.success) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } })); return;
  }
  const server = createMcpServer(backend);
  const transport = new JsonHttpTransport(response);
  const completed = new Promise<void>((resolve) => { response.once("finish", resolve); response.once("close", resolve); });
  try {
    await server.connect(transport);
    if (parsed.success) transport.onmessage?.(parsed.data);
    else { transport.onmessage?.(notification.data!); response.writeHead(202); response.end(); }
    await completed;
  }
  finally { await server.close(); }
}
