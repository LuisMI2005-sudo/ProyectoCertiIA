import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHookManager, HookManager, HookExecutionCoordinator } from '../../dist/hooks/index.js';
import { GitController } from '../../dist/git-controller/index.js';

jest.setTimeout(60000);
const execute = promisify(execFile);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const original = 'export const value = 1;\n';
const patch = (file, text = 'export const value = 2;') => [
  `diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`,
  '@@ -1 +1 @@', `-${original.trim()}`, `+${text}`, ''
].join('\n');
let root, hooks, controller, ids, head, evidence;
const git = async (...args) => (await execute('git', args, { cwd: root, windowsHide: true })).stdout.trim();
const unwrap = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
beforeEach(async () => {
  root = await mkdtemp(path.join(process.cwd(), '.hooks-test-'));
  await mkdir(path.join(root, 'src'));
  await mkdir(path.join(root, '.github/workflows'), { recursive: true });
  for (const file of ['src/value.ts', '.env', '.github/workflows/ci.yml']) await writeFile(path.join(root, file), original);
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'Hook Tests');
  await git('config', 'user.email', 'hooks@devguardian.invalid');
  await git('config', 'core.autocrlf', 'false');
  await git('config', 'commit.gpgsign', 'false');
  await git('add', '.'); await git('commit', '-m', 'baseline');
  head = await git('rev-parse', 'HEAD');
  hooks = createHookManager();
  evidence = undefined;
  controller = await GitController.create({ workspaceRoot: root, hookManager: hooks,
    verificationStore: { async getEvidence() { if (!evidence) throw new Error('Missing'); return evidence; } } });
  const session = await controller.createFixBranch({ slug: 'hooks', expectedHead: head });
  const attempt = await controller.beginAttempt({ sessionId: session.sessionId });
  ids = { sessionId: session.sessionId, attemptId: attempt.attemptId };
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
const apply = (file, text) => controller.tools.git_apply_patch({ ...ids, unifiedDiff: patch(file, text), expectedFileHashes: { [file]: hash(original) } });
function makeEvidence(before, after) {
  const now = new Date().toISOString();
  const run = (failed, state) => ({ runId: randomUUID(), runner: 'jest', status: failed ? 'failed' : 'passed',
    exitCode: failed ? 1 : 0, durationMs: 1, summary: { total: 1, passed: failed ? 0 : 1, failed: failed ? 1 : 0, skipped: 0, todo: 0 },
    cases: [{ id: 'value', path: 'tests/value.test.mjs', name: 'value', status: failed ? 'failed' : 'passed', durationMs: 1, failureMessage: null }],
    stdout: '', stderr: '', truncated: false, complete: true, startedAt: now, finishedAt: now,
    workspaceStateHash: state, configurationHash: 'a'.repeat(64) });
  return { baseline: run(true, before), candidate: run(false, after),
    comparison: { comparable: true, verdict: 'success', resolvedFailures: ['value'], newFailures: [], missingTests: [] } };
}
describe('real backend guardrails', () => {
  test('ACCEPTED: writes allowed code and records approval plus audit and config', async () => {
    expect(await apply('src/value.ts')).toMatchObject({ ok: true });
    expect(await readFile(path.join(root, 'src/value.ts'), 'utf8')).toContain('value = 2');
    expect(hooks.getHookLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'allow', metadata: expect.objectContaining({ config: expect.any(Object) }) })]));
    expect(hooks.logStore.getAuditLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'allow' })]));
  });
  test.each(['.env', '.github/workflows/ci.yml'])('BLOCKED: %s is unchanged before any write', async (file) => {
    expect(await apply(file)).toMatchObject({ ok: false, error: { message: `Protected file: ${file}` } });
    expect(await readFile(path.join(root, file), 'utf8')).toBe(original);
    expect(await git('status', '--porcelain')).toBe('');
    expect(await git('rev-parse', 'HEAD')).toBe(head);
    expect(hooks.getHookLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'block' })]));
    expect(hooks.logStore.getAuditLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ decision: 'block' })]));
  });
  test.each(['export const key = "AKIA1234567890123456";', 'SECRET_KEY=example', 'const apiKey = "hardcoded-value";'])('blocks injected secret without copying content to logs: %s', async (text) => {
    expect(await apply('src/value.ts', text)).toMatchObject({ ok: false, error: { message: 'Secret pattern detected in added content.' } });
    expect(await readFile(path.join(root, 'src/value.ts'), 'utf8')).toBe(original);
    expect(JSON.stringify(hooks.getHookLogs())).not.toContain(text);
  });
  test('blocks a real commit without evidence and keeps HEAD unchanged', async () => {
    unwrap(await apply('src/value.ts'));
    const diff = await controller.diff(ids);
    expect(await controller.tools.git_commit_fix({ ...ids, message: 'repair', expectedDiffHash: diff.diffHash, verificationRunId: randomUUID() })).toMatchObject({ ok: false });
    expect(await git('rev-parse', 'HEAD')).toBe(head);
    expect(hooks.getHookLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ hookId: 'verified-evidence-commit', decision: 'block' })]));
  });
  test('allows real verified commit and emits post:commit', async () => {
    const before = await controller.workspaceStateHash();
    unwrap(await apply('src/value.ts'));
    evidence = makeEvidence(before, await controller.workspaceStateHash());
    const diff = await controller.diff(ids);
    const result = await controller.tools.git_commit_fix({ ...ids, message: 'verified repair', expectedDiffHash: diff.diffHash, verificationRunId: evidence.candidate.runId });
    expect(result).toMatchObject({ ok: true });
    expect(await git('rev-parse', 'HEAD')).not.toBe(head);
    expect(hooks.getHookLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'post:commit', decision: 'allow' })]));
  });
  test.each(['skipped', 'regression', 'stale', 'incomplete', 'missing'])('blocks %s evidence', async (kind) => {
    const value = makeEvidence('a'.repeat(64), 'b'.repeat(64));
    if (kind === 'skipped') { value.candidate.cases[0].status = 'skipped'; value.candidate.summary.passed = 0; value.candidate.summary.skipped = 1; }
    if (kind === 'regression') value.comparison.verdict = 'regression';
    if (kind === 'stale') value.candidate.workspaceStateHash = 'c'.repeat(64);
    if (kind === 'incomplete') value.candidate.complete = false;
    if (kind === 'missing') value.comparison.missingTests = ['value'];
    expect(await hooks.trigger('pre:git_commit', { files: ['src/value.ts'], unifiedDiff: patch('src/value.ts'), branch: 'fix/hooks', evidence: value, workspaceStateHash: 'b'.repeat(64) })).toMatchObject({ ok: false });
  });
});
describe('persistence and lifecycle', () => {
  test('saves valid entity and emits before/after; invalid entities never reach DB', async () => {
    const coordinator = new HookExecutionCoordinator(hooks);
    const save = jest.fn(async () => {});
    const valid = { workspaceStateHash: 'a'.repeat(64), timestamp: new Date().toISOString() };
    expect(await coordinator.saveRun(valid, save)).toMatchObject({ ok: true });
    for (const invalid of [{}, { ...valid, timestamp: 'bad' }, { ...valid, workspaceStateHash: 'bad' }]) expect(await coordinator.saveRun(invalid, save)).toMatchObject({ ok: false });
    expect(save).toHaveBeenCalledTimes(1);
    expect(hooks.getHookLogs().some((e) => e.event === 'db:after_save_run')).toBe(true);
    expect(hooks.getHookStats().block).toBe(3);
  });
  test('adapter receives decisions and audits; query returns defensive copies', async () => {
    const adapter = { appendExecution: jest.fn(async () => {}), appendAudit: jest.fn(async () => {}) };
    const manager = createHookManager({}, adapter);
    await manager.trigger('pre:analyze', {});
    expect(adapter.appendExecution).toHaveBeenCalledTimes(2);
    expect(adapter.appendAudit).toHaveBeenCalledTimes(1);
    const logs = manager.getHookLogs(); logs[0].reason = 'tampered';
    expect(manager.getHookLogs()[0].reason).not.toBe('tampered');
    const config = manager.getConfig(); config.protectedFiles.length = 0;
    expect(manager.getConfig().protectedFiles.length).toBeGreaterThan(0);
  });
  test('adapter failure prevents operation', async () => {
    const manager = createHookManager({}, { async appendExecution() { throw new Error('DB offline'); }, async appendAudit() {} });
    const save = jest.fn();
    expect(await new HookExecutionCoordinator(manager).saveRun({ workspaceStateHash: 'a'.repeat(64), timestamp: new Date().toISOString() }, save)).toMatchObject({ ok: false });
    expect(save).not.toHaveBeenCalled();
    expect(manager.getHookLogs()).toHaveLength(1);
  });
  test('priority, async execution, warn and short circuit', async () => {
    const manager = new HookManager(); const calls = [];
    for (const [id, priority, decision] of [['last', 30, 'allow'], ['stop', 20, 'block'], ['first', 10, 'warn']]) manager.register({ id, name: id, priority, events: ['pre:analyze'], async execute() { calls.push(id); return { decision, reason: id }; } });
    expect(await manager.trigger('pre:analyze', {})).toMatchObject({ ok: false, error: { message: 'stop' } });
    expect(calls).toEqual(['first', 'stop']);
    expect(manager.getHookLogs()[0]).toMatchObject({ decision: 'allow', metadata: { warning: true } });
  });
  test('exceptions and invalid hook outcomes fail closed', async () => {
    const manager = new HookManager();
    manager.register({ id: 'broken', name: 'broken', events: ['pre:analyze'], execute() { throw new Error('sensitive'); } });
    expect(await manager.trigger('pre:analyze', {})).toMatchObject({ ok: false });
    expect(JSON.stringify(manager.getHookLogs())).not.toContain('sensitive');
  });
  test('configuration disables rules, enforces branch and limits', async () => {
    const input = { files: ['src/value.ts'], unifiedDiff: patch('src/value.ts'), branch: 'main' };
    expect(await hooks.trigger('pre:git_commit', input)).toMatchObject({ ok: false, error: { message: 'Commit branch is not allowed.' } });
    expect(await createHookManager({ maxPatchCharacters: 1 }).trigger('pre:apply_patch', input)).toMatchObject({ ok: false });
    expect(await createHookManager({ rules: { 'protected-files-and-secrets': false } }).trigger('pre:apply_patch', {})).toMatchObject({ ok: true });
    expect(await createHookManager({ enabled: false }).trigger('pre:apply_patch', {})).toMatchObject({ ok: true });
    expect(() => new HookManager({ maxFiles: 0 })).toThrow();
    expect(() => hooks.register({ id: 'verified-evidence-commit' })).toThrow();
  });
  test('coordinator prevents analysis/test execution on block and emits test completion', async () => {
    const coordinator = new HookExecutionCoordinator(hooks);
    const analyzeCode = jest.fn(async () => ({ analysisId: 'example' }));
    const runTests = jest.fn(async () => ({ workspaceStateHash: 'a'.repeat(64), finishedAt: new Date().toISOString() }));
    expect(await coordinator.analyze({ analyzeCode }, { paths: ['src/value.ts'], checks: ['syntax'] })).toMatchObject({ ok: true });
    expect(await coordinator.runTests({ runTests }, { runner: 'jest' })).toMatchObject({ ok: true });
    hooks.register({ id: 'deny-tools', name: 'deny-tools', events: ['pre:analyze', 'pre:run_tests'], execute: () => ({ decision: 'block', reason: 'Denied' }) });
    expect(await coordinator.analyze({ analyzeCode }, { paths: ['src/value.ts'], checks: ['syntax'] })).toMatchObject({ ok: false });
    expect(await coordinator.runTests({ runTests }, { runner: 'jest' })).toMatchObject({ ok: false });
    expect(analyzeCode).toHaveBeenCalledTimes(1); expect(runTests).toHaveBeenCalledTimes(1);
    expect(hooks.getHookLogs().some((e) => e.event === 'post:test_run')).toBe(true);
  });
});
