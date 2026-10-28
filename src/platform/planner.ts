import { z } from "zod";
import { randomUUID } from "node:crypto";
import { RepairPlanner } from "../agent-client/planner.js";
import { AgentConfigSchema } from "../agent-client/types.js";
import { AnalyzeCodeOutputSchema, ReadFileContextOutputSchema, RunTestsOutputSchema, RelativePathSchema } from "../shared/contracts.js";
import { PlatformError, requireWrite } from "./contracts.js";
import type { PlatformConfig } from "./contracts.js";
import { listen, readBody, send } from "./http.js";
import { verifyServiceToken } from "./security.js";
import { DomainStore } from "./store.js";

const ProposalRequest = z.strictObject({ projectId: z.uuid(), targetPath: RelativePathSchema, analysis: AnalyzeCodeOutputSchema,
  source: ReadFileContextOutputSchema, baseline: RunTestsOutputSchema, feedback: z.array(z.string().max(4000)).max(10), attempt: z.number().int().min(1).max(10) });
export async function startPlanner(config: PlatformConfig) {
  if (!config.databaseUrl) throw new Error("Planner database required.");
  const store = new DomainStore(config.databaseUrl, "planner");
  const server = await listen(config, async (request, response) => {
    const context = verifyServiceToken(config, "planner", request.headers.authorization?.slice(7), ["gateway", "audits"]);
    if (!context) throw new PlatformError(401, "TENANT_REQUIRED", "Organización requerida.");
    requireWrite(context);
    if (request.url !== "/api/planner/propose" || request.method !== "POST") throw new PlatformError(404, "NOT_FOUND", "Ruta no encontrada.");
    if (!process.env["ANTHROPIC_API_KEY"]) throw new PlatformError(503, "MODEL_UNCONFIGURED", "El proveedor de IA no está configurado; el análisis estático sigue disponible.");
    const input = ProposalRequest.parse(await readBody(request)), id = randomUUID();
    await store.save(context, "generation", id, { projectId: input.projectId, targetPath: input.targetPath }, "requested", null);
    try {
      const planner = new RepairPlanner(AgentConfigSchema.parse({ projectId: input.projectId, targetPath: input.targetPath, runner: input.baseline.runner, targets: [input.targetPath] }));
      const proposal = await planner.plan(input);
      await store.save(context, "generation", id, { projectId: input.projectId }, "proposed", 1);
      send(response, 200, { ok: true, data: proposal });
    } catch {
      await store.save(context, "generation", id, { projectId: input.projectId }, "failed", 1);
      throw new PlatformError(502, "GENERATION_FAILED", "No se obtuvo una propuesta válida. No se modificó el repositorio.");
    }
  });
  return { server, close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); await store.close(); } };
}
