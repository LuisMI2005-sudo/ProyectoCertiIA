import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import {
  AnalyzeCodeOutputSchema, AnalyzeCodeInputSchema, GetSymbolContextInputSchema, GetSymbolContextOutputSchema,
  GitApplyPatchInputSchema, GitApplyPatchOutputSchema, GitBeginAttemptInputSchema, GitBeginAttemptOutputSchema,
  GitCommitFixInputSchema, GitCommitFixOutputSchema, GitCreateFixBranchInputSchema, GitCreateFixBranchOutputSchema,
  GitDiffInputSchema, GitDiffOutputSchema, GitRollbackAttemptInputSchema, GitRollbackAttemptOutputSchema,
  GitStatusInputSchema, GitStatusOutputSchema, ReadFileContextInputSchema, ReadFileContextOutputSchema
} from "../shared/contracts.js";
import type {
  AnalyzeCodeInput, GetSymbolContextInput, GitApplyPatchInput, GitBeginAttemptInput, GitCommitFixInput,
  GitCreateFixBranchInput, GitDiffInput, GitRollbackAttemptInput, GitStatusInput, ReadFileContextInput,
  VerificationStore
} from "../shared/contracts.js";
import type { Result } from "../shared/errors.js";
import { CodeAnalyzer } from "../analyzer/index.js";
import { GitController } from "../git-controller/index.js";

const SERVER_NAME = "devguardian";
const SERVER_VERSION = "0.1.0";

type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly input: typeof ReadFileContextInputSchema | typeof AnalyzeCodeInputSchema | typeof GetSymbolContextInputSchema |
    typeof GitStatusInputSchema | typeof GitCreateFixBranchInputSchema | typeof GitBeginAttemptInputSchema |
    typeof GitApplyPatchInputSchema | typeof GitDiffInputSchema | typeof GitCommitFixInputSchema |
    typeof GitRollbackAttemptInputSchema;
  readonly output: typeof ReadFileContextOutputSchema | typeof AnalyzeCodeOutputSchema | typeof GetSymbolContextOutputSchema |
    typeof GitStatusOutputSchema | typeof GitCreateFixBranchOutputSchema | typeof GitBeginAttemptOutputSchema |
    typeof GitApplyPatchOutputSchema | typeof GitDiffOutputSchema | typeof GitCommitFixOutputSchema |
    typeof GitRollbackAttemptOutputSchema;
  readonly handler: (input: unknown) => Promise<Result<unknown>>;
};

const unavailableVerificationStore: VerificationStore = {
  async getEvidence(): Promise<never> {
    throw new Error("Verification evidence is unavailable until the Phase 4 test runner is configured.");
  }
};

/** Formats every domain response consistently for MCP clients and human inspection. */
function toolResponse(result: Result<unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result,
    ...(result.ok ? {} : { isError: true })
  };
}

/**
 * MCP boundary for the currently implemented DevGuardian domain services.
 * Trusted configuration is supplied at construction time, never by a tool call.
 */
export class DevGuardianMcpServer {
  public readonly mcp: McpServer;

