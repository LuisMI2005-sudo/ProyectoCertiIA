import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { GitController, createGitController } from '../../dist/git-controller/index.js';
import { ToolSchemas, resultSchema } from '../../dist/shared/contracts.js';

jest.setTimeout(60000);
const execute = promisify(execFile);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const original = 'export const add = (a, b) => a - b;\n';
const fixed = 'export const add = (a, b) => a + b;\n';
const patch = [
  'diff --git a/calc.ts b/calc.ts', '--- a/calc.ts', '+++ b/calc.ts',
  '@@ -1 +1 @@', `-${original.trimEnd()}`, `+${fixed.trimEnd()}`, ''
].join('\n');
let root, controller, store, base;
const git = async (...args) => (await execute('git', args, {
  cwd: root, timeout: 15000, maxBuffer: 5_000_000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
})).stdout;
const unwrap = (result) => {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
};
async function begin(slug = 'repair') {
  const session = unwrap(await controller.tools.git_create_fix_branch({ slug, expectedHead: base }));
  const attempt = unwrap(await controller.tools.git_begin_attempt({ sessionId: session.sessionId }));
  return { sessionId: session.sessionId, attemptId: attempt.attemptId };
}
async function apply(ids, unifiedDiff = patch, expectedFileHashes = { 'calc.ts': hash(original) }) {
  return controller.tools.git_apply_patch({ ...ids, unifiedDiff, expectedFileHashes });
}
async function evidence(ids) {
  const baselineState = await controller.workspaceStateHash();
  unwrap(await apply(ids));
  const candidateState = await controller.workspaceStateHash();
  const now = new Date().toISOString();
  const makeRun = (failed, workspaceStateHash) => ({
    runId: randomUUID(), runner: 'jest', status: failed ? 'failed' : 'passed', exitCode: failed ? 1 : 0,
    durationMs: 1, summary: { total: 2, passed: failed ? 1 : 2, failed: failed ? 1 : 0, skipped: 0, todo: 0 },
    cases: [
      { id: 'add', path: 'calc.test.mjs', name: 'adds', status: failed ? 'failed' : 'passed', durationMs: 1,
        failureMessage: failed ? 'Expected sum' : null },
      { id: 'existing', path: 'calc.test.mjs', name: 'existing', status: 'passed', durationMs: 1, failureMessage: null }
    ], stdout: '', stderr: '', truncated: false, complete: true, startedAt: now, finishedAt: now,
    workspaceStateHash, configurationHash: 'a'.repeat(64)
  });
  const value = { baseline: makeRun(true, baselineState), candidate: makeRun(false, candidateState),
    comparison: { resolvedFailures: ['add'], newFailures: [], missingTests: [], comparable: true, verdict: 'success' } };
  store.set(value.candidate.runId, value);
  return value;
}
beforeEach(async () => {
  root = await mkdtemp(path.join(process.cwd(), '.phase2-test-'));
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'DevGuardian Tests');
  await git('config', 'user.email', 'tests@devguardian.invalid');
  await git('config', 'core.autocrlf', 'false');
  await git('config', 'commit.gpgsign', 'false');
  await writeFile(path.join(root, 'calc.ts'), original);
  await writeFile(path.join(root, 'other.ts'), 'original unrelated\n');
  await writeFile(path.join(root, '.gitignore'), 'coverage/\nignored.txt\nlinkdir\n');
  await git('add', '.');
  await git('commit', '-m', 'Fixture baseline');
  base = (await git('rev-parse', 'HEAD')).trim();
  store = new Map();
  controller = await GitController.create({ workspaceRoot: root, verificationStore: {
    async getEvidence(runId) { const value = store.get(runId); if (!value) throw new Error('Missing run'); return value; }
  } });
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe('repository state and serial execution', () => {
  test('reports clean state and creates an isolated fix branch and checkpoint', async () => {
    const result = await controller.tools.git_status({});
    expect(resultSchema(ToolSchemas.git_status.output).safeParse(result).success).toBe(true);
    expect(unwrap(result)).toMatchObject({ branch: 'main', headCommit: base, clean: true });
    const ids = await begin();
    expect((await git('branch', '--show-current')).trim()).toBe('fix/repair');
    expect(unwrap(await controller.tools.git_diff(ids))).toMatchObject({ diff: '', changedFiles: [], insertions: 0, deletions: 0 });
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(base);
  });
  test('rejects dirty working trees and incorrect expected HEAD', async () => {
    expect(await controller.tools.git_create_fix_branch({ slug: 'bad-head', expectedHead: 'a'.repeat(40) }))
      .toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    await writeFile(path.join(root, 'foreign.txt'), 'user work');
    expect(await controller.tools.git_create_fix_branch({ slug: 'dirty', expectedHead: base }))
      .toMatchObject({ ok: false, error: { code: 'WORKTREE_DIRTY' } });
    expect((await git('branch', '--show-current')).trim()).toBe('main');
  });
  test('rejects detached HEAD and duplicate branches without overwriting references', async () => {
    await git('switch', '--detach', base);
    expect(unwrap(await controller.tools.git_status({})).branch).toBeNull();
    expect(await controller.tools.git_create_fix_branch({ slug: 'detached', expectedHead: base })).toMatchObject({ ok: false });
    await git('switch', 'main');
    await git('branch', 'fix/existing');
    expect(await controller.tools.git_create_fix_branch({ slug: 'existing', expectedHead: base })).toMatchObject({ ok: false });
    expect((await git('branch', '--show-current')).trim()).toBe('main');
  });
  test('reports an unborn repository without inventing a HEAD commit', async () => {
    const empty = path.join(root, 'empty-repository');
    await mkdir(empty);
    await execute('git', ['init', '-b', 'main', empty]);
    const initialized = await createGitController({ workspaceRoot: empty,
      verificationStore: { async getEvidence() { throw new Error(); } } });
    const clean = unwrap(await unwrap(initialized).tools.git_status({}));
    expect(clean).toMatchObject({ branch: 'main', headCommit: null, clean: true });
  });
  test('serializes branch creation across controller instances', async () => {
    const second = await GitController.create({ workspaceRoot: root, verificationStore: { async getEvidence() { throw new Error(); } } });
    const results = await Promise.all([
      controller.tools.git_create_fix_branch({ slug: 'same', expectedHead: base }),
      second.tools.git_create_fix_branch({ slug: 'same', expectedHead: base })
    ]);
    expect(results.filter((value) => value.ok)).toHaveLength(1);
    const first = unwrap(results.find((value) => value.ok));
    const checkpoints = await Promise.all([
      controller.tools.git_begin_attempt({ sessionId: first.sessionId }),
      second.tools.git_begin_attempt({ sessionId: first.sessionId })
    ]);
    expect(checkpoints.filter((value) => value.ok)).toHaveLength(1);
  });
  test('honors cross-process locks and recovers the queue after rejection', async () => {
    const short = await GitController.create({ workspaceRoot: root, lockTimeoutMs: 50,
      verificationStore: { async getEvidence() { throw new Error(); } } });
    const lock = path.join(root, '.git', 'devguardian.lock');
    await writeFile(lock, 'another process');
    expect(await short.tools.git_status({})).toMatchObject({ ok: false, error: { code: 'EXECUTION_TIMEOUT' } });
    expect(await readFile(lock, 'utf8')).toBe('another process');
    await rm(lock);
    expect(unwrap(await short.tools.git_status({})).clean).toBe(true);
  });
  test('rejects unknown IDs and unexpected input properties', async () => {
    expect(await controller.tools.git_begin_attempt({ sessionId: randomUUID() }))
      .toMatchObject({ ok: false, error: { code: 'SESSION_NOT_FOUND' } });
    expect(await controller.tools.git_status({ command: 'reset --hard' }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const ids = await begin();
    expect(await controller.tools.git_diff({ ...ids, attemptId: randomUUID() }))
      .toMatchObject({ ok: false, error: { code: 'ATTEMPT_NOT_FOUND' } });
    expect(await createGitController({ workspaceRoot: root, gitTimeoutMs: 0,
      verificationStore: { async getEvidence() { throw new Error(); } } }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('patches, diffs and safe rollback', () => {
  test('applies a patch, computes a stable diff and rolls back without switching branches', async () => {
    const ids = await begin();
    const result = unwrap(await apply(ids));
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(fixed);
    const diff = unwrap(await controller.tools.git_diff(ids));
    expect(diff).toMatchObject({ changedFiles: ['calc.ts'], insertions: 1, deletions: 1, diffHash: result.diffHash });
    expect(diff.diffHash).toBe(hash(diff.diff));
    expect((await git('diff', '--cached')).trim()).toBe('');
    expect(unwrap(await controller.tools.git_rollback_attempt(ids)))
      .toMatchObject({ restoredCommit: base, revertedFiles: ['calc.ts'], branch: 'fix/repair', clean: true });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(original);
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(base);
    expect(unwrap(await controller.tools.git_begin_attempt({ sessionId: ids.sessionId })).checkpointCommit).toBe(base);
  });
  test('rejects invalid hashes and inapplicable hunks without modifying any files', async () => {
    const ids = await begin();
    expect(await apply(ids, patch, { 'calc.ts': 'f'.repeat(64) }))
      .toMatchObject({ ok: false, error: { code: 'PATCH_CONFLICT' } });
    expect(await apply(ids, patch.replace(`-${original.trimEnd()}`, '-not existing')))
      .toMatchObject({ ok: false, error: { code: 'PATCH_CONFLICT' } });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(original);
    expect(unwrap(await controller.tools.git_status({})).clean).toBe(true);
    expect(unwrap(await apply(ids)).applied).toBe(true);
  });
  test('serializes simultaneous patch applications; a stale hash cannot apply twice', async () => {
    const ids = await begin();
    const results = await Promise.all([apply(ids), apply(ids)]);
    expect(results.filter((value) => value.ok)).toHaveLength(1);
    expect(results.find((value) => !value.ok)).toMatchObject({ error: { code: 'PATCH_CONFLICT' } });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(fixed);
  });
  test('supports additions and deletions and restores only their original state', async () => {
    const ids = await begin();
    const changes = [
      'diff --git a/new.ts b/new.ts', 'new file mode 100644', '--- /dev/null', '+++ b/new.ts',
      '@@ -0,0 +1 @@', '+export const value = 1;',
      'diff --git a/other.ts b/other.ts', 'deleted file mode 100644', '--- a/other.ts', '+++ /dev/null',
      '@@ -1 +0,0 @@', '-original unrelated', ''
    ].join('\n');
    unwrap(await apply(ids, changes, { 'new.ts': null, 'other.ts': hash('original unrelated\n') }));
    const diff = unwrap(await controller.tools.git_diff(ids));
    expect(diff.changedFiles.sort()).toEqual(['new.ts', 'other.ts']);
    expect(diff).toMatchObject({ insertions: 1, deletions: 1 });
    unwrap(await controller.tools.git_rollback_attempt(ids));
    await expect(readFile(path.join(root, 'new.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(root, 'other.ts'), 'utf8')).toBe('original unrelated\n');
  });
  test('supports multiple patches per attempt and reverses the combined diff', async () => {
    const ids = await begin();
    unwrap(await apply(ids));
    const second = patch.replace(`-${original.trimEnd()}`, `-${fixed.trimEnd()}`).replace(
      `+${fixed.trimEnd()}`, '+export const add = (a, b) => Number(a) + Number(b);');
    unwrap(await apply(ids, second, { 'calc.ts': hash(fixed) }));
    unwrap(await controller.tools.git_rollback_attempt(ids));
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(original);
  });
  test('preserves executable modes in Git and produces a stable patch hash', async () => {
    const ids = await begin();
    const added = ['diff --git a/runner.sh b/runner.sh', 'new file mode 100755',
      '--- /dev/null', '+++ b/runner.sh', '@@ -0,0 +1 @@', '+echo ready', ''].join('\n');
    const applied = unwrap(await apply(ids, added, { 'runner.sh': null }));
    const diff = unwrap(await controller.tools.git_diff(ids));
    expect(diff.diffHash).toBe(applied.diffHash);
    expect(diff.diff).toContain('new file mode 100755');
    unwrap(await controller.tools.git_rollback_attempt(ids));
    await expect(readFile(path.join(root, 'runner.sh'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('handles standard diff headers for filenames containing spaces', async () => {
    const filename = 'with spaces.ts';
    await writeFile(path.join(root, filename), original);
    await git('add', filename);
    await git('commit', '-m', 'Spaced filename baseline');
    base = (await git('rev-parse', 'HEAD')).trim();
    const ids = await begin();
    const diff = patch.replaceAll('calc.ts', filename)
      .replace(`--- a/${filename}\n`, `--- a/${filename}\t\n`)
      .replace(`+++ b/${filename}\n`, `+++ b/${filename}\t\n`);
    unwrap(await apply(ids, diff, { [filename]: hash(original) }));
    unwrap(await controller.tools.git_rollback_attempt(ids));
    expect(await readFile(path.join(root, filename), 'utf8')).toBe(original);
  });
  test('restores a deleted file inside a directory', async () => {
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'nested', 'only.ts'), original);
    await git('add', 'nested/only.ts');
    await git('commit', '-m', 'Nested baseline');
    base = (await git('rev-parse', 'HEAD')).trim();
    const ids = await begin();
    const deletion = ['diff --git a/nested/only.ts b/nested/only.ts', 'deleted file mode 100644',
      '--- a/nested/only.ts', '+++ /dev/null', '@@ -1 +0,0 @@', `-${original.trimEnd()}`, ''].join('\n');
    unwrap(await apply(ids, deletion, { 'nested/only.ts': hash(original) }));
    unwrap(await controller.tools.git_rollback_attempt(ids));
    expect(await readFile(path.join(root, 'nested', 'only.ts'), 'utf8')).toBe(original);
  });
  test('adds nested files and preserves unrelated files in the created directory on rollback', async () => {
    const ids = await begin();
    const addition = ['diff --git a/generated/helper.ts b/generated/helper.ts', 'new file mode 100644',
      '--- /dev/null', '+++ b/generated/helper.ts', '@@ -0,0 +1 @@', '+export const helper = 1;', ''].join('\n');
    unwrap(await apply(ids, addition, { 'generated/helper.ts': null }));
    await writeFile(path.join(root, 'generated', 'foreign.txt'), 'user content');
    expect(unwrap(await controller.tools.git_rollback_attempt(ids)).clean).toBe(false);
    expect(await readFile(path.join(root, 'generated', 'foreign.txt'), 'utf8')).toBe('user content');
    await expect(readFile(path.join(root, 'generated', 'helper.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('rollback preserves unrelated modifications, staging and untracked files', async () => {
    const ids = await begin();
    unwrap(await apply(ids));
    await writeFile(path.join(root, 'other.ts'), 'foreign staged work\n');
    await git('add', 'other.ts');
    const staged = await git('diff', '--cached');
    await writeFile(path.join(root, 'foreign.txt'), 'foreign untracked work');
    const rollback = unwrap(await controller.tools.git_rollback_attempt(ids));
    expect(rollback.clean).toBe(false);
    expect(await git('diff', '--cached')).toBe(staged);
    expect(await readFile(path.join(root, 'other.ts'), 'utf8')).toBe('foreign staged work\n');
    expect(await readFile(path.join(root, 'foreign.txt'), 'utf8')).toBe('foreign untracked work');
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(original);
  });
  test('refuses rollback when a managed file was edited or staged externally', async () => {
    const ids = await begin();
    unwrap(await apply(ids));
    await writeFile(path.join(root, 'calc.ts'), 'foreign work\n');
    expect(await controller.tools.git_rollback_attempt(ids)).toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe('foreign work\n');
    await writeFile(path.join(root, 'calc.ts'), fixed);
    await git('add', 'calc.ts');
    expect(await controller.tools.git_rollback_attempt(ids)).toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
  });
  test('rejects changed branches and foreign commits', async () => {
    const ids = await begin();
    unwrap(await apply(ids));
    await git('switch', 'main');
    expect(await controller.tools.git_rollback_attempt(ids)).toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(fixed);
  });
  test('never rewinds a foreign commit on the repair branch', async () => {
    const ids = await begin();
    unwrap(await apply(ids));
    await writeFile(path.join(root, 'other.ts'), 'foreign commit\n');
    await git('add', 'other.ts');
    await git('commit', '-m', 'Foreign work');
    const foreignHead = (await git('rev-parse', 'HEAD')).trim();
    expect(await controller.tools.git_rollback_attempt(ids)).toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(foreignHead);
    expect(await readFile(path.join(root, 'other.ts'), 'utf8')).toBe('foreign commit\n');
  });
  test('rejects traversal, metadata access, mismatched headers and symlink modes', async () => {
    const ids = await begin();
    for (const target of ['../escape.ts', '.git/config']) {
      expect(await apply(ids, patch.replaceAll('calc.ts', target), { [target]: hash(original) }))
        .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    }
    expect(await apply(ids, patch.replace('+++ b/calc.ts', '+++ b/other.ts'))).toMatchObject({ ok: false });
    const symbolic = ['diff --git a/link.ts b/link.ts', 'new file mode 120000',
      '--- /dev/null', '+++ b/link.ts', '@@ -0,0 +1 @@', '+../../external', ''].join('\n');
    expect(await apply(ids, symbolic, { 'link.ts': null }))
      .toMatchObject({ ok: false, error: { code: 'PATCH_INVALID' } });
    expect(await readFile(path.join(root, 'calc.ts'), 'utf8')).toBe(original);
  });
  test('rejects a newly introduced directory symlink before modifying its target', async () => {
    const ids = await begin();
    const outside = await mkdtemp(path.join(process.cwd(), '.phase2-test-'));
    try {
      await writeFile(path.join(outside, 'target.ts'), original);
      await symlink(outside, path.join(root, 'linkdir'), process.platform === 'win32' ? 'junction' : 'dir');
      // Ignore the link itself on POSIX too, so this exercises path security rather than the dirty-tree guard.
      expect((await git('status', '--porcelain')).trim()).toBe('');
      const result = await apply(ids, patch.replaceAll('calc.ts', 'linkdir/target.ts'), { 'linkdir/target.ts': hash(original) });
      expect(result).toMatchObject({ ok: false, error: { code: 'SYMLINK_FORBIDDEN' } });
      expect(await readFile(path.join(outside, 'target.ts'), 'utf8')).toBe(original);
    } finally { await rm(path.join(root, 'linkdir'), { force: true, recursive: true }); await rm(outside, { recursive: true, force: true }); }
  });
});

describe('verified atomic commits', () => {
  test('commits a verified patch atomically and leaves the fix branch clean', async () => {
    const ids = await begin();
    const proof = await evidence(ids);
    const diff = unwrap(await controller.tools.git_diff(ids));
    const result = await controller.tools.git_commit_fix({ ...ids, message: 'Fix addition',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId });
    expect(resultSchema(ToolSchemas.git_commit_fix.output).safeParse(result).success).toBe(true);
    const committed = unwrap(result);
    expect(committed).toMatchObject({ branch: 'fix/repair', files: ['calc.ts'] });
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(committed.commit);
    expect((await git('rev-parse', 'HEAD^')).trim()).toBe(base);
    expect(unwrap(await controller.tools.git_status({})).clean).toBe(true);
    expect(await git('show', 'HEAD:calc.ts')).toBe(fixed);
    expect(await controller.tools.git_rollback_attempt(ids)).toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    expect(unwrap(await controller.tools.git_begin_attempt({ sessionId: ids.sessionId })).checkpointCommit).toBe(committed.commit);
  });
  test('rejects diff hash mismatch, unknown verification runs and stale workspace evidence', async () => {
    const ids = await begin();
    const proof = await evidence(ids);
    const diff = unwrap(await controller.tools.git_diff(ids));
    const input = { ...ids, message: 'Fix', expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId };
    expect(await controller.tools.git_commit_fix({ ...input, expectedDiffHash: 'b'.repeat(64) }))
      .toMatchObject({ ok: false, error: { code: 'PATCH_CONFLICT' } });
    expect(await controller.tools.git_commit_fix({ ...input, verificationRunId: randomUUID() }))
      .toMatchObject({ ok: false, error: { code: 'VERIFICATION_FAILED' } });
    proof.candidate.workspaceStateHash = 'c'.repeat(64);
    expect(await controller.tools.git_commit_fix(input)).toMatchObject({ ok: false, error: { code: 'VERIFICATION_FAILED' } });
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(base);
    expect((await git('diff', '--cached')).trim()).toBe('');
  });
  test('includes an added file in the verified commit without prior staging', async () => {
    const ids = await begin();
    const proof = await evidence(ids);
    const addition = ['diff --git a/new.ts b/new.ts', 'new file mode 100644',
      '--- /dev/null', '+++ b/new.ts', '@@ -0,0 +1 @@', '+export const value = 1;', ''].join('\n');
    unwrap(await apply(ids, addition, { 'new.ts': null }));
    proof.candidate.workspaceStateHash = await controller.workspaceStateHash();
    proof.candidate.startedAt = proof.candidate.finishedAt = new Date().toISOString();
    const diff = unwrap(await controller.tools.git_diff(ids));
    const result = unwrap(await controller.tools.git_commit_fix({ ...ids, message: 'Fix and add helper',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId }));
    expect(result.files.sort()).toEqual(['calc.ts', 'new.ts']);
    expect(await git('show', 'HEAD:new.ts')).toBe('export const value = 1;\n');
    expect(unwrap(await controller.tools.git_status({})).clean).toBe(true);
  });
  test.each(['missing', 'regression', 'different-config', 'wrong-baseline', 'timeout', 'premature'])
  ('rejects untrustworthy evidence: %s', async (scenario) => {
    const ids = await begin();
    const proof = await evidence(ids);
    if (scenario === 'missing') {
      proof.candidate.cases.pop(); proof.candidate.summary.total--; proof.candidate.summary.passed--;
    } else if (scenario === 'regression') proof.comparison.newFailures.push('existing');
    else if (scenario === 'different-config') proof.candidate.configurationHash = 'f'.repeat(64);
    else if (scenario === 'wrong-baseline') proof.baseline.workspaceStateHash = 'f'.repeat(64);
    else if (scenario === 'timeout') proof.candidate.status = 'timeout';
    else proof.candidate.startedAt = '2000-01-01T00:00:00Z';
    const diff = unwrap(await controller.tools.git_diff(ids));
    expect(await controller.tools.git_commit_fix({ ...ids, message: 'Fix',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId }))
      .toMatchObject({ ok: false, error: { code: 'VERIFICATION_FAILED' } });
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(base);
  });
  test('preserves foreign work when commit is rejected', async () => {
    const ids = await begin();
    const proof = await evidence(ids);
    const diff = unwrap(await controller.tools.git_diff(ids));
    await writeFile(path.join(root, 'other.ts'), 'foreign work\n');
    await git('add', 'other.ts');
    expect(await controller.tools.git_commit_fix({ ...ids, message: 'Fix',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId }))
      .toMatchObject({ ok: false, error: { code: 'WORKTREE_DIRTY' } });
    expect(await readFile(path.join(root, 'other.ts'), 'utf8')).toBe('foreign work\n');
    expect(await git('diff', '--cached')).toContain('+foreign work');
  });
  test('respects the native Git index lock without deleting it', async () => {
    const ids = await begin();
    const proof = await evidence(ids);
    const diff = unwrap(await controller.tools.git_diff(ids));
    await writeFile(path.join(root, '.git', 'index.lock'), 'foreign lock');
    expect(await controller.tools.git_commit_fix({ ...ids, message: 'Fix',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId }))
      .toMatchObject({ ok: false, error: { code: 'STATE_CONFLICT' } });
    expect(await readFile(path.join(root, '.git', 'index.lock'), 'utf8')).toBe('foreign lock');
    expect((await git('rev-parse', 'HEAD')).trim()).toBe(base);
  });
  test('disables repository hooks during autonomous Git writes', async () => {
    const marker = path.join(root, 'hook-ran');
    await writeFile(path.join(root, '.git', 'hooks', 'reference-transaction'),
      '#!/bin/sh\necho unsafe > hook-ran\n', { mode: 0o755 });
    const ids = await begin();
    const proof = await evidence(ids);
    const diff = unwrap(await controller.tools.git_diff(ids));
    unwrap(await controller.tools.git_commit_fix({ ...ids, message: 'Fix',
      expectedDiffHash: diff.diffHash, verificationRunId: proof.candidate.runId }));
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('ignores generated artifacts when checking workspace fingerprints', async () => {
    const before = await controller.workspaceStateHash();
    await mkdir(path.join(root, 'coverage'));
    await writeFile(path.join(root, 'coverage', 'report.json'), '{}');
    expect(await controller.workspaceStateHash()).toBe(before);
  });
});
