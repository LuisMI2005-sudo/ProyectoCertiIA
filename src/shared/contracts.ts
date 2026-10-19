import { z } from "zod";
import path from "node:path";
import { ErrorCode, ValidationError } from "./errors.js";
import type { Result } from "./errors.js";
import { isWorkspaceRelativePath } from "./path-security.js";

export const Limits = {
  maxPaths: 200,
  maxFileContextCharacters: 100_000,
  maxPatchCharacters: 1_000_000,
  maxLogCharacters: 100_000,
  maxTestCases: 100_000,
  defaultTimeoutMs: 60_000,
  maxTimeoutMs: 300_000
} as const;

export const RelativePathSchema = z.string().max(4096).refine(isWorkspaceRelativePath, "Unsafe relative path.");
export const IdentifierSchema = z.uuid();
export const FileHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const CommitHashSchema = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u);
export const TimestampSchema = z.iso.datetime();
export const TimeoutSchema = z.number().int().min(1).max(Limits.maxTimeoutMs);
export const RunnerSchema = z.enum(["jest", "pytest"]);
export type Runner = z.infer<typeof RunnerSchema>;
const TextSchema = z.string().max(Limits.maxFileContextCharacters);
const PathsSchema = z.array(RelativePathSchema).min(1).max(Limits.maxPaths)
  .refine((paths) => new Set(paths).size === paths.length, "Duplicate paths.");
const CountSchema = z.number().int().nonnegative();
const LineSchema = z.number().int().positive();
const GitPathSchema = z.string().min(1).max(4096);

export const ErrorPayloadSchema = z.strictObject({
  code: z.enum(Object.values(ErrorCode)),
  message: z.string().min(1).max(8192),
  retryable: z.boolean(),
  details: z.record(z.string(), z.json()).optional()
});

export function resultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data }),
    z.strictObject({ ok: z.literal(false), error: ErrorPayloadSchema })
  ]);
}

export function parseContract<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Input does not satisfy its contract.", {
      details: {
        issues: parsed.error.issues.slice(0, 50).map((issue) => ({
          path: issue.path.map(String).join("."), code: issue.code, message: issue.message
        }))
      }
    });
  }
  return parsed.data;
}

export const SourcePositionSchema = z.strictObject({ line: LineSchema, column: LineSchema });
export interface SourcePosition extends z.infer<typeof SourcePositionSchema> {}
export const SourceRangeSchema = z.strictObject({
  start: SourcePositionSchema,
  end: SourcePositionSchema
}).refine(({ start, end }) => end.line > start.line ||
  (end.line === start.line && end.column >= start.column), "Invalid source range.");
export interface SourceRange extends z.infer<typeof SourceRangeSchema> {}

export const DiagnosticSchema = z.strictObject({
  path: RelativePathSchema,
  source: z.enum(["typescript", "eslint", "parser"]),
  code: z.string().min(1).max(256),
  severity: z.enum(["error", "warning", "info"]),
  message: TextSchema,
  range: SourceRangeSchema.nullable()
});
export interface Diagnostic extends z.infer<typeof DiagnosticSchema> {}

export const SymbolSchema = z.strictObject({
  path: RelativePathSchema,
  name: z.string().min(1).max(1024),
  kind: z.enum(["function", "method", "class", "interface", "type", "variable", "module"]),
  signature: TextSchema,
  range: SourceRangeSchema
});
export interface CodeSymbol extends z.infer<typeof SymbolSchema> {}

export const DependencySchema = z.strictObject({
  from: RelativePathSchema,
  specifier: z.string().min(1).max(4096),
  resolvedPath: RelativePathSchema.nullable(),
  external: z.boolean(),
  typeOnly: z.boolean()
});
export interface Dependency extends z.infer<typeof DependencySchema> {}

