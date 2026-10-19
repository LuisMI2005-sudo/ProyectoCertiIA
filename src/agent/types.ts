import { z } from "zod";
import { AnalyzeCodeInputSchema, FileHashSchema, RelativePathSchema, RunnerSchema } from "../shared/contracts.js";
import type { AnalyzeCodeOutput, CompareTestRunsOutput, GitBeginAttemptOutput, ReadFileContextOutput, RunTestsOutput } from "../shared/contracts.js";

export const RepairPlanSchema = z.strictObject({
  summary: z.string().trim().min(1).max(4096),
  unifiedDiff: z.string().min(1).max(1_000_000),
  expectedFileHashes: z.record(RelativePathSchema, FileHashSchema.nullable())
    .refine((hashes) => Object.keys(hashes).length > 0 && Object.keys(hashes).length <= 200,
      "A repair plan must hash each of its affected files.")
});
export interface RepairPlan extends z.infer<typeof RepairPlanSchema> {}

export const AgentRunInputSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(128),
  analysis: AnalyzeCodeInputSchema,
  runner: RunnerSchema,
  targets: z.array(RelativePathSchema).min(1).max(200).optional()
});
export interface AgentRunInput extends z.infer<typeof AgentRunInputSchema> {}

export interface RepairPlanningContext {
  readonly input: AgentRunInput;
  readonly analysis: AnalyzeCodeOutput;
  readonly baseline: RunTestsOutput;
  readonly attempt: GitBeginAttemptOutput;
  readonly fileContexts: readonly ReadFileContextOutput[];
  readonly attemptNumber: number;
}

/** A planner may be backed by an LLM, a human review queue, or deterministic test code. */
export interface RepairPlanner {
  propose(context: RepairPlanningContext): Promise<RepairPlan>;
}

export interface AgentOptions {
  readonly maxAttempts?: number;
}

export interface RepairOutcome {
  readonly verification: CompareTestRunsOutput;
  readonly candidate: RunTestsOutput;
}
