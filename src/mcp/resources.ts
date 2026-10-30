import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode as McpCode } from "@modelcontextprotocol/sdk/types.js";
import { IdentifierSchema } from "../shared/contracts.js";
import { AnalysisError, DevGuardianError, ErrorCode } from "../shared/errors.js";
import { HttpError } from "../server/contracts.js";
import type { DevGuardianBackend } from "../server/application.js";

const projectPattern = /^devguardian:\/\/project\/([^/?#]+)\/(configuration|structure)$/u;
const analysisPattern = /^devguardian:\/\/analysis\/([^/?#]+)\?projectId=([^&#/?]+)$/u;
const invalid = (): McpError => new McpError(McpCode.InvalidParams, "Invalid project resource URI or cursor.");
function identify(uri: string): { projectId: string; kind: "configuration" | "structure" | "analysis"; analysisId?: string } {
  if (uri.length > 256) throw invalid();
  const project = projectPattern.exec(uri);
  if (project && project[0] === uri && IdentifierSchema.safeParse(project[1]).success)
    return { projectId: project[1]!, kind: project[2] as "configuration" | "structure" };
  const analysis = analysisPattern.exec(uri);
  if (analysis && analysis[0] === uri && IdentifierSchema.safeParse(analysis[1]).success && IdentifierSchema.safeParse(analysis[2]).success)
    return { projectId: analysis[2]!, kind: "analysis", analysisId: analysis[1]! };
  throw invalid();
}
/** Translate errors without forwarding filesystem paths, database messages or cause chains. */
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error: unknown) {
    if (error instanceof McpError) throw error;
    if (error instanceof AnalysisError) throw new McpError(-32002, "Analysis is unknown, expired or evicted.", { code: "ANALYSIS_NOT_FOUND" });
    if (error instanceof HttpError && [403, 404].includes(error.status))
      throw new McpError(-32002, "Resource not found or not accessible.", { code: "RESOURCE_NOT_FOUND" });
    if (error instanceof DevGuardianError && error.code === ErrorCode.WORKSPACE_UNAVAILABLE)
      throw new McpError(-32002, "Project workspace is unavailable.", { code: ErrorCode.WORKSPACE_UNAVAILABLE });
    throw new McpError(McpCode.InternalError, "Unable to read project resource.");
  }
}

export function registerProjectResources(server: Server, backend: DevGuardianBackend): void {
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => safe(async () => {
    const cursor = request.params?.cursor;
    if (cursor !== undefined && identify(cursor).kind === "analysis") throw invalid();
    const entries = (await backend.projects()).flatMap((project) => (["configuration", "structure"] as const).map((kind) => ({
      uri: `devguardian://project/${project.id}/${kind}`, name: `${project.id}/${kind}`,
      description: kind === "configuration" ? "Safe project configuration metadata." : "Bounded project file structure without secrets or Git metadata.",
      mimeType: "application/json"
    }))).sort((a, b) => a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0);
    const remaining = cursor === undefined ? entries : entries.filter((entry) => entry.uri > cursor);
    const resources = remaining.slice(0, 50);
    return { resources, ...(remaining.length > resources.length ? { nextCursor: resources.at(-1)!.uri } : {}) };
  }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async (request) => {
    if (request.params?.cursor !== undefined) throw invalid();
    return { resourceTemplates: [
      { uriTemplate: "devguardian://project/{projectId}/configuration", name: "project-configuration", mimeType: "application/json" },
      { uriTemplate: "devguardian://project/{projectId}/structure", name: "project-structure", mimeType: "application/json" },
      { uriTemplate: "devguardian://analysis/{analysisId}?projectId={projectId}", name: "project-analysis", mimeType: "application/json",
        description: "Existing analyze_code result in this project's cache; no analysis is re-executed. Expired or evicted IDs return -32002." }
    ] };
  });
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => safe(async () => {
    const uri = request.params.uri;
    const { projectId, kind, analysisId } = identify(uri);
    const value = await backend.projectResource(projectId, kind, analysisId);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value) }] };
  }));
}
