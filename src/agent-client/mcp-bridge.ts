import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { HookLogRecordSchema } from "../db/types.js";
import { IdentifierSchema, ToolSchemas, parseContract, resultSchema } from "../shared/contracts.js";
import type { ToolInput, ToolName, ToolOutput } from "../shared/contracts.js";
import { DevGuardianError, ErrorCode, ValidationError } from "../shared/errors.js";
import type { ErrorPayload } from "../shared/errors.js";
import { AgentConfigSchema } from "./types.js";
import type { AgentConfig, AgentConfigInput, HookDecisionCaught, StdioConnectionOptions } from "./types.js";

export interface McpConnection {
  callTool(params: { name: string; arguments: Record<string, unknown> }, schema?: undefined, options?: { timeout: number }): Promise<unknown>;
  listTools(): Promise<{ tools: { name: string }[] }>;
  close(): Promise<void>;
}
export class McpToolError extends DevGuardianError {
  public constructor(public readonly tool: string, payload: ErrorPayload, public readonly auditId?: string) {
    super(payload.code, payload.message, { retryable: payload.retryable, ...(payload.details ? { details: payload.details } : {}) });
  }
}
export class McpOutcomeUnknownError extends DevGuardianError {
  public constructor(public readonly tool: string) {
    super(ErrorCode.AGENT_ERROR, "MCP transport failed; reconcile server state before retrying.");
  }
}
const ResponseSchema = z.object({ isError: z.boolean().optional(), structuredContent: z.unknown().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  _meta: z.object({ auditId: IdentifierSchema.optional() }).optional() });
// The registry validates each correlated output; Object.entries loses that relation in TypeScript.
const Outputs = Object.fromEntries(Object.entries(ToolSchemas).map(([key, value]) => [key, value.output])) as unknown as {
  [K in ToolName]: z.ZodType<ToolOutput<K>>
};

export class McpClientAdapter {
  private sessionId: string | undefined;
  private branch: string | undefined;
  private initialHead: string | undefined;
  private attemptId: string | undefined;
  private auditId: string | undefined;
  private closed = false;
  public constructor(private readonly client: McpConnection, public readonly config: AgentConfig) {}
  public get lastAuditId(): string | undefined { return this.auditId; }
  public get activeAttemptId(): string | undefined { return this.attemptId; }

