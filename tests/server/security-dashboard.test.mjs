import { expect, test } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startHttpServer } from '../../dist/server/http.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/local-adapter.js';

test('filters persisted blocks before pagination and preserves authorization and existing log queries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'devguardian-security-dashboard-'));
  let app;
  try {
    const repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
    app = await startHttpServer({ repository, workspaceRoots: [root], runners: [], apiToken: 'security-test', host: '127.0.0.1', port: 0, logger: () => {} });
    const project = await app.backend.persistence.registerProject({ name: 'Security dashboard', repoPath: root, defaultBranch: 'main', runnerType: 'jest' });
    const first = await app.backend.evaluateHook({ projectId: project.id, files: ['.env'], unifiedDiff: '+EXAMPLE=blocked' });
    await app.backend.evaluateHook({ projectId: project.id, files: ['src/allowed.ts'], unifiedDiff: '+export const value = 1;' });
    const last = await app.backend.evaluateHook({ projectId: project.id, files: ['.env.local'], unifiedDiff: '+EXAMPLE=blocked' });
    const url = `${app.url}/api/hooks/logs?projectId=${project.id}`;
    const headers = { Authorization: 'Bearer security-test' };
    expect((await fetch(url + '&decision=block', { headers: {} })).status).toBe(401);
    const get = async (extra) => { const response = await fetch(url + extra, { headers }); expect(response.status).toBe(200); return (await response.json()).data; };
    const blocks = await get('&decision=block&limit=1&offset=0');
    expect(blocks).toHaveLength(1); expect(blocks[0]).toMatchObject({ decision: 'block', auditId: last.auditId, reason: 'Protected file: .env.local' });
    expect((await get('&decision=block&limit=1&offset=1'))[0]).toMatchObject({ decision: 'block', auditId: first.auditId });
    expect((await get('')).some((log) => log.decision === 'allow')).toBe(true);
    expect((await get(`&decision=block&auditId=${last.auditId}`)).every((log) => log.decision === 'block')).toBe(true);
    expect((await fetch(url + '&decision=unknown', { headers })).status).toBe(422);
    expect((await fetch(`${app.url}/api/audits?decision=block`, { headers })).status).toBe(422);
  } finally { await app?.close(); await rm(root, { recursive: true, force: true }); }
});
