import path from "node:path";
import { Limits } from "../shared/contracts.js";
import type { Runner, TestCase } from "../shared/contracts.js";
import { TestExecutionError } from "../shared/errors.js";
import { validateWorkspaceRelativePath } from "../shared/path-security.js";
import type { ParsedReport, RunnerAdapter } from "./types.js";

const MAX_ID = 4096;
const MAX_MESSAGE = Limits.maxFileContextCharacters;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchesCount(value: unknown, expected: number): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value === expected;
}

/** Converts a report path into a canonical workspace-relative POSIX path. */
function relativePath(workspaceRoot: string, candidate: string): string {
  const relative = path.isAbsolute(candidate) ? path.relative(workspaceRoot, candidate) : candidate;
  if (relative.length === 0 || relative === ".." || relative.startsWith(`..${path.sep}`) ||
      relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new TestExecutionError("A test report referenced a path outside the workspace.");
  }
  try { return validateWorkspaceRelativePath(relative.split(/[\\/]/u).join("/")); }
  catch { throw new TestExecutionError("A test report referenced an invalid workspace path."); }
}

function bounded(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit) : value;
}

function mapJestStatus(value: unknown): TestCase["status"] {
  if (value === "passed") return "passed";
  if (value === "failed") return "failed";
  if (value === "todo") return "todo";
  return "skipped";
}

function parseJest(raw: string, workspaceRoot: string): ParsedReport {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new TestExecutionError("The Jest report is not valid JSON."); }
  const report = asRecord(parsed);
  if (!report) throw new TestExecutionError("The Jest report has an unexpected shape.");
  const suites = Array.isArray(report["testResults"]) ? report["testResults"] : null;
  if (!suites) throw new TestExecutionError("The Jest report is missing its test results.");
  let executionError = report["testExecError"] !== undefined && report["testExecError"] !== null;
  let validStructure = true;
  const cases: TestCase[] = [];
  const identifiers = new Set<string>();
  for (const suite of suites) {
    const record = asRecord(suite);
    if (!record) { validStructure = false; continue; }
    const file = asString(record["name"]);
    if (file === null) throw new TestExecutionError("A Jest suite is missing its file name.");
    const suitePath = relativePath(workspaceRoot, file);
    const assertions = Array.isArray(record["assertionResults"]) ? record["assertionResults"] : [];
    if (!Array.isArray(record["assertionResults"])) validStructure = false;
    if (record["testExecError"] !== undefined && record["testExecError"] !== null) executionError = true;
    if (assertions.length === 0 && record["status"] === "failed") executionError = true;
    for (const assertion of assertions) {
      const test = asRecord(assertion);
      if (!test) { validStructure = false; continue; }
      const name = asString(test["fullName"]) ?? asString(test["title"]);
      if (name === null) throw new TestExecutionError("A Jest test is missing its name.");
      const id = bounded(`${suitePath}::${name}`, MAX_ID);
      if (identifiers.has(id)) throw new TestExecutionError("The Jest report contains duplicate test identifiers.");
      identifiers.add(id);
      const status = mapJestStatus(test["status"]);
      const messages = Array.isArray(test["failureMessages"])
        ? test["failureMessages"].filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];
      cases.push({
        id, path: suitePath, name: bounded(name, MAX_ID), status,
        durationMs: asNumber(test["duration"]),
        failureMessage: status === "failed" ? bounded(messages.join("\n") || "Test failed.", MAX_MESSAGE) : null
      });
    }
  }
  return { cases, complete: !executionError && validStructure && matchesCount(report["numTotalTests"], cases.length), executionError };
}

function mapPytestStatus(value: unknown): TestCase["status"] {
  if (value === "passed" || value === "xpassed") return "passed";
  if (value === "failed" || value === "error") return "failed";
  return "skipped";
}

function phaseSeconds(phase: unknown): number {
  const record = asRecord(phase);
  if (!record) return 0;
  const duration = asNumber(record["duration"]);
  return duration !== null && duration > 0 ? duration : 0;
}

function pytestFailure(test: Record<string, unknown>): string {
  const call = asRecord(test["call"]);
  const representation = call ? asString(call["longrepr"]) : null;
  if (representation) return bounded(representation, MAX_MESSAGE);
  const crash = call ? asRecord(call["crash"]) : null;
  const message = crash ? asString(crash["message"]) : null;
  return bounded(message ?? "Test failed.", MAX_MESSAGE);
}

function parsePytest(raw: string, workspaceRoot: string): ParsedReport {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new TestExecutionError("The pytest report is not valid JSON."); }
  const report = asRecord(parsed);
  if (!report) throw new TestExecutionError("The pytest report has an unexpected shape.");
  const tests = Array.isArray(report["tests"]) ? report["tests"] : null;
  if (!tests) throw new TestExecutionError("The pytest report is missing its test results.");
  const collectors = Array.isArray(report["collectors"]) ? report["collectors"] : [];
  const executionError = collectors.some((collector) => {
    const entry = asRecord(collector);
    return entry?.["result"] === "error" || entry?.["outcome"] === "failed" || entry?.["outcome"] === "error";
  });
  let validStructure = true;
  const cases: TestCase[] = [];
  const identifiers = new Set<string>();
  for (const entry of tests) {
    const test = asRecord(entry);
    if (!test) { validStructure = false; continue; }
    const nodeId = asString(test["nodeid"]);
    if (nodeId === null) throw new TestExecutionError("A pytest test is missing its node id.");
    const separator = nodeId.indexOf("::");
    const suitePath = relativePath(workspaceRoot, separator >= 0 ? nodeId.slice(0, separator) : nodeId);
    const id = bounded(nodeId, MAX_ID);
    if (identifiers.has(id)) throw new TestExecutionError("The pytest report contains duplicate test identifiers.");
    identifiers.add(id);
    const status = mapPytestStatus(test["outcome"]);
    const seconds = phaseSeconds(test["setup"]) + phaseSeconds(test["call"]) + phaseSeconds(test["teardown"]);
    cases.push({
      id, path: suitePath, name: bounded(nodeId, MAX_ID), status,
      durationMs: Math.round(seconds * 1000),
      failureMessage: status === "failed" ? pytestFailure(test) : null
    });
  }
  const summary = asRecord(report["summary"]);
  const total = summary?.["total"];
  const collected = summary?.["collected"];
  const deselected = summary?.["deselected"] ?? 0;
  // pytest's collected count includes deselected tests; total represents selected tests.
  const collectionMatches = collected === undefined || (typeof collected === "number" && Number.isSafeInteger(collected) &&
    typeof deselected === "number" && Number.isSafeInteger(deselected) && deselected >= 0 && collected >= deselected &&
    collected - deselected === cases.length);
  const countsMatch = (total !== undefined || collected !== undefined) &&
    (total === undefined || matchesCount(total, cases.length)) && collectionMatches;
  return { cases, complete: !executionError && validStructure && countsMatch, executionError };
}

const JEST_ADAPTER: RunnerAdapter = {
  runner: "jest",
  reportArgs: (reportPath) => ["--json", `--outputFile=${reportPath}`],
  parseReport: parseJest
};

const PYTEST_ADAPTER: RunnerAdapter = {
  runner: "pytest",
  reportArgs: (reportPath) => ["--json-report", `--json-report-file=${reportPath}`],
  parseReport: parsePytest
};

export function adapterFor(runner: Runner): RunnerAdapter {
  return runner === "jest" ? JEST_ADAPTER : PYTEST_ADAPTER;
}
