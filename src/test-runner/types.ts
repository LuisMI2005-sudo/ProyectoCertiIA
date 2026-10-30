import type {
  RunTestsOutput, Runner, RunnerConfiguration, TestCase, VerificationEvidence
} from "../shared/contracts.js";

export interface TestRunnerOptions {
  readonly workspaceRoot: string;
  /** Trusted runner configurations; never supplied by the model. */
  readonly runners: readonly RunnerConfiguration[];
  /** Trusted fingerprint provider, normally GitController.workspaceStateHash. */
  readonly workspaceStateHash: () => Promise<string>;
  /** Trusted environment additions for child processes. */
  readonly environment?: Readonly<Record<string, string>>;
  /** Host-provided OS isolation. Never selected or configured by an MCP caller. */
  readonly sandbox?: TestSandbox;
  readonly maxStoredRuns?: number;
  readonly maxStoredBytes?: number;
  readonly runTtlMs?: number;
}
export interface SandboxRun {
  readonly runner: Runner;
  readonly targets: readonly string[];
  readonly workspaceRoot: string;
  readonly reportPath: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly signal: AbortSignal;
}
export interface TestSandbox {
  /** Immutable image identity, incorporated into verification configuration hashes. */
  readonly fingerprint: string;
  ready(): Promise<boolean>;
  run(options: SandboxRun): Promise<ProcessOutcome>;
}

export interface TestRunnerLimits {
  readonly maxStoredRuns: number;
  readonly maxStoredBytes: number;
  readonly runTtlMs: number;
}

export interface StoredRun {
  readonly result: RunTestsOutput;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly bytes: number;
}

export interface StoredVerification {
  readonly evidence: VerificationEvidence;
  readonly expiresAt: number;
}

export interface ProcessOptions {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly signal?: AbortSignal;
}

export interface ProcessOutcome {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly spawnError: string | null;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
}

export interface ParsedReport {
  readonly cases: readonly TestCase[];
  readonly complete: boolean;
  readonly executionError: boolean;
}

export interface RunnerAdapter {
  readonly runner: Runner;
  /** Machine-readable reporting arguments appended after the trusted base arguments. */
  readonly reportArgs: (reportPath: string) => string[];
  readonly parseReport: (raw: string, workspaceRoot: string) => ParsedReport;
}
