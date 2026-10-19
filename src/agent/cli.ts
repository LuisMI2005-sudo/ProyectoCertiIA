import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentRunInputSchema } from "./types.js";
import { AnthropicRepairPlanner } from "./anthropic-planner.js";
import { AutonomousRepairAgent } from "./index.js";
import { SdkMcpToolClient } from "./mcp-tool-client.js";
import type { McpClientTransport } from "./mcp-tool-client.js";

function serverArguments(): string[] {
  const raw = process.env.DEVGUARDIAN_MCP_ARGS;
  if (!raw) return [path.resolve("dist/mcp-server/index.js")];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length > 4096) || parsed.length > 100) {
    throw new Error("DEVGUARDIAN_MCP_ARGS must be a JSON array of at most 100 strings.");
  }
  return parsed;
}

async function requestInput(): Promise<unknown> {
  const requestPath = process.env.DEVGUARDIAN_REPAIR_REQUEST;
  if (!requestPath) throw new Error("Set DEVGUARDIAN_REPAIR_REQUEST to a JSON file containing slug, analysis, runner, and optional targets.");
  const content = await readFile(path.resolve(requestPath), "utf8");
  if (Buffer.byteLength(content) > 64_000) throw new Error("Repair request file exceeds 64 KB.");
  return JSON.parse(content) as unknown;
}

export async function startAgent(): Promise<void> {
  const input = AgentRunInputSchema.parse(await requestInput());
  const workspaceRoot = path.resolve(process.env.DEVGUARDIAN_WORKSPACE ?? process.cwd());
  const allowedEnvironment: Record<string, string> = {};
  for (const key of ["PATH", "Path", "HOME", "USERPROFILE", "SystemRoot",
    "DEVGUARDIAN_WORKSPACE", "DEVGUARDIAN_MODEL", "NODE_ENV"]) {
    const value = process.env[key];
    if (value !== undefined) allowedEnvironment[key] = value;
  }
  const transport = new StdioClientTransport({
    command: process.env.DEVGUARDIAN_MCP_COMMAND ?? process.execPath,
    args: serverArguments(), cwd: workspaceRoot, env: allowedEnvironment, stderr: "inherit"
  });
  const client = new Client({ name: "devguardian-agent", version: "0.1.0" });
  try {
    await client.connect(transport);
    const available = new Set((await client.listTools()).tools.map((tool) => tool.name));
    const required = ["read_file_context", "analyze_code", "run_tests", "compare_test_runs", "git_status",
      "git_create_fix_branch", "git_begin_attempt", "git_apply_patch", "git_diff", "git_commit_fix", "git_rollback_attempt"];
    const missing = required.filter((name) => !available.has(name));
    if (missing.length > 0) {
      throw new Error(`Connected MCP server is missing required tools: ${missing.join(", ")}. Complete/configure Phase 4 first; no repository changes were made.`);
    }
    const agent = new AutonomousRepairAgent(new SdkMcpToolClient(client as unknown as McpClientTransport),
      new AnthropicRepairPlanner());
    const result = await agent.run(input);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "exhausted" || result.status === "cancelled") process.exitCode = 2;
  } finally {
    await client.close();
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  startAgent().catch((error: unknown) => {
    console.error("DevGuardian agent stopped safely.", error instanceof Error ? error.message : "Unexpected error.");
    process.exitCode = 1;
  });
}
