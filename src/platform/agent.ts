import { z } from "zod";
import { DevGuardianAgent } from "../agent-client/orchestrator.js";
import { AgentConfigSchema, PatchProposalSchema } from "../agent-client/types.js";
import type { AgentConfigInput, PatchPlanner, PlannerContext } from "../agent-client/types.js";
import { PlatformError } from "./contracts.js";

/** The external agent reasons; the private planner proposes; execution alone verifies and commits. */
export class RemoteRepairPlanner implements PatchPlanner {
  public constructor(private readonly gateway: string, private readonly token: string, private readonly tenantId: string, private readonly projectId: string) {
    const url = new URL(gateway);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) throw new Error("Planner requires HTTPS or loopback.");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid gateway URL.");
  }
  public async plan(context: PlannerContext, signal?: AbortSignal) {
    const timeout = AbortSignal.timeout(60000);
    const response = await fetch(new URL("/api/planner/propose", this.gateway), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}`, "X-Tenant-Id": this.tenantId },
      body: JSON.stringify({ projectId: this.projectId, ...context }), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!response.ok) throw new PlatformError(response.status, "PLANNER_REJECTED", "El planificador no autorizó una propuesta. No se omitieron los guardrails.");
    return z.object({ ok: z.literal(true), data: PatchProposalSchema }).parse(await response.json()).data;
  }
}
export async function createPlatformAgent(input: AgentConfigInput & { readonly tenantId: string; readonly apiToken: string }, gateway: string) {
  const url = new URL(gateway);
  const config = AgentConfigSchema.parse({ ...input, transportType: "http", serverUrl: new URL("/api/mcp", url).href });
  return DevGuardianAgent.create(config, { planner: new RemoteRepairPlanner(url.href, input.apiToken, input.tenantId, input.projectId) });
}
