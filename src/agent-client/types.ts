import { z } from "zod";
import { IdentifierSchema, RelativePathSchema, RunnerSchema } from "../shared/contracts.js";
import type { AnalyzeCodeOutput, ReadFileContextOutput, RunTestsOutput } from "../shared/contracts.js";

export const AgentStateSchema = z.enum(["idle", "analyzing", "baseline_testing", "generating_patch", "applying_patch",
  "verifying_candidate", "committed", "rolled_back", "failed"]);
export type AgentState = z.infer<typeof AgentStateSchema>;
export const AgentConfigSchema = z.strictObject({
  projectId: IdentifierSchema, targetPath: RelativePathSchema,
  runner: RunnerSchema, targets: z.array(RelativePathSchema).min(1).max(200).refine((items) => new Set(items).size === items.length),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  modelName: z.string().trim().min(1).max(200).default(() => process.env["DEVGUARDIAN_MODEL"] ?? "claude-sonnet-4-6"),
  apiKey: z.string().min(1).max(4096).optional(), transportType: z.enum(["http", "stdio"]).default("http"),
  serverUrl: z.url().optional(), apiToken: z.string().min(1).max(4096).optional(),
  maxDurationMs: z.number().int().min(100).max(900000).default(300000),
  planningTimeoutMs: z.number().int().min(100).max(120000).default(45000),
  callTimeoutMs: z.number().int().min(100).max(360000).default(45000),
  maxContextCharacters: z.number().int().min(1000).max(60000).default(40000)
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentConfigInput = z.input<typeof AgentConfigSchema>;

export const PatchProposalSchema = z.strictObject({
  explanation: z.string().trim().min(1).max(4000), targetPath: RelativePathSchema,
  replacementCode: z.string().max(100000).optional(), unifiedDiff: z.string().min(1).max(1000000).optional()
}).refine((proposal) => (proposal.replacementCode === undefined) !== (proposal.unifiedDiff === undefined),
  "Provide exactly one replacementCode or unifiedDiff.");
export type PatchProposal = z.infer<typeof PatchProposalSchema>;
export interface AgentHistoryEntry {
  readonly state: AgentState; readonly attempt: number; readonly message: string; readonly timestamp: string;
}
export interface HookDecisionCaught {
  readonly decision: "block"; readonly reason: string; readonly auditId?: string;
  readonly hookId?: string; readonly event?: string;
}
export interface AgentExecutionResult {
  readonly success: boolean; readonly finalState: AgentState; readonly attemptsUsed: number;
  readonly auditId?: string; readonly commitSha?: string; readonly history: readonly AgentHistoryEntry[];
  readonly hookDecisionsCaught: readonly HookDecisionCaught[]; readonly durationMs: number;
  readonly recoveryRequired: boolean;
}
export interface PlannerContext {
  readonly targetPath: string; readonly analysis: AnalyzeCodeOutput; readonly source: ReadFileContextOutput;
  readonly baseline: RunTestsOutput; readonly feedback: readonly string[]; readonly attempt: number;
}
export interface PatchPlanner { plan(context: PlannerContext, signal?: AbortSignal): Promise<PatchProposal> }
export interface StructuredPatchModel {
  invoke(messages: PlannerMessage[], options: { readonly signal: AbortSignal }): Promise<unknown>;
}
export interface PlannerMessage { readonly content: string }
export interface StdioConnectionOptions {
  readonly cwd?: string; readonly serverPath?: string; readonly environment?: Readonly<Record<string, string>>;
}
