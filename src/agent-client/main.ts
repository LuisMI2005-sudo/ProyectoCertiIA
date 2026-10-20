import { open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { parseContract } from "../shared/contracts.js";
import { ValidationError } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { DevGuardianAgent } from "./orchestrator.js";
import { MockChatModel } from "./planner.js";
import { AgentConfigSchema, PatchProposalSchema } from "./types.js";

async function readJson(file: string): Promise<unknown> {
  const absolute = path.resolve(file);
  const guard = await WorkspacePathGuard.create(path.dirname(absolute));
  const resolved = await guard.resolve(path.basename(absolute), { kind: "file" });
  const handle = await open(resolved.absolutePath, "r");
  try {
    const before = await handle.stat(); const buffer = Buffer.alloc(65537); let count = 0;
    if (!before.isFile() || before.nlink !== 1 || before.size > 65536) throw new ValidationError("CLI JSON file is invalid or too large.");
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, count);
      if (!bytesRead) break; count += bytesRead;
    }
    const after = await handle.stat();
    await guard.resolve(path.basename(absolute), { kind: "file" });
    if (count > 65536 || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new ValidationError("CLI JSON file changed during reading.");
    try { return JSON.parse(buffer.subarray(0, count).toString("utf8").replace(/^\uFEFF/u, "")); }
    catch { throw new ValidationError("CLI file must contain valid JSON."); }
  } finally { await handle.close(); }
}
export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write("Usage: start:agent -- --config config.json [--mock proposals.json]\n"); return 0;
  }
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index], value = args[index + 1];
    if ((name !== "--config" && name !== "--mock") || !value || value.startsWith("--") || options.has(name)) {
      throw new ValidationError("Use --config config.json and optional --mock proposals.json.");
    }
    options.set(name, value);
  }
  const filename = options.get("--config"); if (!filename) throw new ValidationError("--config is required.");
  const config = parseContract(AgentConfigSchema, await readJson(filename));
  if (!config.apiToken && process.env["DEVGUARDIAN_API_TOKEN"]) config.apiToken = process.env["DEVGUARDIAN_API_TOKEN"];
  const mockFile = options.get("--mock");
  const model = mockFile ? new MockChatModel(parseContract(z.array(PatchProposalSchema).min(1).max(10), await readJson(mockFile))) : undefined;
  const agent = await DevGuardianAgent.create(config, model ? { model } : {});
  const abort = new AbortController();
  const cancel = (): void => abort.abort();
  process.once("SIGINT", cancel); process.once("SIGTERM", cancel);
  try {
    const result = await agent.run(abort.signal); process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.success ? 0 : 1;
  } finally {
    process.off("SIGINT", cancel); process.off("SIGTERM", cancel); await agent.close();
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await main(); }
  catch { process.stderr.write("Cannot run DevGuardian Agent. Check arguments, MCP configuration and credentials.\n"); process.exitCode = 1; }
}
