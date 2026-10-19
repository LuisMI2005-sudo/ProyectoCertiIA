import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CompareTestRunsInputSchema, CompareTestRunsOutputSchema, IdentifierSchema, Limits,
  RunTestsInputSchema, RunTestsOutputSchema, RunnerConfigurationSchema, parseContract
} from "../shared/contracts.js";
import type {
  CompareTestRunsInput, CompareTestRunsOutput, RunTestsInput, RunTestsOutput, Runner,
  RunnerConfiguration, TestRunner as TestRunnerContract, TestSummary, ToolHandler, VerificationEvidence,
  VerificationStore
} from "../shared/contracts.js";
import { TestExecutionError, ValidationError, captureResult, failure } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { runProcess } from "./process.js";
import { adapterFor } from "./reports.js";
import type {
  ParsedReport, ProcessOutcome, RunnerAdapter, StoredRun, StoredVerification, TestRunnerLimits, TestRunnerOptions
} from "./types.js";

const ENVIRONMENT_ALLOWLIST = [
  "PATH", "PATHEXT", "SystemRoot", "SystemDrive", "windir", "ComSpec", "TEMP", "TMP", "TMPDIR",
  "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "NUMBER_OF_PROCESSORS"
] as const;

const MAX_REPORT_BYTES = 50_000_000;

export interface TestRunnerTools {
  readonly run_tests: ToolHandler<"run_tests">;
  readonly compare_test_runs: ToolHandler<"compare_test_runs">;
}

function trustedEnvironment(overrides: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ENVIRONMENT_ALLOWLIST) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return { ...environment, ...overrides };
}

function limitsFor(options: TestRunnerOptions): TestRunnerLimits {
  const limits: TestRunnerLimits = {
    maxStoredRuns: options.maxStoredRuns ?? 100,
    maxStoredBytes: options.maxStoredBytes ?? 10_000_000,
    runTtlMs: options.runTtlMs ?? 300_000
  };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new ValidationError("Test runner limits must be positive safe integers.");
  }
  if (limits.maxStoredRuns > 1000 || limits.maxStoredBytes > 100_000_000 || limits.runTtlMs > 86_400_000) {
    throw new ValidationError("Test runner limits exceed supported maximums.");
  }
  return limits;
}

/** Trusted, comparable fingerprint of a runner configuration. */
function configurationHash(configuration: RunnerConfiguration): string {
  return createHash("sha256").update(JSON.stringify({
    version: 1, runner: configuration.runner, executable: configuration.executable,
    args: configuration.args, timeoutMs: configuration.timeoutMs, maxOutputBytes: configuration.maxOutputBytes
  })).digest("hex");
}

function summarize(cases: readonly RunTestsOutput["cases"][number][]): TestSummary {
  const summary = { total: cases.length, passed: 0, failed: 0, skipped: 0, todo: 0 };
  for (const test of cases) summary[test.status] += 1;
  return summary;
}

function compareRuns(baseline: RunTestsOutput, candidate: RunTestsOutput): CompareTestRunsOutput {
  const comparable = baseline.complete && candidate.complete && baseline.runner === candidate.runner &&
    baseline.configurationHash === candidate.configurationHash;
  const baselineCases = new Map(baseline.cases.map((test) => [test.id, test]));
  const candidateCases = new Map(candidate.cases.map((test) => [test.id, test]));
  const resolvedFailures: string[] = [];
  const newFailures: string[] = [];
  const missingTests: string[] = [];
  let unresolved = 0;
  for (const [id, test] of baselineCases) {
    const current = candidateCases.get(id);
    if (!current) { missingTests.push(id); continue; }
    if (test.status !== "failed") continue;
    if (current.status === "passed") resolvedFailures.push(id);
    else unresolved += 1;
  }
  for (const [id, test] of candidateCases) {
    if (test.status === "failed" && baselineCases.get(id)?.status !== "failed") newFailures.push(id);
  }
  const sorted = (values: readonly string[]): string[] => [...values].sort();
  const verdict: CompareTestRunsOutput["verdict"] = !comparable ? "inconclusive"
    : newFailures.length > 0 || missingTests.length > 0 ? "regression"
    : resolvedFailures.length > 0 && unresolved === 0 ? "success" : "inconclusive";
  return {
    resolvedFailures: sorted(resolvedFailures), newFailures: sorted(newFailures),
    missingTests: sorted(missingTests), comparable, verdict
  };
}

/**
 * Executes configured runners and stores their machine-readable results.
 * It is also the trusted `VerificationStore` consumed by the Git controller.
 */
