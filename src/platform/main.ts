import { readFile } from "node:fs/promises";
import { PlatformConfigSchema } from "./contracts.js";
import { startIdentity } from "./identity.js";
import { startExecution } from "./execution.js";
import { startGateway } from "./gateway.js";
import { startDomain } from "./domains.js";
import { startPlanner } from "./planner.js";

async function main() {
  const filename = process.argv[2]; if (!filename) throw new Error("Usage: node dist/platform/main.js <private-service-config.json>");
  const config = PlatformConfigSchema.parse(JSON.parse(await readFile(filename, "utf8")) as unknown);
  if (config.host !== "127.0.0.1") throw new Error("This local migration profile only binds loopback; production requires authenticated TLS networking.");
  const running = await (config.service === "identity" ? startIdentity(config) : config.service === "execution" ? startExecution(config)
    : config.service === "gateway" ? startGateway(config) : config.service === "planner" ? startPlanner(config) : startDomain(config));
  process.stdout.write(`${config.service} listening on ${config.services[config.service].port}\n`);
  let closing = false;
  const close = () => { if (closing) return; closing = true; void running.close().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 1; }); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
void main().catch(() => { process.stderr.write("Platform service failed. Check the private local configuration and database availability.\n"); process.exitCode = 1; });