export const ReadFileContextInputSchema = z.strictObject({
  path: RelativePathSchema, startLine: LineSchema.optional(), endLine: LineSchema.optional()
}).refine(({ startLine, endLine }) => endLine === undefined || endLine >= (startLine ?? 1), "Invalid line interval.");
export const ReadFileContextOutputSchema = z.strictObject({
  path: RelativePathSchema, content: TextSchema, startLine: LineSchema, endLine: CountSchema,
  fileHash: FileHashSchema, truncated: z.boolean()
});
export interface ReadFileContextInput extends z.infer<typeof ReadFileContextInputSchema> {}
export interface ReadFileContextOutput extends z.infer<typeof ReadFileContextOutputSchema> {}

export const AnalyzeCodeInputSchema = z.strictObject({
  paths: PathsSchema,
  checks: z.array(z.enum(["syntax", "semantic", "lint"])).min(1).max(3)
    .refine((checks) => new Set(checks).size === checks.length, "Duplicate checks.")
});
export const AnalyzeCodeOutputSchema = z.strictObject({
  analysisId: IdentifierSchema,
  diagnostics: z.array(DiagnosticSchema).max(10_000),
  affectedSymbols: z.array(SymbolSchema).max(10_000),
  dependencies: z.array(DependencySchema).max(10_000),
  analyzedFiles: PathsSchema,
  truncated: z.boolean()
});
export interface AnalyzeCodeInput extends z.infer<typeof AnalyzeCodeInputSchema> {}
export interface AnalyzeCodeOutput extends z.infer<typeof AnalyzeCodeOutputSchema> {}

export const GetSymbolContextInputSchema = z.strictObject({ path: RelativePathSchema, line: LineSchema });
export const GetSymbolContextOutputSchema = z.strictObject({
  symbol: SymbolSchema, signature: TextSchema, range: SourceRangeSchema, source: TextSchema,
  imports: z.array(DependencySchema).max(10_000),
  references: z.array(z.strictObject({ path: RelativePathSchema, range: SourceRangeSchema })).max(10_000),
  fileHash: FileHashSchema,
  truncated: z.boolean()
});
export interface GetSymbolContextInput extends z.infer<typeof GetSymbolContextInputSchema> {}
export interface GetSymbolContextOutput extends z.infer<typeof GetSymbolContextOutputSchema> {}

export const ProcessResultSchema = z.strictObject({
  exitCode: z.number().int().nullable(),
  signal: z.string().max(64).nullable(),
  durationMs: z.number().nonnegative(),
  timedOut: z.boolean(),
  cancelled: z.boolean(),
  stdout: z.string().max(Limits.maxLogCharacters),
  stderr: z.string().max(Limits.maxLogCharacters),
  truncated: z.boolean()
});
export interface ProcessResult extends z.infer<typeof ProcessResultSchema> {}

export const TestCaseSchema = z.strictObject({
  id: z.string().min(1).max(4096),
  path: RelativePathSchema,
  name: z.string().min(1).max(4096),
  status: z.enum(["passed", "failed", "skipped", "todo"]),
  durationMs: z.number().nonnegative().nullable(),
  failureMessage: TextSchema.nullable()
});
export interface TestCase extends z.infer<typeof TestCaseSchema> {}

export const TestSummarySchema = z.strictObject({
  total: CountSchema, passed: CountSchema, failed: CountSchema, skipped: CountSchema, todo: CountSchema
}).refine((value) => value.total === value.passed + value.failed + value.skipped + value.todo,
  "Test counts do not match the total.");
export interface TestSummary extends z.infer<typeof TestSummarySchema> {}