  public static async connect(raw: AgentConfigInput, stdio: StdioConnectionOptions = {}): Promise<McpClientAdapter> {
    const config = parseContract(AgentConfigSchema, raw);
    const client = new Client({ name: "devguardian-agent-client", version: "0.1.0" });
    client.onerror = () => {}; // Errors are surfaced through typed calls, never raw stderr/configuration.
    try {
      if (config.transportType === "http") {
        const url = new URL(config.serverUrl ?? "http://127.0.0.1:3001/api/mcp");
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
          throw new ValidationError("Invalid MCP server URL.");
        }
        const moduleName = "@modelcontextprotocol/sdk/client/streamableHttp.js";
        const loaded: unknown = await import(moduleName);
        if (typeof loaded !== "object" || loaded === null || !("StreamableHTTPClientTransport" in loaded) ||
            typeof loaded.StreamableHTTPClientTransport !== "function") throw new ValidationError("HTTP MCP transport is unavailable.");
        // Installed SDK declarations expose sessionId: undefined incompatibly with its own Transport interface.
        const HttpTransport = loaded.StreamableHTTPClientTransport as new (url: URL, options: {
          requestInit: RequestInit; reconnectionOptions: { maxRetries: number; initialReconnectionDelay: number;
            maxReconnectionDelay: number; reconnectionDelayGrowFactor: number }
        }) => Transport;
        await client.connect(new HttpTransport(url, {
          requestInit: config.apiToken ? { headers: { Authorization: `Bearer ${config.apiToken}` } } : {},
          reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 }
        }), { timeout: config.callTimeoutMs });
      } else {
        const cwd = path.resolve(stdio.cwd ?? fileURLToPath(new URL("../../", import.meta.url)));
        const env = { ...getDefaultEnvironment() };
        for (const name of ["DATABASE_URL", "DEVGUARDIAN_DB_MODE", "DEVGUARDIAN_DB_PATH", "DEVGUARDIAN_WORKSPACE_ROOT", "PGSSLROOTCERT"]) {
          const value = stdio.environment?.[name] ?? process.env[name]; if (value !== undefined) env[name] = value;
        }
        const transport = new StdioClientTransport({ command: process.execPath,
          args: [path.resolve(stdio.serverPath ?? path.join(cwd, "dist/mcp/index.js"))], cwd, env, stderr: "pipe" });
        transport.stderr?.on("data", () => {});
        await client.connect(transport, { timeout: config.callTimeoutMs });
      }
      const adapter = new McpClientAdapter(client, config); await adapter.initialize(); return adapter;
    } catch (error: unknown) {
      await client.close().catch(() => {});
      if (error instanceof ValidationError) throw error;
      throw new DevGuardianError(ErrorCode.AGENT_ERROR, "Cannot connect to the configured MCP server.");
    }
  }
  public async initialize(): Promise<void> {
    const listed = await this.client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    if (Object.keys(ToolSchemas).some((name) => !names.has(name))) throw new ValidationError("MCP server lacks required domain tools.");
  }
  private decode(response: unknown): unknown {
    const serialized = JSON.stringify(response);
    if (!serialized || serialized.length > 4_000_000) throw new ValidationError("MCP response exceeds the client budget or is missing.");
    const parsed = parseContract(ResponseSchema, response);
    this.auditId = parsed._meta?.auditId;
    let payload: unknown = parsed.structuredContent;
    if (payload === undefined) {
      const text = parsed.content?.find((entry) => entry.type === "text")?.text;
      if (!text) throw new ValidationError("MCP tool returned no structured result.");
      try { payload = JSON.parse(text); } catch { throw new ValidationError("MCP tool returned invalid JSON."); }
    }
    if (parsed.isError && typeof payload === "object" && payload !== null && "ok" in payload && payload.ok === true) {
      throw new ValidationError("MCP error cannot be a successful domain result.");
    }
    return payload;
  }
  private async request(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this.closed) throw new ValidationError("MCP client is closed.");
    let response: unknown;
    try { response = await this.client.callTool({ name, arguments: { ...args, projectId: this.config.projectId } }, undefined,
      { timeout: this.config.callTimeoutMs }); }
    catch { throw new McpOutcomeUnknownError(name); }
    try { return this.decode(response); }
    catch {
      if (name.startsWith("git_") && name !== "git_status" && name !== "git_diff") throw new McpOutcomeUnknownError(name);
      throw new ValidationError("MCP response is malformed or exceeds the client budget.");
    }
  }
  public async call<K extends ToolName>(name: K, input: ToolInput<K>): Promise<ToolOutput<K>> {
    const args = parseContract(ToolSchemas[name].input, input);
    const payload = await this.request(name, args);
    const schema: z.ZodType<ToolOutput<K>> = Outputs[name];
    const parsed = resultSchema(schema).safeParse(payload);
    if (!parsed.success) {
      if (name.startsWith("git_") && name !== "git_status" && name !== "git_diff") throw new McpOutcomeUnknownError(name);
      throw new ValidationError("MCP result violates the domain output contract.");
    }
    const result = parsed.data;
    if (!result.ok) throw new McpToolError(name, { code: result.error.code, message: result.error.message,
      retryable: result.error.retryable, ...(result.error.details ? { details: result.error.details } : {}) }, this.auditId);
    return result.data;
  }
  public async runAnalysis(target: string) {
    const analysis = await this.call("analyze_code", { paths: [target], checks: ["syntax", "semantic", "lint"] });
    const source = await this.call("read_file_context", { path: target }); return { analysis, source };
  }
  public status() { return this.call("git_status", {}); }
  public runBaseline(runner: AgentConfig["runner"], targets: string[]) { return this.call("run_tests", { runner, targets }); }
  public runCandidate(runner: AgentConfig["runner"], targets: string[]) { return this.call("run_tests", { runner, targets }); }
  public verifyCandidate(baselineRunId: string, candidateRunId: string) { return this.call("compare_test_runs", { baselineRunId, candidateRunId }); }
  public async prepareAttempt(slug: string) {
    const status = await this.status();
    if (!status.clean || !status.headCommit) throw new ValidationError("Repair requires a clean committed workspace.");
    if (!this.sessionId) {
      const session = await this.call("git_create_fix_branch", { slug, expectedHead: status.headCommit });
      this.sessionId = session.sessionId; this.branch = session.branch; this.initialHead = session.baseCommit;
    } else if (status.branch !== this.branch || status.headCommit !== this.initialHead) {
      throw new ValidationError("Repair session changed externally.");
    }
    const attempt = await this.call("git_begin_attempt", { sessionId: this.sessionId });
    this.attemptId = attempt.attemptId; return attempt;
  }
  private ids(attemptId = this.attemptId): { sessionId: string; attemptId: string } {
    if (!this.sessionId || !attemptId || attemptId !== this.attemptId) throw new ValidationError("No matching active attempt.");
    return { sessionId: this.sessionId, attemptId };
  }
  public applyProposedPatch(attemptId: string, target: string, diff: string, fileHash: string) {
    if (target !== this.config.targetPath) throw new ValidationError("Proposal escaped the authorized file.");
    return this.call("git_apply_patch", { ...this.ids(attemptId), unifiedDiff: diff, expectedFileHashes: { [target]: fileHash } });
  }
  public async commitSuccess(verificationRunId: string, message: string) {
    const ids = this.ids(); const diff = await this.call("git_diff", ids);
    const result = await this.call("git_commit_fix", { ...ids, verificationRunId, expectedDiffHash: diff.diffHash, message });
    this.attemptId = undefined; return result;
  }
  public async rollback(attemptId: string) {
    const result = await this.call("git_rollback_attempt", this.ids(attemptId));
    this.attemptId = undefined; return result;
  }
  public async hookEvidence(error: McpToolError): Promise<HookDecisionCaught[]> {
    if (error.auditId) {
      try {
        const payload = await this.request("hooks_get_logs", { auditId: error.auditId, limit: 100, offset: 0 });
        const result = parseContract(resultSchema(z.array(HookLogRecordSchema).max(200)), payload);
        if (result.ok) return result.data.filter((entry) => entry.decision === "block").slice(0, 10).map((entry) => ({
          decision: "block", reason: entry.reason, auditId: error.auditId!, hookId: entry.hookId, event: entry.event
        }));
      } catch { /* The original error remains authoritative when audit retrieval is unavailable. */ }
    }
    const hookId = error.details?.["hookId"], event = error.details?.["event"];
    return typeof hookId === "string" ? [{ decision: "block", reason: error.message, hookId,
      ...(typeof event === "string" ? { event } : {}), ...(error.auditId ? { auditId: error.auditId } : {}) }] : [];
  }
  public async close(): Promise<void> { if (!this.closed) { this.closed = true; await this.client.close(); } }
}