export class TestRunner implements TestRunnerContract, VerificationStore {
  public readonly tools: TestRunnerTools;
  private readonly runs = new Map<string, StoredRun>();
  private readonly evidences = new Map<string, StoredVerification>();
  private storedBytes = 0;
  private tail: Promise<void> = Promise.resolve();
  private active: AbortController | null = null;

  private constructor(
    private readonly guard: WorkspacePathGuard,
    private readonly configurations: ReadonlyMap<Runner, RunnerConfiguration>,
    private readonly adapters: ReadonlyMap<Runner, RunnerAdapter>,
    private readonly limits: TestRunnerLimits,
    private readonly workspaceStateHash: () => Promise<string>,
    private readonly environment: Readonly<Record<string, string>>
  ) {
    this.tools = {
      run_tests: (input) => captureResult(() => this.runTests(input)),
      compare_test_runs: (input) => captureResult(() => this.compareTestRuns(input))
    };
  }

  public static async create(options: TestRunnerOptions): Promise<TestRunner> {
    const limits = limitsFor(options);
    const guard = await WorkspacePathGuard.create(options.workspaceRoot);
    const configurations = new Map<Runner, RunnerConfiguration>();
    const adapters = new Map<Runner, RunnerAdapter>();
    for (const raw of options.runners) {
      const configuration = parseContract(RunnerConfigurationSchema, raw);
      if (configurations.has(configuration.runner)) throw new ValidationError("Duplicate runner configuration.");
      configurations.set(configuration.runner, configuration);
      adapters.set(configuration.runner, adapterFor(configuration.runner));
    }
    if (configurations.size === 0) throw new ValidationError("At least one runner must be configured.");
    return new TestRunner(guard, configurations, adapters, limits, options.workspaceStateHash, options.environment ?? {});
  }

