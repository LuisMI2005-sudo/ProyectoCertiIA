import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const execute = jest.fn();
jest.unstable_mockModule('../../dist/test-runner/process.js', () => ({ runProcess: execute }));
const { startHttpServer } = await import('../../dist/server/http.js');
const { LocalFileDatabaseAdapter } = await import('../../dist/db/local-adapter.js');

const tree = (file, size = 30) => `100644 blob ${'a'.repeat(40)} ${size}\t${file}\0`;
const headers = { Authorization: 'Bearer reclone-token' };
let root, app, repository;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devguardian-reclone-test-'));
  execute.mockReset();
  repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
  app = await startHttpServer({ repository, workspaceRoots: [root], runners: [], apiToken: 'reclone-token', port: 0, host: '127.0.0.1', logger: () => {} });
});
afterEach(async () => {
  if (app) { await app.close(); app = undefined; }
  await repository?.close(); repository = undefined;
  await rm(root, { recursive: true, force: true });
});

const reclone = (id) => fetch(`${app.url}/api/projects/${id}/reclone`, { method: 'POST', headers });

test('restores a missing workspace from its stored source URL without duplicating the project', async () => {
  execute.mockImplementation(async (options) => {
    expect(options.env.DATABASE_URL).toBeUndefined();
    expect(options.args).toContain('credential.helper=');
    let stdout = '';
    if (options.args.includes('clone')) {
      const destination = options.args.at(-1);
      await mkdir(path.join(destination, 'src'), { recursive: true });
      await writeFile(path.join(destination, 'package.json'), '{}');
      await writeFile(path.join(destination, 'src/app.js'), 'export const value = 1;');
    }
    if (options.args.includes('ls-tree')) stdout = tree('package.json') + tree('src/app.js');
    if (options.args.includes('rev-parse')) stdout = 'b'.repeat(40);
    if (options.args.includes('symbolic-ref')) stdout = 'main\n';
    return { exitCode: 0, stdout, truncated: false, timedOut: false, cancelled: false, spawnError: null };
  });
  const workspace = path.join(root, 'restored');
  await mkdir(workspace);
  const project = await app.backend.persistence.registerProject({ name: 'Restore', repoPath: workspace, defaultBranch: 'main',
    runnerType: 'jest', sourceUrl: 'https://github.com/team/project.git' });
  await rm(workspace, { recursive: true });

  const response = await reclone(project.id);

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, data: { status: 'cloned', branch: 'main', headCommit: 'b'.repeat(40),
    files: 2, project: { id: project.id, sourceUrl: 'https://github.com/team/project.git' } } });
  expect(await repository.listProjects()).toHaveLength(1);
  const files = await fetch(`${app.url}/api/projects/${project.id}/files`, { headers });
  expect(files.status).toBe(200);
  expect((await files.json()).data.files).toContainEqual({ path: 'src/app.js', analyzable: true });
});

test('refuses to guess a repository when no source URL was stored', async () => {
  const workspace = path.join(root, 'missing');
  await mkdir(workspace);
  const project = await app.backend.persistence.registerProject({ name: 'Legacy', repoPath: workspace,
    defaultBranch: 'main', runnerType: 'jest' });
  await rm(workspace, { recursive: true });

  const response = await reclone(project.id);

  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ ok: false, error: { code: 'WORKSPACE_UNAVAILABLE' } });
  expect(execute).not.toHaveBeenCalled();
});

test('never deletes an existing directory it does not manage', async () => {
  const workspace = path.join(root, 'unmanaged');
  await mkdir(workspace);
  await writeFile(path.join(workspace, 'notes.txt'), 'keep');
  const project = await app.backend.persistence.registerProject({ name: 'Unmanaged', repoPath: workspace, defaultBranch: 'main',
    runnerType: 'jest', sourceUrl: 'https://github.com/team/project.git' });

  const response = await reclone(project.id);

  expect(response.status).toBe(409);
  expect(await readFile(path.join(workspace, 'notes.txt'), 'utf8')).toBe('keep');
  expect(execute).not.toHaveBeenCalled();
});
