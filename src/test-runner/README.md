# Test Runner

`createTestRunner(options)` returns `Result<TestRunner>`. The `tools` facade
implements `run_tests` and `compare_test_runs` with the exact shared input/output
schemas and `Result<T>` envelopes. Domain methods implement `TestRunner` from
`shared/contracts.ts` and throw typed domain errors. The instance is also the
trusted `VerificationStore` that `git_commit_fix` reads from.

```typescript
import { createTestRunner } from "./test-runner/index.js";
import { createGitController } from "./git-controller/index.js";

const runner = await createTestRunner({
  workspaceRoot,
  runners: projectConfiguration.runners,
  workspaceStateHash: () => gitController.workspaceStateHash()
});
const controller = await createGitController({ workspaceRoot, verificationStore: runner });
```

## Trusted configuration

Runner entries come from `ProjectConfiguration.runners`, never from tool input.
Each entry supplies an executable, its base arguments, a timeout and an output
budget. The model only chooses the runner name, optional workspace-relative
targets and an optional timeout that can shorten, never extend, the configured
budget. Executables are spawned directly, so a JavaScript runner must name its
entry script in `args`; no shell, pipeline or redirection is involved.

Child processes inherit an allowlisted environment (`PATH`, `PATHEXT`, the
Windows system directories, the temp and home directories and a few locale/CPU
variables). Trusted startup `environment` values are merged last. Workspace code
is still ordinary untrusted code: the runner is not an operating-system sandbox.

## Execution and reporting

Runs are serialized per instance so fingerprints and stored results stay
consistent, and each run gets a fresh report file in the system temporary
directory that is removed afterwards. The module appends the machine-readable
report arguments itself: `--json --outputFile=` for Jest and `--json-report
--json-report-file=` for pytest. pytest therefore requires the `pytest-json-report`
plugin to be installed; without it no report is produced and the run ends as an
execution error.

Timeouts and explicit cancellation terminate the child and its descendants: the
whole process group on POSIX and a `taskkill` tree on Windows. stdout and stderr
are captured separately, bounded by `min(maxOutputBytes, 100000)` bytes per
stream, and flagged with `truncated`. A spawn failure reports no exit code.

Report paths are converted to canonical workspace-relative POSIX paths; a suite
recorded outside the workspace, an invalid path or a duplicate test identifier
rejects the report. Jest assertion results and pytest node ids become `cases`
with `passed`, `failed`, `skipped` (Jest pending/disabled, pytest skipped/xfailed)
and `todo` statuses; failed cases carry a bounded failure message. The summary is
derived from the case list, so `complete` runs always satisfy the contract's
count invariants.

`status` follows the evidence: `timeout` and `cancelled` for terminated runs,
`error` when the executable could not start or the report was missing, malformed
or incomplete, `passed` only for a complete run with exit code 0, at least one
passing test and no failure, and `failed` otherwise. `complete: false` always
means the result cannot be used as verification evidence.

## Fingerprints

`workspaceStateHash` is captured from the trusted provider immediately before the
run and never recomputed: the fingerprint describes the state that was tested.
The Git controller independently rechecks the candidate fingerprint and the
checkpoint fingerprint when it accepts evidence, so a runner that modifies
tracked files invalidates its own result.

`configurationHash` is the SHA-256 of the resolved runner configuration
(runner, executable, arguments, timeout and output budget). Two runs are only
comparable when both are complete, use the same runner and share this hash.

## Comparison and evidence

`compareTestRuns` reports `resolvedFailures` (baseline failed, candidate passed),
`newFailures` (candidate failed where the baseline did not), `missingTests`
(baseline cases absent from the candidate) and `comparable`. The verdict is
`regression` when a new failure or a missing test appears, `success` only when the
comparison is comparable, every baseline failure is resolved and nothing else
changed, and `inconclusive` otherwise.

`verify(baselineRunId, candidateRunId)` performs that comparison and registers a
`VerificationEvidence` record keyed by the candidate `runId`, which is the value
`git_commit_fix` passes as `verificationRunId`. Runs and evidence live in memory,
bounded by entries and serialized bytes, with a fixed TTL; `getEvidence`,
`getRun`, `cancel()` and `clear()` expose retrieval, abort and reset. Reads return
defensive copies, and a restart invalidates old identifiers.

## Operational limits

One run executes at a time per instance; `cancel()` aborts only the run that is
currently executing. The configured timeout is a wall-clock deadline enforced by
process termination, not an interpreter-level limit. Tests execute arbitrary
code from the workspace with the allowlisted environment, so an autonomous
workflow should run them in a checkout dedicated to the repair session. Test
executables are expected to be Jest or pytest; a third runner would need a new
report adapter in `reports.ts`.

The test suite drives committed fake Jest and pytest executables from
`fixtures/runner/` and commits exclusively inside temporary fixture repositories.
