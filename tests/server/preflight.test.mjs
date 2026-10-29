import { expect, test } from '@jest/globals';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startHttpServer } from '../../dist/server/http.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/local-adapter.js';

test('missing workspace is a definitive rejection before an audit or repair starts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'devguardian-preflight-'));
  let app;
  try {
    const workspace = path.join(root, 'workspace'); await mkdir(workspace);
    const repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
    app = await startHttpServer({ repository, workspaceRoots: [root], runners: [], apiToken: '', host: '127.0.0.1', port: 0, logger: () => {} });
    const project = await app.backend.persistence.registerProject({ name: 'Expired workspace', repoPath: workspace, defaultBranch: 'main', runnerType: 'jest' });
    await rm(workspace, { recursive: true });
    const response = await fetch(`${app.url}/api/audits/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      projectId: project.id, mode: 'repair', repair: { path: 'src/value.ts', slug: 'test', message: 'fix', runner: 'jest', targets: ['tests/value.test.cjs'], unifiedDiff: '+fix', expectedFileHashes: { 'src/value.ts': 'a'.repeat(64) } },
    }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'WORKSPACE_UNAVAILABLE' } });
    expect(await repository.listAuditSessions(project.id)).toEqual([]);
  } finally { await app?.close(); await rm(root, { recursive: true, force: true }); }
});
