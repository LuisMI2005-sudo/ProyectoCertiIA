import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { AutonomousRepairAgent } from '../../dist/agent/index.js';

const uuid = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const sessionId = uuid('1');
const attemptId = uuid('2');
const analysisId = uuid('3');
const baselineId = uuid('4');
const candidateId = uuid('5');
const hash = 'a'.repeat(64);

function testRun({ runId, status, failed, workspaceStateHash }) {
  const passed = failed ? 0 : 1;
  return {
    runId, runner: 'jest', status, exitCode: failed ? 1 : 0, durationMs: 1,
    summary: { total: 1, passed, failed: Number(failed), skipped: 0, todo: 0 },
    cases: [{ id: 'fails-on-baseline', path: 'calc.test.mjs', name: 'adds numbers', status: failed ? 'failed' : 'passed',
      durationMs: 1, failureMessage: failed ? 'Expected 2, received 0' : null }],
    stdout: '', stderr: '', truncated: false, complete: true,
    startedAt: '2026-10-19T10:00:00.000Z', finishedAt: '2026-10-19T10:00:01.000Z',
    workspaceStateHash, configurationHash: hash
  };
}

const analysis = {
  analysisId, diagnostics: [{ path: 'calc.ts', source: 'typescript', code: '2322', severity: 'error', message: 'Mismatch', range: null }],
  affectedSymbols: [], dependencies: [], analyzedFiles: ['calc.ts'], truncated: false
};
const source = { path: 'calc.ts', content: 'export const add = (a: number, b: number) => a - b;',
  startLine: 1, endLine: 1, fileHash: hash, truncated: false };
const baseline = testRun({ runId: baselineId, status: 'failed', failed: true, workspaceStateHash: hash });
const candidate = testRun({ runId: candidateId, status: 'passed', failed: false, workspaceStateHash: 'b'.repeat(64) });
const successComparison = { resolvedFailures: ['fails-on-baseline'], newFailures: [], missingTests: [], comparable: true, verdict: 'success' };
const plan = { summary: 'Fix addition implementation', unifiedDiff: 'diff --git a/calc.ts b/calc.ts', expectedFileHashes: { 'calc.ts': hash } };

function setup({ passCandidate = true, baselineStatus = 'failed', planner = { propose: jest.fn(async () => plan) } } = {}) {
  const calls = [];
  const client = {
    async callTool(name, input) {
      calls.push({ name, input });
      const data = {
        git_status: { branch: 'main', headCommit: 'c'.repeat(40), clean: true, staged: [], modified: [], untracked: [], conflicted: [] },
        git_create_fix_branch: { sessionId, branch: 'fix/repair', baseBranch: 'main', baseCommit: 'c'.repeat(40) },
        run_tests: input.runner === 'jest' && calls.filter((call) => call.name === 'run_tests').length === 1
          ? { ...baseline, status: baselineStatus } : (passCandidate ? candidate : { ...candidate, status: 'failed', exitCode: 1,
            summary: { total: 1, passed: 0, failed: 1, skipped: 0, todo: 0 },
            cases: [{ ...candidate.cases[0], status: 'failed', failureMessage: 'Still failing' }] }),
        analyze_code: analysis,
        git_begin_attempt: { attemptId, checkpointCommit: 'c'.repeat(40) },
        read_file_context: source,
        git_apply_patch: { applied: true, changedFiles: ['calc.ts'], diffHash: hash },
        compare_test_runs: successComparison,
        git_diff: { diff: 'patch', diffHash: hash, changedFiles: ['calc.ts'], insertions: 1, deletions: 1 },
        git_commit_fix: { commit: 'd'.repeat(40), branch: 'fix/repair', files: ['calc.ts'] },
        git_rollback_attempt: { restoredCommit: 'c'.repeat(40), revertedFiles: ['calc.ts'], branch: 'fix/repair', clean: true }
      }[name];
      return { ok: true, data };
    }
  };
  const agent = new AutonomousRepairAgent(client, planner, { maxAttempts: 2 });
  return { agent, calls, planner };
}