export const RunTestsInputSchema = z.strictObject({
  runner: RunnerSchema, targets: PathsSchema.optional(), timeoutMs: TimeoutSchema.optional()
});
export const RunTestsOutputSchema = z.strictObject({
  runId: IdentifierSchema,
  runner: RunnerSchema,
  status: z.enum(["passed", "failed", "timeout", "error", "cancelled"]),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  summary: TestSummarySchema,
  cases: z.array(TestCaseSchema).max(Limits.maxTestCases),
  stdout: z.string().max(Limits.maxLogCharacters),
  stderr: z.string().max(Limits.maxLogCharacters),
  truncated: z.boolean(),
  complete: z.boolean(),
  startedAt: TimestampSchema,
  finishedAt: TimestampSchema,
  workspaceStateHash: FileHashSchema,
  configurationHash: FileHashSchema
}).superRefine((value, context) => {
  if (new Set(value.cases.map((test) => test.id)).size !== value.cases.length) {
    context.addIssue({ code: "custom", message: "Duplicate test identifiers.", path: ["cases"] });
  }
  if (Date.parse(value.finishedAt) < Date.parse(value.startedAt)) {
    context.addIssue({ code: "custom", message: "Invalid run timestamps.", path: ["finishedAt"] });
  }
  if (value.complete && value.cases.length !== value.summary.total) {
    context.addIssue({ code: "custom", message: "Complete run must include every test.", path: ["cases"] });
  }
  if (value.complete) {
    for (const status of ["passed", "failed", "skipped", "todo"] as const) {
      if (value.cases.filter((test) => test.status === status).length !== value.summary[status]) {
        context.addIssue({ code: "custom", message: "Test statuses do not match summary.", path: ["summary", status] });
      }
    }
  }
  if (value.status === "passed" &&
      (value.exitCode !== 0 || !value.complete || value.summary.failed > 0 || value.summary.passed === 0)) {
    context.addIssue({ code: "custom", message: "Passing run requires completed successful tests.", path: ["status"] });
  }
});
export interface RunTestsInput extends z.infer<typeof RunTestsInputSchema> {}
export interface RunTestsOutput extends z.infer<typeof RunTestsOutputSchema> {}

export const CompareTestRunsInputSchema = z.strictObject({
  baselineRunId: IdentifierSchema, candidateRunId: IdentifierSchema
}).refine((value) => value.baselineRunId !== value.candidateRunId, "Distinct runs required.");
export const CompareTestRunsOutputSchema = z.strictObject({
  resolvedFailures: z.array(z.string().min(1).max(4096)).max(Limits.maxTestCases),
  newFailures: z.array(z.string().min(1).max(4096)).max(Limits.maxTestCases),
  missingTests: z.array(z.string().min(1).max(4096)).max(Limits.maxTestCases),
  comparable: z.boolean(),
  verdict: z.enum(["success", "regression", "inconclusive"])
}).refine((value) => value.verdict !== "success" ||
  (value.comparable && value.newFailures.length === 0 && value.missingTests.length === 0 && value.resolvedFailures.length > 0),
  "Successful comparison requires resolved failures and no regressions.");
export interface CompareTestRunsInput extends z.infer<typeof CompareTestRunsInputSchema> {}
export interface CompareTestRunsOutput extends z.infer<typeof CompareTestRunsOutputSchema> {}

export const GitStatusInputSchema = z.strictObject({});
export const GitStatusOutputSchema = z.strictObject({
  branch: z.string().min(1).max(1024).nullable(),
  headCommit: CommitHashSchema.nullable(),
  clean: z.boolean(),
  staged: z.array(GitPathSchema), modified: z.array(GitPathSchema),
  untracked: z.array(GitPathSchema), conflicted: z.array(GitPathSchema)
}).refine((value) => value.clean ===
  (value.staged.length + value.modified.length + value.untracked.length + value.conflicted.length === 0),
  "Clean flag conflicts with Git status.");
export interface GitStatusInput extends z.infer<typeof GitStatusInputSchema> {}
export interface GitStatusOutput extends z.infer<typeof GitStatusOutputSchema> {}

const FixBranchSchema = z.string().regex(/^fix\/[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(132);
const SessionFields = { sessionId: IdentifierSchema };
const AttemptFields = { ...SessionFields, attemptId: IdentifierSchema };
export const GitCreateFixBranchInputSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(128), expectedHead: CommitHashSchema
});
export const GitCreateFixBranchOutputSchema = z.strictObject({
  ...SessionFields, branch: FixBranchSchema, baseBranch: z.string().min(1).max(1024), baseCommit: CommitHashSchema
});
export interface GitCreateFixBranchInput extends z.infer<typeof GitCreateFixBranchInputSchema> {}
export interface GitCreateFixBranchOutput extends z.infer<typeof GitCreateFixBranchOutputSchema> {}

