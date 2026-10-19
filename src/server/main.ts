import path from "node:path";
import { startHttpServer } from "./http.js";

try {
  const server = await startHttpServer({ workspaceRoots: [path.resolve(process.env["DEVGUARDIAN_WORKSPACE_ROOT"] ?? process.cwd())] });
  process.stdout.write(JSON.stringify({ event: "server_started", url: server.url }) + "\n");
  const shutdown = (): void => { void server.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; }); };
  process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
} catch {
  process.stderr.write(JSON.stringify({ event: "server_start_failed", message: "Cannot initialize the backend. Check configuration and database availability." }) + "\n");
  process.exitCode = 1;
}
