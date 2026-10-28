import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const execute = jest.fn();
jest.unstable_mockModule('../../dist/test-runner/process.js', () => ({ runProcess: execute }));
const { ImportProjectSchema, inspectImportTree, validateImportedProject, ProjectImporter } = await import('../../dist/server/project-import.js');
let root, server;
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'devguardian-import-test-')); execute.mockReset(); });
afterEach(async () => { if (server) { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); server = undefined; } await rm(root, { recursive: true, force: true }); });
test.each(['http://github.com/a/b', 'https://evil.com/a/b', 'https://github.com/a/b/tree/main', 'https://token@github.com/a/b', 'https://github.com/a/b?token=x', 'file:///repo', 'https://github.com/a/b#main'])('rejects unsafe repository URL %s', (url) => {
  expect(ImportProjectSchema.safeParse({ url }).success).toBe(false);
});
test('canonicalizes GitHub URL and rejects extra request options', () => {
  expect(ImportProjectSchema.parse({ url: 'https://github.com/team/project.git/' }).url).toBe('https://github.com/team/project.git');
  expect(ImportProjectSchema.safeParse({ url: 'https://github.com/a/b', command: 'npm install' }).success).toBe(false);
});
const tree = (file, mode = '100644', size = 30) => `${mode} blob ${'a'.repeat(40)} ${size}\t${file}\0`;
test.each([tree('link', '120000'), tree('../escape.ts'), tree('large.ts', '100644', 2000001), `160000 commit ${'a'.repeat(40)} -\tsubmodule\0`])('rejects unsafe Git tree before checkout', (output) => {
  expect(() => inspectImportTree(output)).toThrow();
});
test('preserves safe paths including spaces in real ls-tree format', () => {
  expect(inspectImportTree(tree('src/my file.ts'))).toEqual(['src/my file.ts']);
});
test('reports exact missing manifests and TypeScript config', async () => {
  const result = await validateImportedProject(root, ['src/main.ts']);
  expect(result.compatible).toBe(false);
  expect(result.missing.map((issue) => issue.path)).toEqual(['package.json', 'tsconfig.json']);
});
test('accepts JSONC configuration without running repository scripts', async () => {
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { postinstall: 'must never execute' }, devDependencies: { jest: '30' } }));
  await writeFile(path.join(root, 'tsconfig.json'), '{ // comment\n "compilerOptions": { "strict": true } }');
  const result = await validateImportedProject(root, ['src/main.ts', 'package.json', 'tsconfig.json']);
  expect(result).toMatchObject({ compatible: true, entryFile: 'src/main.ts', scope: 'static-analysis' });
  expect(result.warnings.map((issue) => issue.code)).toContain('DEPENDENCIES_NOT_INSTALLED');
});
test('rejects malformed package and TypeScript configuration and unsupported source', async () => {
  await writeFile(path.join(root, 'package.json'), '{broken');
  await writeFile(path.join(root, 'tsconfig.json'), '{broken');
  const result = await validateImportedProject(root, ['app.py', 'package.json', 'tsconfig.json']);
  expect(result.missing.map((issue) => issue.code)).toEqual(['NO_SUPPORTED_SOURCE', 'INVALID_MANIFEST', 'INVALID_TYPESCRIPT_CONFIG']);
});

async function startStream({ compatible = true, failure = false } = {}) {
  const register = jest.fn(async (raw) => ({ ...raw, id: randomUUID(), createdAt: new Date().toISOString() }));
  execute.mockImplementation(async (options) => {
    expect(options.env.DATABASE_URL).toBeUndefined();
    expect(options.args).toContain('credential.helper=');
    let stdout = '';
    if (options.args.includes('clone')) {
      if (failure) return { exitCode: 1 };
      const destination = options.args.at(-1);
      await mkdir(path.join(destination, 'src'), { recursive: true });
      await writeFile(path.join(destination, 'package.json'), '{}');
      await writeFile(path.join(destination, 'src/app.js'), 'export const value = 1;');
    }
    if (options.args.includes('ls-tree')) stdout = tree('package.json') + (compatible ? tree('src/app.js') : tree('app.py'));
    if (options.args.includes('symbolic-ref')) stdout = 'main\n';
    return { exitCode: 0, stdout, truncated: false, timedOut: false, cancelled: false, spawnError: null };
  });
  const importer = new ProjectImporter(root, register);
  server = createServer((_request, response) => { void importer.stream({ url: 'https://github.com/team/project' }, response); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  const text = await response.text();
  return { response, text, register };
}
test('streams actual ordered phases and registers only after compatibility validation', async () => {
  const { response, text, register } = await startStream();
  expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  expect([...text.matchAll(/"phase":"([^"]+)"/g)].map((match) => match[1])).toEqual(['cloning', 'inspecting', 'validating', 'registering']);
  expect(text).toContain('event: ready');
  expect(register).toHaveBeenCalledTimes(1);
  expect((await readdir(path.join(root, '.devguardian-imports'))).length).toBe(1);
  expect(execute.mock.calls.every(([options]) => options.executable === 'git')).toBe(true);
});
test('streams incompatibility and removes only its own unpublished checkout', async () => {
  const { text, register } = await startStream({ compatible: false });
  expect(text).toContain('event: incompatible'); expect(register).not.toHaveBeenCalled();
  expect(await readdir(path.join(root, '.devguardian-imports'))).toEqual([]);
});
test('streams clone failure without leaking subprocess output or registering', async () => {
  const { text, register } = await startStream({ failure: true });
  expect(text).toContain('event: failed'); expect(text).not.toContain('event: ready'); expect(register).not.toHaveBeenCalled();
});
test('imported projects cannot execute tests or a repair through backend entry points', async () => {
  const { LocalFileDatabaseAdapter } = await import('../../dist/db/local-adapter.js');
  const { DevGuardianBackend } = await import('../../dist/server/application.js');
  const repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
  const backend = await DevGuardianBackend.create({ repository, workspaceRoots: [root], runners: [] });
  try {
    const repoPath = path.join(root, '.devguardian-imports', randomUUID());
    await mkdir(repoPath, { recursive: true });
    const project = await backend.persistence.registerProject({ name: 'Imported', repoPath, defaultBranch: 'main', runnerType: 'jest' });
    const invoke = jest.fn();
    expect(await backend.withToolAudit('run_tests', { projectId: project.id }, invoke)).toMatchObject({ ok: false });
    expect(invoke).not.toHaveBeenCalled();
    await expect(backend.runAudit({ projectId: project.id, mode: 'repair', repair: {
      path: 'src/app.js', slug: 'external', message: 'fix', runner: 'jest', targets: ['tests/app.test.js'],
      expectedFileHashes: { 'src/app.js': 'a'.repeat(64) }, unifiedDiff: '+change',
    } })).rejects.toThrow('análisis estático');
  } finally { await backend.close(); }
});
test('real HTTP route enforces authentication and URL validation before SSE begins', async () => {
  const { LocalFileDatabaseAdapter } = await import('../../dist/db/local-adapter.js');
  const { startHttpServer } = await import('../../dist/server/http.js');
  const repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
  const app = await startHttpServer({ repository, workspaceRoots: [root], runners: [], apiToken: 'test-token', port: 0, host: '127.0.0.1', logger: () => {} });
  try {
    const endpoint = `${app.url}/api/projects/import`;
    const unauthorized = await fetch(endpoint, { method: 'POST' });
    expect(unauthorized.status).toBe(401);
    const invalid = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'file:///etc/passwd' }) });
    expect(invalid.status).toBe(422);
    expect(invalid.headers.get('Content-Type')).toContain('application/json');
    expect(execute).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
