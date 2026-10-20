import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { execFile, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { TestRunner, createTestRunner } from '../../dist/test-runner/index.js';
import { adapterFor } from '../../dist/test-runner/reports.js';
import { GitController } from '../../dist/git-controller/index.js';
import { ToolSchemas, resultSchema, RunTestsOutputSchema } from '../../dist/shared/contracts.js';

jest.setTimeout(60000);
const execute = promisify(execFile);
const sha = (text) => createHash('sha256').update(text).digest('hex');
const unwrap = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
const fakeJest = path.join(process.cwd(), 'fixtures', 'runner', 'fake-jest.mjs');
const fakePytest = path.join(process.cwd(), 'fixtures', 'runner', 'fake-pytest.mjs');
const realJest = fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url));
const pytestProbe = spawnSync('pytest', ['--version'], {
  timeout: 10000, encoding: 'utf8', windowsHide: true
});
const pytestAvailable = pytestProbe.error?.code !== 'ENOENT';
const requirePytest = process.env.DEVGUARDIAN_REQUIRE_PYTEST === '1';
const runners = [
  { runner: 'jest', executable: process.execPath, args: [fakeJest], timeoutMs: 10000, maxOutputBytes: 200000 },
  { runner: 'pytest', executable: process.execPath, args: [fakePytest], timeoutMs: 10000, maxOutputBytes: 200000 }
];
const sampleCase = (title, suite = 'tests/sample.test.mjs') => `${suite}::${title}`;
let root, runner, environment, stateHash;
beforeEach(async () => {
  root = await mkdtemp(path.join(process.cwd(), '.phase4-test-'));
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'tests', 'sample.test.mjs'), 'export {};\n');
  stateHash = 'a'.repeat(64);
  environment = { FAKE_MODE: 'pass' };
  runner = await TestRunner.create({
    workspaceRoot: root, runners, environment,
    workspaceStateHash: async () => stateHash
  });
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
const run = (mode, input = { runner: 'jest' }) => { environment.FAKE_MODE = mode; return runner.runTests(input); };

describe('runner execution and reporting', () => {
  test('runs a configured runner and validates a complete passing result', async () => {
    const result = await run('pass');
    expect(RunTestsOutputSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ runner: 'jest', status: 'passed', exitCode: 0, complete: true, truncated: false });
    expect(result.summary).toEqual({ total: 2, passed: 2, failed: 0, skipped: 0, todo: 0 });
    expect(result.cases.map((entry) => entry.id)).toEqual([
      sampleCase('adds numbers'), sampleCase('keeps existing behavior')
    ]);
    expect(result.cases.every((entry) => entry.path === 'tests/sample.test.mjs')).toBe(true);
    expect(result.workspaceStateHash).toBe(stateHash);
    expect(result.configurationHash).toMatch(/^[a-f0-9]{64}$/u);
  });
  test('reports failing tests with failure messages', async () => {
    const result = await run('fail');
    expect(result).toMatchObject({ status: 'failed', exitCode: 1, complete: true });
    expect(result.summary).toMatchObject({ total: 2, passed: 1, failed: 1 });
    const failed = result.cases.find((entry) => entry.status === 'failed');
    expect(failed).toMatchObject({ id: sampleCase('adds numbers') });
    expect(failed.failureMessage).toContain('Expected sum');
  });
  test('maps skipped and todo statuses without declaring a pass', async () => {
    const result = await run('mixed');
    expect(result).toMatchObject({ status: 'failed', complete: true });
    expect(result.summary).toEqual({ total: 2, passed: 0, failed: 0, skipped: 1, todo: 1 });
    expect(result.cases.map((entry) => entry.status).sort()).toEqual(['skipped', 'todo']);
  });
  test('reports the output of a child that exits without a report as an error', async () => {
    expect(await run('noreport')).toMatchObject({ status: 'error', complete: false, exitCode: 0 });
    expect(await run('crash')).toMatchObject({ status: 'error', complete: false });
  });
  test('marks runner-side execution failures as errors', async () => {
    expect(await run('execerror')).toMatchObject({ status: 'error', complete: false });
  });
  test('times out long-running runners', async () => {
    const result = await run('timeout');
    expect(result).toMatchObject({ status: 'timeout', complete: false });
    expect(result.durationMs).toBeGreaterThanOrEqual(500);
  }, 15000);
  test('cancels an active run through the control surface', async () => {
    environment.FAKE_MODE = 'timeout';
    const pending = runner.runTests({ runner: 'jest' });
    await new Promise((resolve) => setTimeout(resolve, 400));
    runner.cancel();
    expect(await pending).toMatchObject({ status: 'cancelled', complete: false });
  }, 15000);
  test('bounds captured output and flags truncation', async () => {
    const result = await run('verbose');
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(100000);
    expect(result).toMatchObject({ status: 'passed' });
  });
  test('produces a stable configuration fingerprint', async () => {
    const first = await run('pass');
    const second = await run('pass');
    expect(first.configurationHash).toBe(second.configurationHash);
    const other = await TestRunner.create({ workspaceRoot: root, environment,
      workspaceStateHash: async () => stateHash,
      runners: [{ runner: 'jest', executable: process.execPath, args: [fakeJest], timeoutMs: 9999, maxOutputBytes: 200000 }] });
    expect((await other.runTests({ runner: 'jest' })).configurationHash).not.toBe(first.configurationHash);
  });
});