export const GitBeginAttemptInputSchema = z.strictObject(SessionFields);
export const GitBeginAttemptOutputSchema = z.strictObject({
  attemptId: IdentifierSchema, checkpointCommit: CommitHashSchema
});
export interface GitBeginAttemptInput extends z.infer<typeof GitBeginAttemptInputSchema> {}
export interface GitBeginAttemptOutput extends z.infer<typeof GitBeginAttemptOutputSchema> {}

export const GitApplyPatchInputSchema = z.strictObject({
  ...AttemptFields,
  unifiedDiff: z.string().min(1).max(Limits.maxPatchCharacters),
  // Null denotes an expected absent file, allowing safe additions.
  expectedFileHashes: z.record(RelativePathSchema, FileHashSchema.nullable())
    .refine((hashes) => Object.keys(hashes).length > 0 && Object.keys(hashes).length <= Limits.maxPaths,
      "Expected hashes required for each affected file.")
});
export const GitApplyPatchOutputSchema = z.strictObject({
  applied: z.literal(true), changedFiles: PathsSchema, diffHash: FileHashSchema
});
export interface GitApplyPatchInput extends z.infer<typeof GitApplyPatchInputSchema> {}
export interface GitApplyPatchOutput extends z.infer<typeof GitApplyPatchOutputSchema> {}

export const GitDiffInputSchema = z.strictObject(AttemptFields);
export const GitDiffOutputSchema = z.strictObject({
  diff: z.string().max(Limits.maxPatchCharacters), diffHash: FileHashSchema,
  changedFiles: z.array(RelativePathSchema).max(Limits.maxPaths),
  insertions: CountSchema, deletions: CountSchema
});
export interface GitDiffInput extends z.infer<typeof GitDiffInputSchema> {}
export interface GitDiffOutput extends z.infer<typeof GitDiffOutputSchema> {}

export const GitCommitFixInputSchema = z.strictObject({
  ...AttemptFields, message: z.string().trim().min(1).max(4096).refine((text) => !text.includes("\0")),
  expectedDiffHash: FileHashSchema, verificationRunId: IdentifierSchema
});
export const GitCommitFixOutputSchema = z.strictObject({
  commit: CommitHashSchema, branch: FixBranchSchema, files: PathsSchema
});
export interface GitCommitFixInput extends z.infer<typeof GitCommitFixInputSchema> {}
export interface GitCommitFixOutput extends z.infer<typeof GitCommitFixOutputSchema> {}

export const GitRollbackAttemptInputSchema = z.strictObject(AttemptFields);
export const GitRollbackAttemptOutputSchema = z.strictObject({
  restoredCommit: CommitHashSchema, revertedFiles: z.array(RelativePathSchema).max(Limits.maxPaths),
  branch: FixBranchSchema, clean: z.boolean()
});
export interface GitRollbackAttemptInput extends z.infer<typeof GitRollbackAttemptInputSchema> {}
export interface GitRollbackAttemptOutput extends z.infer<typeof GitRollbackAttemptOutputSchema> {}

/** Git can report unsafe names; mutation tools must validate them separately. */
export const ToolSchemas = {
  read_file_context: { input: ReadFileContextInputSchema, output: ReadFileContextOutputSchema },
  analyze_code: { input: AnalyzeCodeInputSchema, output: AnalyzeCodeOutputSchema },
  get_symbol_context: { input: GetSymbolContextInputSchema, output: GetSymbolContextOutputSchema },
  run_tests: { input: RunTestsInputSchema, output: RunTestsOutputSchema },
  compare_test_runs: { input: CompareTestRunsInputSchema, output: CompareTestRunsOutputSchema },
  git_status: { input: GitStatusInputSchema, output: GitStatusOutputSchema },
  git_create_fix_branch: { input: GitCreateFixBranchInputSchema, output: GitCreateFixBranchOutputSchema },
  git_begin_attempt: { input: GitBeginAttemptInputSchema, output: GitBeginAttemptOutputSchema },
  git_apply_patch: { input: GitApplyPatchInputSchema, output: GitApplyPatchOutputSchema },
  git_diff: { input: GitDiffInputSchema, output: GitDiffOutputSchema },
  git_commit_fix: { input: GitCommitFixInputSchema, output: GitCommitFixOutputSchema },
  git_rollback_attempt: { input: GitRollbackAttemptInputSchema, output: GitRollbackAttemptOutputSchema }
} as const;
export type ToolName = keyof typeof ToolSchemas;
export type ToolInput<T extends ToolName> = z.infer<(typeof ToolSchemas)[T]["input"]>;
export type ToolOutput<T extends ToolName> = z.infer<(typeof ToolSchemas)[T]["output"]>;
export type ToolHandler<T extends ToolName> = (input: ToolInput<T>) => Promise<Result<ToolOutput<T>>>;

