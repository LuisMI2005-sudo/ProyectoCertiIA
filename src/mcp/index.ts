import path from "node:path";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDatabaseRepository } from "../db/index.js";
import { DevGuardianBackend } from "../server/application.js";
import { createMcpServer } from "./server.js";

export { createMcpServer, handleMcpHttp } from "./server.js";
export async function startStdioServer() {
  const repository = await createDatabaseRepository();
  let backend: DevGuardianBackend;
  try { backend = await DevGuardianBackend.create({ repository,
    workspaceRoots: [path.resolve(process.env["DEVGUARDIAN_WORKSPACE_ROOT"] ?? process.cwd())] }); }
  catch (error: unknown) { await repository.close(); throw error; }
  const server = createMcpServer(backend);
  server.onclose = () => { void backend.close().catch(() => { process.exitCode = 1; }); };
  try { await server.connect(new StdioServerTransport()); }
  catch (error: unknown) { await backend.close(); throw error; }
  return { server, backend, async close() { await server.close(); await backend.close(); } };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const app = await startStdioServer();
    const close = (): void => { void app.close().catch(() => { process.exitCode = 1; }); };
    process.once("SIGINT", close); process.once("SIGTERM", close);
  } catch { process.stderr.write("Cannot initialize DevGuardian MCP.\n"); process.exitCode = 1; }
}