  private constructor(private readonly analyzer: CodeAnalyzer, private readonly git: GitController) {
    this.mcp = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { maxToolInputElements: 10_000 });
    this.registerTools();
    this.registerResources();
  }

  public static async create(workspaceRoot: string): Promise<DevGuardianMcpServer> {
    const [analyzer, git] = await Promise.all([
      CodeAnalyzer.create({ workspaceRoot }),
      GitController.create({ workspaceRoot, verificationStore: unavailableVerificationStore })
    ]);
    return new DevGuardianMcpServer(analyzer, git);
  }

  public async connectStdio(): Promise<void> {
    await this.mcp.connect(new StdioServerTransport());
  }

  private registerTools(): void {
    const tools: readonly ToolDefinition[] = [
      {
        name: "read_file_context", description: "Reads a bounded UTF-8 source-file context without leaving the workspace.",
        input: ReadFileContextInputSchema, output: ReadFileContextOutputSchema,
        handler: (input) => this.analyzer.tools.read_file_context(input as ReadFileContextInput)
      },
      {
        name: "analyze_code", description: "Runs bounded TypeScript syntax, semantic and lint analysis.",
        input: AnalyzeCodeInputSchema, output: AnalyzeCodeOutputSchema,
        handler: (input) => this.analyzer.tools.analyze_code(input as AnalyzeCodeInput)
      },
      {
        name: "get_symbol_context", description: "Returns the most specific symbol, imports and references at a source line.",
        input: GetSymbolContextInputSchema, output: GetSymbolContextOutputSchema,
        handler: (input) => this.analyzer.tools.get_symbol_context(input as GetSymbolContextInput)
      },
      {
        name: "git_status", description: "Reports repository status without modifying the workspace.",
        input: GitStatusInputSchema, output: GitStatusOutputSchema,
        handler: (input) => this.git.tools.git_status(input as GitStatusInput)
      },
      {
        name: "git_create_fix_branch", description: "Creates a guarded fix branch from an expected clean commit.",
        input: GitCreateFixBranchInputSchema, output: GitCreateFixBranchOutputSchema,
        handler: (input) => this.git.tools.git_create_fix_branch(input as GitCreateFixBranchInput)
      },
      {
        name: "git_begin_attempt", description: "Starts a checkpointed repair attempt in a fix branch.",
        input: GitBeginAttemptInputSchema, output: GitBeginAttemptOutputSchema,
        handler: (input) => this.git.tools.git_begin_attempt(input as GitBeginAttemptInput)
      },
      {
        name: "git_apply_patch", description: "Validates and applies a hash-guarded unified patch.",
        input: GitApplyPatchInputSchema, output: GitApplyPatchOutputSchema,
        handler: (input) => this.git.tools.git_apply_patch(input as GitApplyPatchInput)
      },
      {
        name: "git_diff", description: "Calculates the bounded diff belonging to an active repair attempt.",
        input: GitDiffInputSchema, output: GitDiffOutputSchema,
        handler: (input) => this.git.tools.git_diff(input as GitDiffInput)
      },
      {
        name: "git_commit_fix", description: "Commits a verified repair whose expected diff still matches.",
        input: GitCommitFixInputSchema, output: GitCommitFixOutputSchema,
        handler: (input) => this.git.tools.git_commit_fix(input as GitCommitFixInput)
      },
      {
        name: "git_rollback_attempt", description: "Reverts only the files owned by an active repair attempt.",
        input: GitRollbackAttemptInputSchema, output: GitRollbackAttemptOutputSchema,
        handler: (input) => this.git.tools.git_rollback_attempt(input as GitRollbackAttemptInput)
      }
    ];

    for (const tool of tools) {
      this.mcp.registerTool(tool.name, {
        description: tool.description,
        inputSchema: tool.input
      }, async (input: unknown) => toolResponse(await tool.handler(input)));
    }
  }

  private registerResources(): void {
    const analysisTemplate = new ResourceTemplate("devguardian://analysis/{analysisId}", { list: undefined });
    this.mcp.registerResource("analysis", analysisTemplate, {
      description: "A stored static-analysis result, available until its configured TTL expires.",
      mimeType: "application/json"
    }, async (uri, variables) => {
      const analysisId = typeof variables.analysisId === "string" ? variables.analysisId : "";
      const result = this.analyzer.getAnalysis(analysisId);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result) }] };
    });
  }
}

export async function startStdioServer(workspaceRoot = process.env.DEVGUARDIAN_WORKSPACE ?? process.cwd()): Promise<void> {
  const server = await DevGuardianMcpServer.create(workspaceRoot);
  await server.connectStdio();
}

const executedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (executedDirectly) {
  startStdioServer().catch((error: unknown) => {
    console.error("DevGuardian MCP server failed to start.", error);
    process.exitCode = 1;
  });
}