export const RunnerConfigurationSchema = z.strictObject({
  runner: RunnerSchema,
  executable: z.string().min(1).max(4096),
  args: z.array(z.string().max(4096)).max(100),
  timeoutMs: TimeoutSchema,
  maxOutputBytes: z.number().int().min(1024).max(10_000_000)
});
export interface RunnerConfiguration extends z.infer<typeof RunnerConfigurationSchema> {}

/** Trusted startup configuration, never tool input supplied by the LLM. */
export const ProjectConfigurationSchema = z.strictObject({
  workspaceRoot: z.string().min(1).max(4096).refine((root) => path.isAbsolute(root), "Absolute root required."),
  transport: z.enum(["stdio", "sse"]),
  runners: z.array(RunnerConfigurationSchema).min(1).max(2)
    .refine((runners) => new Set(runners.map((runner) => runner.runner)).size === runners.length),
  maxAttempts: z.number().int().min(1).max(10),
  model: z.string().min(1).max(256)
});
export interface ProjectConfiguration extends z.infer<typeof ProjectConfigurationSchema> {}

export interface CodeAnalyzer {
  readFileContext(input: ReadFileContextInput): Promise<ReadFileContextOutput>;
  analyzeCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput>;
  getSymbolContext(input: GetSymbolContextInput): Promise<GetSymbolContextOutput>;
}
export interface TestRunner {
  runTests(input: RunTestsInput): Promise<RunTestsOutput>;
  compareTestRuns(input: CompareTestRunsInput): Promise<CompareTestRunsOutput>;
}
export interface GitController {
  status(input: GitStatusInput): Promise<GitStatusOutput>;
  createFixBranch(input: GitCreateFixBranchInput): Promise<GitCreateFixBranchOutput>;
  beginAttempt(input: GitBeginAttemptInput): Promise<GitBeginAttemptOutput>;
  applyPatch(input: GitApplyPatchInput): Promise<GitApplyPatchOutput>;
  diff(input: GitDiffInput): Promise<GitDiffOutput>;
  commitFix(input: GitCommitFixInput): Promise<GitCommitFixOutput>;
  rollbackAttempt(input: GitRollbackAttemptInput): Promise<GitRollbackAttemptOutput>;
}
export interface McpToolClient {
  callTool<T extends ToolName>(name: T, input: ToolInput<T>): Promise<Result<ToolOutput<T>>>;
}
export interface VerificationEvidence {
  readonly baseline: RunTestsOutput;
  readonly candidate: RunTestsOutput;
  readonly comparison: CompareTestRunsOutput;
}
export interface VerificationStore {
  getEvidence(verificationRunId: string): Promise<VerificationEvidence>;
}
export interface RepairSession {
  readonly sessionId: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly baseCommit: string;
  readonly createdAt: string;
}
export interface RepairAttempt {
  readonly attemptId: string;
  readonly sessionId: string;
  readonly checkpointCommit: string;
  readonly state: "open" | "applied" | "committed" | "rolled_back";
  readonly changedFiles: readonly string[];
}
export interface AgentRunResult {
  readonly status: "fixed" | "not_needed" | "exhausted" | "cancelled";
  readonly sessionId: string | null;
  readonly attempts: number;
  readonly commit: string | null;
  readonly lastVerification: CompareTestRunsOutput | null;
}
