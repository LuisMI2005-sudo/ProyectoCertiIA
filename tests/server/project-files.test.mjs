import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, rm, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { listProjectFiles } from '../../dist/server/project-files.js';
import { RunAuditSchema } from '../../dist/server/contracts.js';
import { SubagentRuntime, ScopedToolProxy } from '../../dist/subagents/index.js';
import { startHttpServer } from '../../dist/server/http.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/local-adapter.js';

let root, workspace;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devguardian-files-')); workspace = path.join(root, 'workspace');
  await mkdir(path.join(workspace, 'src'), { recursive: true });
  await writeFile(path.join(workspace, 'src/value.ts'), 'export const value = 1;');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
test('lists actual safe text files, excluding dependencies, secrets, symlinks and hard links', async () => {
  for (const folder of ['.git', 'node_modules', 'secrets']) {
    await mkdir(path.join(workspace, folder)); await writeFile(path.join(workspace, folder, 'private.json'), '{}');
  }
  await writeFile(path.join(workspace, '.env'), 'DO_NOT_EXPOSE=true');
  await writeFile(path.join(workspace, 'README.md'), '# Example');
  await writeFile(path.join(root, 'outside.ts'), 'outside');
  await mkdir(path.join(root, 'outside-folder'));
  await writeFile(path.join(root, 'outside-folder', 'hidden.ts'), 'outside');
  await symlink(path.join(root, 'outside-folder'), path.join(workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await link(path.join(root, 'outside.ts'), path.join(workspace, 'hard.ts'));
  expect(await listProjectFiles(workspace)).toEqual({ files: [{ path: 'README.md', analyzable: false }, { path: 'src/value.ts', analyzable: true }], truncated: false });
});
test('explains a lost workspace without returning an empty successful listing', async () => {
  await expect(listProjectFiles(path.join(root, 'missing'))).rejects.toThrow('Vuelve a importar');
});
test.each([{ checks: [] }, { checks: ['semantic', 'semantic'] }, { checks: ['unknown'] }])('rejects invalid check selection $checks', ({ checks }) => {
  expect(RunAuditSchema.safeParse({ projectId: randomUUID(), mode: 'diagnose', path: 'src/value.ts', checks }).success).toBe(false);
});
const request = (checks) => ({ taskId: randomUUID(), parentSessionId: randomUUID(), role: 'diagnostic', objective: 'Check requested analysis',
  scopedContext: { path: 'src/value.ts', ...(checks ? { checks } : {}) }, allowedTools: ['analyze_code', 'read_file_context'], budget: { maxToolCalls: 3, timeoutMs: 10000 } });
test.each([{ checks: undefined }, { checks: ['semantic'] }])('real diagnostic worker forwards selected checks $checks', async ({ checks }) => {
  const analyze = jest.fn(async () => ({ analysisId: randomUUID(), diagnostics: [], affectedSymbols: [], dependencies: [], analyzedFiles: ['src/value.ts'], truncated: false }));
  const runtime = new SubagentRuntime({ analyze_code: analyze, read_file_context: async () => ({ path: 'src/value.ts', content: 'export const value = 1;', startLine: 1, endLine: 1, fileHash: 'a'.repeat(64), truncated: false }) });
  expect(await runtime.execute(request(checks))).toMatchObject({ status: 'completed' });
  expect(analyze).toHaveBeenCalledWith({ paths: ['src/value.ts'], checks: checks ?? ['syntax', 'semantic', 'lint'] }, expect.anything());
});
test('cannot change delegated analysis checks', async () => {
  const execute = jest.fn(); const proxy = new ScopedToolProxy(request(['semantic']), { analyze_code: execute });
  await expect(proxy.call('analyze_code', { paths: ['src/value.ts'], checks: ['lint'] })).rejects.toThrow('scope');
  expect(execute).not.toHaveBeenCalled();
});
test('real HTTP endpoint lists files only for authorized projects and disallows caller-selected paths', async () => {
  const repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
  const app = await startHttpServer({ repository, workspaceRoots: [root], runners: [], apiToken: 'files-test', port: 0, host: '127.0.0.1', logger: () => {} });
  try {
    const project = await app.backend.persistence.registerProject({ name: 'Files', repoPath: workspace, runnerType: 'jest', defaultBranch: 'main' });
    const url = `${app.url}/api/projects/${project.id}/files`;
    expect((await fetch(url)).status).toBe(401);
    const headers = { Authorization: 'Bearer files-test' };
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect((await response.json()).data.files).toEqual([{ path: 'src/value.ts', analyzable: true }]);
    expect((await fetch(url + '?path=../', { headers })).status).toBe(422);
    expect((await fetch(`${app.url}/api/projects/${randomUUID()}/files`, { headers })).status).toBe(404);
  } finally { await app.close(); }
});