  /** Serializes runs per instance so fingerprints and stored results stay consistent. */
  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); }
    finally { release(); }
  }

  private remove(id: string): void {
    const run = this.runs.get(id);
    if (run) { this.storedBytes -= run.bytes; this.runs.delete(id); }
  }

  private expire(): void {
    const now = Date.now();
    for (const [id, run] of this.runs) if (run.expiresAt <= now) this.remove(id);
    for (const [id, entry] of this.evidences) if (entry.expiresAt <= now) this.evidences.delete(id);
  }

  private store(result: RunTestsOutput): void {
    const stored = structuredClone(result);
    const bytes = Buffer.byteLength(JSON.stringify(stored));
    if (bytes > this.limits.maxStoredBytes) throw new TestExecutionError("Test run result exceeds the configured storage budget.");
    this.expire();
    while (this.runs.size >= this.limits.maxStoredRuns || this.storedBytes + bytes > this.limits.maxStoredBytes) {
      const oldest = this.runs.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    const now = Date.now();
    this.runs.set(stored.runId, { result: stored, bytes, createdAt: now, expiresAt: now + this.limits.runTtlMs });
    this.storedBytes += bytes;
  }

  private storedRun(runId: string): RunTestsOutput {
    const id = parseContract(IdentifierSchema, runId);
    this.expire();
    const stored = this.runs.get(id);
    if (!stored) throw new TestExecutionError("Test run is unknown, expired or evicted.");
    this.runs.delete(id);
    this.runs.set(id, stored);
    return stored.result;
  }

  private async readReport(reportPath: string): Promise<string> {
    let content: Buffer;
    try { content = await readFile(reportPath); }
    catch (error: unknown) {
      throw new TestExecutionError("The runner did not produce a machine-readable report.", { cause: error });
    }
    if (content.length > MAX_REPORT_BYTES) throw new TestExecutionError("The runner report is too large.");
    return content.toString("utf8");
  }

  private classify(outcome: ProcessOutcome, report: ParsedReport | null, summary: TestSummary): RunTestsOutput["status"] {
    if (outcome.timedOut) return "timeout";
    if (outcome.cancelled) return "cancelled";
    if (outcome.spawnError !== null || report === null || report.executionError) return "error";
    if (outcome.exitCode === 0 && report.complete && summary.failed === 0 && summary.passed > 0) return "passed";
    return "failed";
  }

  public async runTests(input: RunTestsInput, signal?: AbortSignal): Promise<RunTestsOutput> {
    const parsed = parseContract(RunTestsInputSchema, input);
    return this.serialized(async () => {
      const configuration = this.configurations.get(parsed.runner);
      const adapter = this.adapters.get(parsed.runner);
      if (!configuration || !adapter) throw new ValidationError(`No trusted configuration exists for runner "${parsed.runner}".`);
      const targets = parsed.targets ?? [];
      for (const target of targets) await this.guard.resolve(target, { kind: "any" });
      const timeoutMs = Math.min(parsed.timeoutMs ?? configuration.timeoutMs, configuration.timeoutMs);
      const maxOutputBytes = Math.min(configuration.maxOutputBytes, Limits.maxLogCharacters);
      const directory = await mkdtemp(path.join(tmpdir(), "devguardian-run-"));
      const reportPath = path.join(directory, "report.json");
      const workspaceStateHash = await this.workspaceStateHash();
      const controller = new AbortController();
      const forward = (): void => controller.abort();
      this.active = controller;
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", forward, { once: true });
      }
      const startedAt = new Date();
      let outcome: ProcessOutcome;
      try {
        outcome = await runProcess({
          executable: configuration.executable,
          args: [...configuration.args, ...adapter.reportArgs(reportPath), ...targets],
          cwd: this.guard.root, env: trustedEnvironment(this.environment),
          timeoutMs, maxOutputBytes, signal: controller.signal
        });
      } finally {
        this.active = null;
        signal?.removeEventListener("abort", forward);
      }
      const finishedAt = new Date();
      let report: ParsedReport | null = null;
      let reportError: string | null = null;
      if (!outcome.timedOut && !outcome.cancelled && outcome.spawnError === null) {
        try { report = adapter.parseReport(await this.readReport(reportPath), this.guard.root); }
        catch (error: unknown) {
          reportError = error instanceof TestExecutionError ? error.message : "The runner report could not be parsed.";
        }
      }
      await rm(directory, { recursive: true, force: true });
      const cases = report?.cases ?? [];
      const summary = summarize(cases);
      const complete = report?.complete ?? false;
      const stderr = [outcome.stderr, outcome.spawnError, reportError]
        .filter((value): value is string => value !== null && value.length > 0)
        .join("\n").slice(0, Limits.maxLogCharacters);
      const result = parseContract(RunTestsOutputSchema, {
        runId: randomUUID(), runner: parsed.runner, status: this.classify(outcome, report, summary),
        exitCode: outcome.exitCode, durationMs: outcome.durationMs, summary, cases,
        stdout: outcome.stdout, stderr, truncated: outcome.truncated, complete,
        startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        workspaceStateHash, configurationHash: configurationHash(configuration)
      });
      this.store(result);
      return result;
    });
  }

  public async compareTestRuns(input: CompareTestRunsInput): Promise<CompareTestRunsOutput> {
    const parsed = parseContract(CompareTestRunsInputSchema, input);
    const baseline = this.storedRun(parsed.baselineRunId);
    const candidate = this.storedRun(parsed.candidateRunId);
    return parseContract(CompareTestRunsOutputSchema, compareRuns(baseline, candidate));
  }

  /** Compares two stored runs and registers the evidence the Git controller requires. */
  public async verify(baselineRunId: string, candidateRunId: string): Promise<CompareTestRunsOutput> {
    const parsed = parseContract(CompareTestRunsInputSchema, { baselineRunId, candidateRunId });
    const baseline = this.storedRun(parsed.baselineRunId);
    const candidate = this.storedRun(parsed.candidateRunId);
    const comparison = parseContract(CompareTestRunsOutputSchema, compareRuns(baseline, candidate));
    this.expire();
    this.evidences.set(candidate.runId, {
      evidence: { baseline: structuredClone(baseline), candidate: structuredClone(candidate), comparison },
      expiresAt: Date.now() + this.limits.runTtlMs
    });
    while (this.evidences.size > this.limits.maxStoredRuns) {
      const oldest = this.evidences.keys().next().value;
      if (oldest === undefined) break;
      this.evidences.delete(oldest);
    }
    return comparison;
  }

  public async getEvidence(verificationRunId: string): Promise<VerificationEvidence> {
    const id = parseContract(IdentifierSchema, verificationRunId);
    this.expire();
    const entry = this.evidences.get(id);
    if (!entry || entry.expiresAt <= Date.now() || entry.evidence.candidate.runId !== id) {
      throw new TestExecutionError("Verification evidence is unknown, expired or inconsistent.");
    }
    return structuredClone(entry.evidence);
  }

  public getRun(runId: string): Result<RunTestsOutput> {
    try { return { ok: true, data: structuredClone(this.storedRun(runId)) }; }
    catch (error: unknown) { return failure(error); }
  }

  /** Aborts the run that is currently executing, if any. */
  public cancel(): void { this.active?.abort(); }

  public clear(): void { this.runs.clear(); this.evidences.clear(); this.storedBytes = 0; }
}

export function createTestRunner(options: TestRunnerOptions): Promise<Result<TestRunner>> {
  return captureResult(() => TestRunner.create(options));
}

export type { TestRunnerOptions, TestRunnerLimits } from "./types.js";