const input = { slug: 'repair', analysis: { paths: ['calc.ts'], checks: ['semantic'] }, runner: 'jest' };

describe('AutonomousRepairAgent', () => {
  test('gates changes on a failing baseline and commits only a verified repair', async () => {
    const { agent, calls, planner } = setup();
    const result = await agent.run(input);
    expect(result).toMatchObject({ status: 'fixed', sessionId, attempts: 1, commit: 'd'.repeat(40), lastVerification: successComparison });
    expect(planner.propose).toHaveBeenCalledWith(expect.objectContaining({ fileContexts: [source], attemptNumber: 1 }));
    expect(calls.map(({ name }) => name)).toEqual([
      'git_status', 'run_tests', 'git_status', 'analyze_code', 'git_create_fix_branch', 'git_begin_attempt', 'read_file_context',
      'git_apply_patch', 'run_tests', 'compare_test_runs', 'git_diff', 'git_commit_fix'
    ]);
    expect(calls.some(({ name }) => name === 'git_rollback_attempt')).toBe(false);
  });

  test('does not ask the planner or mutate when the baseline is already passing', async () => {
    const { agent, calls, planner } = setup({ baselineStatus: 'passed' });
    expect(await agent.run(input)).toMatchObject({ status: 'not_needed', sessionId: null, attempts: 0, commit: null });
    expect(planner.propose).not.toHaveBeenCalled();
    expect(calls.map(({ name }) => name)).toEqual(['git_status', 'run_tests']);
  });

  test('rolls back each unverified attempt and stops after the configured retry budget', async () => {
    const { agent, calls } = setup({ passCandidate: false });
    expect(await agent.run(input)).toMatchObject({ status: 'exhausted', attempts: 2, commit: null });
    expect(calls.filter(({ name }) => name === 'git_rollback_attempt')).toHaveLength(2);
    expect(calls.filter(({ name }) => name === 'git_apply_patch')).toHaveLength(2);
    expect(calls.some(({ name }) => name === 'git_commit_fix')).toBe(false);
  });

  test('rejects invalid plans before applying a patch and rolls back the checkpoint', async () => {
    const { agent, calls } = setup({ planner: { propose: async () => ({ ...plan, ignored: true }) } });
    await expect(agent.run(input)).rejects.toThrow();
    expect(calls.some(({ name }) => name === 'git_apply_patch')).toBe(false);
    expect(calls.filter(({ name }) => name === 'git_rollback_attempt')).toHaveLength(1);
  });

  test('checks the worktree before creating a session', async () => {
    const { agent, calls } = setup();
    const invalidClient = { async callTool() { return { ok: true, data: {
      branch: 'main', headCommit: 'c'.repeat(40), clean: false, staged: [], modified: ['work.ts'], untracked: [], conflicted: []
    } }; } };
    await expect(new AutonomousRepairAgent(invalidClient, { propose: async () => plan }).run(input)).rejects.toThrow('clean repository');
    expect(calls).toHaveLength(0);
  });

  test('honors cancellation while planning and rolls back the open attempt', async () => {
    const controller = new AbortController();
    const { agent, calls } = setup({ planner: { async propose() { controller.abort(); return plan; } } });
    expect(await agent.run(input, controller.signal)).toMatchObject({ status: 'cancelled', sessionId, commit: null });
    expect(calls.some(({ name }) => name === 'git_apply_patch')).toBe(false);
    expect(calls.filter(({ name }) => name === 'git_rollback_attempt')).toHaveLength(1);
  });

  test('validates the retry budget at construction', () => {
    expect(() => new AutonomousRepairAgent({}, { propose: async () => plan }, { maxAttempts: 11 })).toThrow('maxAttempts');
  });
});