describe('runner safety and input validation', () => {
  test('reports unconfigured runners and spawn failures as typed errors', async () => {
    const jestOnly = await TestRunner.create({ workspaceRoot: root, environment,
      workspaceStateHash: async () => stateHash, runners: [runners[0]] });
    expect(await jestOnly.tools.run_tests({ runner: 'pytest' }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const broken = await TestRunner.create({ workspaceRoot: root, environment,
      workspaceStateHash: async () => stateHash,
      runners: [{ runner: 'jest', executable: 'devguardian-missing-executable', args: [], timeoutMs: 5000, maxOutputBytes: 10000 }] });
    const result = await broken.runTests({ runner: 'jest' });
    expect(result).toMatchObject({ status: 'error', complete: false, exitCode: null });
    expect(result.stderr.length).toBeGreaterThan(0);
  });
  test('rejects unexpected input, unsafe targets and missing targets', async () => {
    expect(await runner.tools.run_tests({ runner: 'jest', command: 'rm -rf' }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await runner.tools.run_tests({ runner: 'jest', targets: ['../escape'] }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await runner.tools.run_tests({ runner: 'jest', targets: ['missing-dir'] }))
      .toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
  });
  test('accepts existing workspace targets', async () => {
    const result = await runner.runTests({ runner: 'jest', targets: ['tests'] });
    expect(result.status).toBe('passed');
  });
  test('rejects invalid construction options', async () => {
    expect(await createTestRunner({ workspaceRoot: root, runners: [], workspaceStateHash: async () => stateHash }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const duplicated = await createTestRunner({ workspaceRoot: root, runners: [runners[0], runners[0]], workspaceStateHash: async () => stateHash });
    expect(duplicated).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await createTestRunner({ workspaceRoot: root, runners: [runners[0]], maxStoredRuns: 0, workspaceStateHash: async () => stateHash }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
  test('wraps handler failures as a Result envelope', async () => {
    const accepted = await runner.tools.run_tests({ runner: 'jest' });
    expect(resultSchema(ToolSchemas.run_tests.output).safeParse(accepted).success).toBe(true);
    expect(await runner.tools.compare_test_runs({ baselineRunId: randomUUID(), candidateRunId: randomUUID() }))
      .toMatchObject({ ok: false, error: { code: 'TEST_EXECUTION_ERROR' } });
  });
});

describe('comparison and verification evidence', () => {
  test.each(['skipped', 'todo', 'pending'])('rejects resolved failures when a previously passing test becomes %s', async (status) => {
    const baseline = await run('fail');
    const candidate = await run(`resolved-${status}`);
    const comparison = await runner.verify(baseline.runId, candidate.runId);
    expect(candidate.complete).toBe(true);
    expect(candidate.cases.find((entry) => entry.id === sampleCase('keeps existing behavior')).status)
      .toBe(status === 'todo' ? 'todo' : 'skipped');
    expect(comparison).toEqual({ resolvedFailures: [sampleCase('adds numbers')],
      newFailures: [sampleCase('keeps existing behavior')], missingTests: [], comparable: true, verdict: 'regression' });
    expect((await runner.getEvidence(candidate.runId)).comparison.verdict).toBe('regression');
  });
  test('detects resolved failures as a successful comparison', async () => {
    const baseline = await run('fail');
    const candidate = await run('pass');
    const comparison = await runner.compareTestRuns({ baselineRunId: baseline.runId, candidateRunId: candidate.runId });
    expect(comparison).toEqual({
      resolvedFailures: [sampleCase('adds numbers')], newFailures: [], missingTests: [],
      comparable: true, verdict: 'success'
    });
  });
  test('detects new failures and missing tests as regressions', async () => {
    const passing = await run('pass');
    const failing = await run('fail');
    expect(await runner.compareTestRuns({ baselineRunId: passing.runId, candidateRunId: failing.runId }))
      .toMatchObject({ newFailures: [sampleCase('adds numbers')], comparable: true, verdict: 'regression' });
    const subset = await run('subset');
    expect(await runner.compareTestRuns({ baselineRunId: passing.runId, candidateRunId: subset.runId }))
      .toMatchObject({ missingTests: [sampleCase('adds numbers')], comparable: true, verdict: 'regression' });
  });
  test('marks mismatched configurations and incomplete runs as inconclusive', async () => {
    const baseline = await run('fail');
    const foreign = await run('fail', { runner: 'pytest' });
    expect(foreign.configurationHash).not.toBe(baseline.configurationHash);
    expect(await runner.compareTestRuns({ baselineRunId: baseline.runId, candidateRunId: foreign.runId }))
      .toMatchObject({ comparable: false, verdict: 'inconclusive' });
    const timedOut = await run('timeout');
    expect(await runner.compareTestRuns({ baselineRunId: baseline.runId, candidateRunId: timedOut.runId }))
      .toMatchObject({ comparable: false, verdict: 'inconclusive' });
  }, 15000);
  test('requires distinct runs and known identifiers', async () => {
    const baseline = await run('fail');
    expect(await runner.tools.compare_test_runs({ baselineRunId: baseline.runId, candidateRunId: baseline.runId }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const candidate = await run('pass');
    expect(await runner.tools.compare_test_runs({ baselineRunId: baseline.runId, candidateRunId: 'not-a-uuid' }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await runner.tools.compare_test_runs({ baselineRunId: randomUUID(), candidateRunId: candidate.runId }))
      .toMatchObject({ ok: false, error: { code: 'TEST_EXECUTION_ERROR' } });
  });
  test('registers evidence that the Git controller verification store can read', async () => {
    const baseline = await run('fail');
    const candidate = await run('pass');
    const comparison = await runner.verify(baseline.runId, candidate.runId);
    expect(comparison.verdict).toBe('success');
    const evidence = await runner.getEvidence(candidate.runId);
    expect(evidence.baseline.runId).toBe(baseline.runId);
    expect(evidence.candidate.runId).toBe(candidate.runId);
    expect(evidence.comparison).toEqual(comparison);
    await expect(runner.getEvidence(randomUUID())).rejects.toMatchObject({ code: 'TEST_EXECUTION_ERROR' });
  });
  test('returns defensive copies of stored runs', async () => {
    const result = await run('pass');
    const copy = runner.getRun(result.runId);
    expect(copy).toMatchObject({ ok: true });
    copy.data.status = 'failed';
    expect(runner.getRun(result.runId).data.status).toBe('passed');
    expect(runner.getRun(randomUUID())).toMatchObject({ ok: false, error: { code: 'TEST_EXECUTION_ERROR' } });
  });
});

describe('pytest reporting', () => {
  test('parses a passing json report with durations', async () => {
    const result = await run('pass', { runner: 'pytest' });
    expect(RunTestsOutputSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ runner: 'pytest', status: 'passed', complete: true });
    expect(result.cases.map((entry) => entry.id)).toEqual([
      'tests/test_sample.py::test_adds', 'tests/test_sample.py::test_existing'
    ]);
    expect(result.cases.every((entry) => entry.path === 'tests/test_sample.py')).toBe(true);
    expect(result.cases.every((entry) => entry.durationMs >= 1)).toBe(true);
  });
  test('parses failures, skips and collection errors', async () => {
    const failed = await run('fail', { runner: 'pytest' });
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed.cases.find((entry) => entry.status === 'failed').failureMessage).toContain('AssertionError');
    const mixed = await run('mixed', { runner: 'pytest' });
    expect(mixed.cases.map((entry) => entry.status).sort()).toEqual(['skipped', 'skipped']);
    expect(await run('collecterror', { runner: 'pytest' })).toMatchObject({ status: 'error', complete: false });
  });
});

describe('report completeness invariants', () => {
  const jestReport = () => ({ numTotalTests: 1, testResults: [{ name: 'tests/sample.test.mjs', status: 'passed',
    assertionResults: [{ fullName: 'adds numbers', status: 'passed', duration: 1 }] }] });
  const pytestReport = () => ({ summary: { total: 1, collected: 1 }, collectors: [],
    tests: [{ nodeid: 'tests/test_sample.py::test_adds', outcome: 'passed', call: { duration: 0.001 } }] });
  const parse = (engine, report) => adapterFor(engine).parseReport(JSON.stringify(report), root);

  test.each([
    ['jest', 'partial assertions', () => ({ ...jestReport(), numTotalTests: 2 })],
    ['jest', 'missing count', () => ({ ...jestReport(), numTotalTests: undefined })],
    ['jest', 'negative count', () => ({ ...jestReport(), numTotalTests: -1 })],
    ['jest', 'fractional count', () => ({ ...jestReport(), numTotalTests: 1.5 })],
    ['jest', 'failed suite without cases', () => { const value = jestReport(); value.testResults.push({ name: 'tests/broken.test.mjs', status: 'failed', assertionResults: [] }); return value; }],
    ['jest', 'suite execution error', () => { const value = jestReport(); value.testResults[0].testExecError = { message: 'teardown failed' }; return value; }],
    ['pytest', 'partial tests', () => ({ ...pytestReport(), summary: { total: 2, collected: 2 } })],
    ['pytest', 'partial collection without total', () => ({ ...pytestReport(), summary: { collected: 2 } })],
    ['pytest', 'inconsistent collection', () => ({ ...pytestReport(), summary: { total: 1, collected: 2 } })],
    ['pytest', 'missing counts', () => ({ ...pytestReport(), summary: {} })],
    ['pytest', 'negative count', () => ({ ...pytestReport(), summary: { total: -1, collected: 1 } })],
    ['pytest', 'real collection error shape', () => ({ ...pytestReport(), collectors: [{ nodeid: 'tests/broken.py', outcome: 'failed', result: [] }] })]
  ])('%s marks %s as incomplete', (engine, _description, report) => {
    expect(parse(engine, report()).complete).toBe(false);
  });

  test('accepts complete pytest reports with explicitly deselected tests', () => {
    const report = pytestReport(); report.summary = { total: 1, collected: 3, deselected: 2 };
    expect(parse('pytest', report)).toMatchObject({ complete: true, executionError: false });
    expect(parse('pytest', { ...report, summary: { collected: 3, deselected: 2 } }).complete).toBe(true);
  });

  test.each(['jest', 'pytest'])('%s partial reports cannot become successful verification', async (engine) => {
    const baseline = await run('fail', { runner: engine });
    const candidate = await run('partial', { runner: engine });
    expect(candidate.complete).toBe(false);
    expect(candidate.status).not.toBe('passed');
    expect(await runner.verify(baseline.runId, candidate.runId)).toMatchObject({ comparable: false, verdict: 'inconclusive' });
  });
});

describe('real runner smoke tests', () => {
  const expectPassingReport = (result, engine, file, id) => {
    expect(RunTestsOutputSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ runner: engine, status: 'passed', complete: true, exitCode: 0 });
    expect(result.summary).toEqual({ total: 1, passed: 1, failed: 0, skipped: 0, todo: 0 });
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]).toMatchObject({ id, path: file, status: 'passed' });
    expect(result.cases[0].durationMs).toBeGreaterThanOrEqual(0);
  };

  test('executes real Jest and parses its complete JSON report', async () => {
    const config = path.join(root, 'jest.config.cjs');
    await writeFile(config, "module.exports = { testEnvironment: 'node', testMatch: ['**/*.test.cjs'], transform: {} };\n");
    await writeFile(path.join(root, 'tests', 'smoke.test.cjs'),
      "test('adds real numbers', () => { expect(2 + 3).toBe(5); });\n");
    const realRunner = await TestRunner.create({
      workspaceRoot: root,
      workspaceStateHash: async () => stateHash,
      runners: [{ runner: 'jest', executable: process.execPath,
        args: [realJest, '--config', config, '--runInBand'], timeoutMs: 30000, maxOutputBytes: 200000 }]
    });
    const result = await realRunner.runTests({ runner: 'jest', targets: ['tests/smoke.test.cjs'] });
    expectPassingReport(result, 'jest', 'tests/smoke.test.cjs', 'tests/smoke.test.cjs::adds real numbers');
  });

  // Local checkouts may omit Python. CI requires it, so a missing binary must fail there.
  const pytestTest = pytestAvailable || requirePytest ? test : test.skip;
  pytestTest('executes real pytest and parses its complete JSON report', async () => {
    await writeFile(path.join(root, 'pytest.ini'), '[pytest]\n');
    await writeFile(path.join(root, 'tests', 'test_smoke.py'), 'def test_adds_real_numbers():\n    assert 2 + 3 == 5\n');
    const realRunner = await TestRunner.create({
      workspaceRoot: root,
      workspaceStateHash: async () => stateHash,
      environment: { PYTEST_DISABLE_PLUGIN_AUTOLOAD: '1', PYTHONDONTWRITEBYTECODE: '1' },
      runners: [{ runner: 'pytest', executable: 'pytest',
        args: ['-p', 'pytest_jsonreport.plugin', '-p', 'no:cacheprovider', '-q'],
        timeoutMs: 30000, maxOutputBytes: 200000 }]
    });
    const result = await realRunner.runTests({ runner: 'pytest', targets: ['tests/test_smoke.py'] });
    expectPassingReport(result, 'pytest', 'tests/test_smoke.py', 'tests/test_smoke.py::test_adds_real_numbers');
  });
});

describe('git controller integration', () => {
  const original = 'export const add = (a, b) => a - b;\n';
  const fixed = 'export const add = (a, b) => a + b;\n';
  const patch = [
    'diff --git a/calc.ts b/calc.ts', '--- a/calc.ts', '+++ b/calc.ts',
    '@@ -1 +1 @@', `-${original.trimEnd()}`, `+${fixed.trimEnd()}`, ''
  ].join('\n');
  let repoRoot, controller, repoRunner, base;
  const git = async (...args) => (await execute('git', args, {
    cwd: repoRoot, timeout: 15000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  })).stdout;
  beforeEach(async () => {
    repoRoot = await mkdtemp(path.join(process.cwd(), '.phase4-git-'));
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'DevGuardian Tests');
    await git('config', 'user.email', 'tests@devguardian.invalid');
    await git('config', 'core.autocrlf', 'false');
    await git('config', 'commit.gpgsign', 'false');
    await writeFile(path.join(repoRoot, 'calc.ts'), original);
    await git('add', '.');
    await git('commit', '-m', 'Fixture baseline');
    base = (await git('rev-parse', 'HEAD')).trim();
    repoRunner = await TestRunner.create({ workspaceRoot: repoRoot, runners: [runners[0]],
      environment, workspaceStateHash: () => controller.workspaceStateHash() });
    controller = await GitController.create({ workspaceRoot: repoRoot, verificationStore: repoRunner });
  });
  afterEach(async () => { if (repoRoot) await rm(repoRoot, { recursive: true, force: true }); });

  test('drives the analyzer-to-commit loop with real evidence', async () => {
    const session = unwrap(await controller.tools.git_create_fix_branch({ slug: 'runner', expectedHead: base }));
    const attempt = unwrap(await controller.tools.git_begin_attempt({ sessionId: session.sessionId }));
    environment.FAKE_MODE = 'fail';
    const baseline = await repoRunner.runTests({ runner: 'jest' });
    expect(baseline.status).toBe('failed');
    const ids = { sessionId: session.sessionId, attemptId: attempt.attemptId };
    unwrap(await controller.tools.git_apply_patch({ ...ids, unifiedDiff: patch,
      expectedFileHashes: { 'calc.ts': sha(original) } }));
    environment.FAKE_MODE = 'pass';
    const candidate = await repoRunner.runTests({ runner: 'jest' });
    expect(candidate.status).toBe('passed');
    const comparison = await repoRunner.verify(baseline.runId, candidate.runId);
    expect(comparison.verdict).toBe('success');
    const diff = unwrap(await controller.tools.git_diff(ids));
    const committed = unwrap(await controller.tools.git_commit_fix({ ...ids, message: 'Fix addition',
      expectedDiffHash: diff.diffHash, verificationRunId: candidate.runId }));
    expect(committed).toMatchObject({ branch: 'fix/runner', files: ['calc.ts'] });
    expect(await git('show', 'HEAD:calc.ts')).toBe(fixed);
    expect(unwrap(await controller.tools.git_status({})).clean).toBe(true);
  });
});
