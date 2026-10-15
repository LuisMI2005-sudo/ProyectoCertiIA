import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, symlink, link, rm } from 'node:fs/promises';
import path from 'node:path';
import { WorkspacePathGuard, validateWorkspaceRelativePath } from '../dist/shared/path-security.js';
import { captureResult, failure, ValidationError } from '../dist/shared/errors.js';
import {
  ToolSchemas, parseContract, GitApplyPatchInputSchema, RunTestsOutputSchema,
  CompareTestRunsOutputSchema, resultSchema, GitStatusOutputSchema
} from '../dist/shared/contracts.js';

let fixture;
let root;
let guard;
beforeAll(async () => {
  fixture = await mkdtemp(path.join(process.cwd(), '.phase1-test-'));
  root = path.join(fixture, 'workspace');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, '.git'));
  await mkdir(path.join(fixture, 'outside'));
  await writeFile(path.join(root, 'src', 'file.ts'), 'export const value = 1;');
  await writeFile(path.join(fixture, 'outside', 'secret.ts'), 'external');
  const junction = process.platform === 'win32' ? 'junction' : 'dir';
  await symlink(path.join(root, 'src'), path.join(root, 'internal'), junction);
  await symlink(path.join(fixture, 'outside'), path.join(root, 'external'), junction);
  await symlink(path.join(root, '.git'), path.join(root, 'metadata'), junction);
  await link(path.join(root, 'src', 'file.ts'), path.join(root, 'linked.ts'));
  guard = await WorkspacePathGuard.create(root);
});
afterAll(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

describe('canonical workspace paths', () => {
  test.each(['../x', 'src/../x', '/tmp/x', 'C:\\x', 'C:x', '\\\\host\\share',
    'src//x', './x', 'src/CON.ts', 'src/x.', 'src/x ', 'src/x:stream', 'src/x\0', '.git/config'])
  ('rejects unsafe input %j', (input) => {
    expect(() => validateWorkspaceRelativePath(input)).toThrow();
  });
  test('normalizes portable separators', () => {
    expect(validateWorkspaceRelativePath('src\\file.ts')).toBe('src/file.ts');
  });
  test('resolves existing regular files', async () => {
    const resolved = await guard.resolve('src/file.ts');
    expect(resolved).toMatchObject({ exists: true, kind: 'file', relativePath: 'src/file.ts' });
    expect(resolved.absolutePath).toBe(path.join(guard.root, 'src', 'file.ts'));
  });
  test('allows reading internal symlinks', async () => {
    expect((await guard.resolve('internal/file.ts')).absolutePath).toBe(path.join(guard.root, 'src', 'file.ts'));
  });
  test('rejects symlinks leaving the root', async () => {
    await expect(guard.resolve('external/secret.ts')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_WORKSPACE' });
  });
  test('rejects aliases to Git metadata', async () => {
    await expect(guard.resolve('metadata', { kind: 'directory' })).rejects.toMatchObject({ code: 'PATH_PROTECTED' });
  });
  test('rejects writes through internal symlinks', async () => {
    await expect(guard.resolve('internal/file.ts', { operation: 'write' })).rejects.toMatchObject({ code: 'SYMLINK_FORBIDDEN' });
  });
  test('rejects writes to hard-linked files', async () => {
    await expect(guard.resolve('linked.ts', { operation: 'write' })).rejects.toMatchObject({ code: 'SYMLINK_FORBIDDEN' });
  });
  test('permits new files only in existing directories', async () => {
    expect(await guard.resolve('src/new.ts', { operation: 'write', mustExist: false })).toMatchObject({ exists: false });
    await expect(guard.resolve('missing/new.ts', { operation: 'write', mustExist: false }))
      .rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });
  test('rejects missing reads and incorrect types', async () => {
    await expect(guard.resolve('src/absent.ts')).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    await expect(guard.resolve('src')).rejects.toMatchObject({ code: 'FILE_TYPE_INVALID' });
  });
});

describe('shared contracts', () => {
  test('rejects unknown tool parameters and unsafe paths', () => {
    expect(() => parseContract(ToolSchemas.git_status.input, { command: 'reset --hard' })).toThrow(ValidationError);
    expect(ToolSchemas.read_file_context.input.safeParse({ path: '../secret' }).success).toBe(false);
  });
  test('supports additions with explicit absent-file expectations', () => {
    expect(GitApplyPatchInputSchema.safeParse({
      sessionId: '11111111-1111-4111-8111-111111111111',
      attemptId: '22222222-2222-4222-8222-222222222222',
      unifiedDiff: 'diff --git a/new.ts b/new.ts', expectedFileHashes: { 'new.ts': null }
    }).success).toBe(true);
  });
  test('does not classify skipped-only or incomplete runs as passed', () => {
    const run = {
      runId: '11111111-1111-4111-8111-111111111111', runner: 'jest', status: 'passed',
      exitCode: 0, durationMs: 1, summary: { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0 },
      cases: [], stdout: '', stderr: '', truncated: false, complete: true,
      startedAt: '2026-10-14T00:00:00Z', finishedAt: '2026-10-14T00:00:00.001Z',
      workspaceStateHash: 'a'.repeat(64), configurationHash: 'b'.repeat(64)
    };
    expect(RunTestsOutputSchema.safeParse(run).success).toBe(false);
    const passed = { ...run, summary: { ...run.summary, total: 1, passed: 1 },
      cases: [{ id: 'one', path: 'tests/a.test.mjs', name: 'one', status: 'passed', durationMs: 1, failureMessage: null }] };
    expect(RunTestsOutputSchema.safeParse(passed).success).toBe(true);
    expect(RunTestsOutputSchema.safeParse({ ...passed, complete: false }).success).toBe(false);
  });
  test('rejects success with missing tests', () => {
    expect(CompareTestRunsOutputSchema.safeParse({
      resolvedFailures: ['one'], newFailures: [], missingTests: ['two'], comparable: true, verdict: 'success'
    }).success).toBe(false);
  });
  test('keeps unsafe Git filenames reportable without authorizing writes', () => {
    expect(GitStatusOutputSchema.safeParse({ branch: null, headCommit: null, clean: false,
      staged: [], modified: [], untracked: ['CON.ts'], conflicted: [] }).success).toBe(true);
    expect(ToolSchemas.git_apply_patch.input.safeParse({ expectedFileHashes: { 'CON.ts': null } }).success).toBe(false);
  });
  test('does not expose unknown error messages or stack traces', () => {
    const result = failure(new Error('secret-token'));
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(resultSchema(ToolSchemas.git_status.output).safeParse(result).success).toBe(true);
  });
  test('captures expected domain errors', async () => {
    expect(await captureResult(async () => { throw new ValidationError('Invalid input.'); }))
      .toEqual({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', retryable: false } });
  });
});
