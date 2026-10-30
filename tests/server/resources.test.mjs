import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/index.js';
import { startHttpServer } from '../../dist/server/http.js';

jest.setTimeout(120000);
const execute = promisify(execFile);
let root, allowed, workspace, outside, repository, app, client, project, other, clients;
const token = randomUUID();
const uri = (kind, id = project.id) => `devguardian://project/${id}/${kind}`;
const analysisUri = (id, projectId = project.id) => `devguardian://analysis/${id}?projectId=${projectId}`;
const json = (resource) => JSON.parse(resource.contents[0].text);
async function connect() {
  const connection = new Client({ name: 'resources-acceptance', version: '1.0.0' });
  clients.push(connection);
  await connection.connect(new StreamableHTTPClientTransport(new URL('/api/mcp', app.url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } }
  }));
  return connection;
}
async function analyze() {
  const result = await client.callTool({ name: 'analyze_code', arguments: { projectId: project.id, paths: ['src/example.ts'], checks: ['syntax'] } });
  expect(result.structuredContent.error).toBeUndefined();
  expect(result.structuredContent.ok).toBe(true);
  return result.structuredContent.data;
}
beforeEach(async () => {
  clients = [];
  root = await mkdtemp(path.join(tmpdir(), 'devguardian-resources-'));
  allowed = path.join(root, 'allowed'); workspace = path.join(allowed, 'a'); outside = path.join(root, 'outside');
  for (const directory of [workspace, path.join(allowed, 'b'), outside]) {
    await mkdir(path.join(directory, 'src'), { recursive: true });
    await writeFile(path.join(directory, 'src/example.ts'), 'export const answer = 42;\n');
    await writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noLib: true, types: [] }, include: ['src'] }));
    await execute('git', ['init', '-b', 'main', directory], { windowsHide: true });
    await execute('git', ['-C', directory, 'add', '.'], { windowsHide: true });
    await execute('git', ['-C', directory, '-c', 'user.name=Resource Test', '-c', 'user.email=resources@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '-m', 'Resource fixture'], { windowsHide: true });
  }
  repository = await LocalFileDatabaseAdapter.create({ filePath: path.join(root, 'db.json') });
  app = await startHttpServer({ repository, workspaceRoots: [allowed], port: 0, host: '127.0.0.1', apiToken: token, logger: () => {},
    runners: [{ runner: 'jest', executable: process.execPath, args: ['--version'], timeoutMs: 1000, maxOutputBytes: 2048 }] });
  project = await app.backend.registerProject({ name: 'A', repoPath: workspace, defaultBranch: 'main', runnerType: 'jest' });
  other = await app.backend.registerProject({ name: 'B', repoPath: path.join(allowed, 'b'), defaultBranch: 'main', runnerType: 'jest' });
  client = await connect();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.allSettled(clients.map(connection => connection.close()));
  await app?.close();
  if (root) await rm(root, { recursive: true, force: true });
});

test('SDK discovers resources, templates and safe configuration without creating tool audits', async () => {
  expect(client.getServerCapabilities().resources).toEqual({});
  const catalog = await client.listResources();
  expect(catalog.resources).toHaveLength(4);
  expect(catalog.resources.map(entry => entry.uri)).toContain(uri('configuration'));
  const templates = await client.listResourceTemplates();
  expect(templates.resourceTemplates.map(entry => entry.uriTemplate)).toEqual([
    'devguardian://project/{projectId}/configuration', 'devguardian://project/{projectId}/structure',
    'devguardian://analysis/{analysisId}?projectId={projectId}'
  ]);
  const resource = await client.readResource({ uri: uri('configuration') });
  expect(resource.contents[0]).toMatchObject({ uri: uri('configuration'), mimeType: 'application/json' });
  expect(json(resource)).toEqual({ projectId: project.id, name: 'A', defaultBranch: 'main', runnerType: 'jest', serverVersion: '0.1.0' });
  expect(JSON.stringify({ catalog, resource, templates })).not.toContain(workspace);
  expect(await app.backend.audits()).toEqual([]);
});

test('structure omits synthetic secrets, Git metadata, dependencies and linked directories', async () => {
  for (const file of ['.env', 'credentials.json', 'token_fixture.txt', 'node_modules/dependency.ts']) {
    await mkdir(path.dirname(path.join(workspace, file)), { recursive: true });
    await writeFile(path.join(workspace, file), 'synthetic fixture only');
  }
  await symlink(outside, path.join(workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(json(await client.readResource({ uri: uri('structure') }))).toEqual({ projectId: project.id,
    files: [{ path: 'src/example.ts', analyzable: true }, { path: 'tsconfig.json', analyzable: false }], truncated: false });
});

test('analysis survives a new HTTP client and cannot cross project boundaries', async () => {
  const analysis = await analyze();
  const second = await connect();
  expect(json(await second.readResource({ uri: analysisUri(analysis.analysisId) }))).toEqual({ projectId: project.id, ...analysis });
  await expect(second.readResource({ uri: analysisUri(analysis.analysisId, other.id) })).rejects.toMatchObject({ code: -32002, data: { code: 'ANALYSIS_NOT_FOUND' } });
  expect(await app.backend.audits(project.id)).toHaveLength(1);
});

test('unknown and expired analysis IDs return typed resource-not-found', async () => {
  await expect(client.readResource({ uri: analysisUri(randomUUID()) })).rejects.toMatchObject({ code: -32002 });
  const analysis = await analyze();
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 300001);
  try {
    await expect(client.readResource({ uri: analysisUri(analysis.analysisId) })).rejects.toMatchObject({ code: -32002, data: { code: 'ANALYSIS_NOT_FOUND' } });
  } finally { clock.mockRestore(); }
});

test('evicted analysis is unavailable while the newest result remains readable', async () => {
  const first = await analyze();
  let latest;
  // Exercise the actual default capacity of 100 cached analyses via MCP tools.
  for (let i = 0; i < 100; i++) latest = await analyze();
  await expect(client.readResource({ uri: analysisUri(first.analysisId) })).rejects.toMatchObject({ code: -32002 });
  expect(json(await client.readResource({ uri: analysisUri(latest.analysisId) })).analysisId).toBe(latest.analysisId);
});

test('unknown and out-of-root projects are hidden, including from discovery', async () => {
  const forbidden = { ...project, id: randomUUID(), repoPath: outside, name: 'Outside' };
  await repository.createProject(forbidden);
  expect((await client.listResources()).resources).toHaveLength(4);
  for (const id of [randomUUID(), forbidden.id]) {
    await expect(client.readResource({ uri: uri('configuration', id) })).rejects.toMatchObject({ code: -32002, data: { code: 'RESOURCE_NOT_FOUND' } });
  }
});

test('changed canonical workspace cannot redirect resource reads outside the trusted root', async () => {
  await rename(workspace, path.join(allowed, 'saved-a'));
  await symlink(outside, workspace, process.platform === 'win32' ? 'junction' : 'dir');
  for (const kind of ['configuration', 'structure']) {
    await expect(client.readResource({ uri: uri(kind) })).rejects.toMatchObject({ code: -32002, data: { code: 'RESOURCE_NOT_FOUND' } });
  }
});

test('missing checkout returns a safe unavailable error without an absolute path', async () => {
  await rename(workspace, path.join(allowed, 'saved-a'));
  await expect(client.readResource({ uri: uri('structure') })).rejects.toMatchObject({ code: -32002, data: { code: 'WORKSPACE_UNAVAILABLE' } });
});

test('rejects malformed IDs, root selection, encoded traversal and additional URI components', async () => {
  for (const invalid of ['file:///etc/passwd', uri('structure') + '?root=outside', uri('structure') + '#fragment',
    uri('structure') + '\n', uri('structure').replace(project.id, '%2e%2e'), uri('structure', 'invalid'),
    `devguardian://analysis/${randomUUID()}`, analysisUri(randomUUID()) + '&root=outside',
    analysisUri(randomUUID()).replace('?projectId=', '?projectId=../')]) {
    await expect(client.readResource({ uri: invalid })).rejects.toMatchObject({ code: -32602 });
  }
  await expect(client.listResources({ cursor: '../outside' })).rejects.toMatchObject({ code: -32602 });
  await expect(client.listResourceTemplates({ cursor: 'unsupported' })).rejects.toMatchObject({ code: -32602 });
});

test('catalog pagination has no duplicates or omissions and validates cursors', async () => {
  for (let i = 0; i < 24; i++) await repository.createProject({ ...project, id: randomUUID(), name: `Fixture ${i}` });
  const first = await client.listResources();
  expect(first.resources).toHaveLength(50);
  expect(first.nextCursor).toBeTruthy();
  const second = await client.listResources({ cursor: first.nextCursor });
  expect(second.resources).toHaveLength(2);
  expect(second.nextCursor).toBeUndefined();
  expect(new Set([...first.resources, ...second.resources].map(entry => entry.uri)).size).toBe(52);
  await expect(client.listResources({ cursor: analysisUri(randomUUID()) })).rejects.toMatchObject({ code: -32602 });
});

test('HTTP resource requests inherit bearer authentication', async () => {
  for (const credential of ['', 'Bearer invalid']) {
    const response = await fetch(app.url + '/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: credential },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: uri('configuration') } }) });
    expect(response.status).toBe(401);
  }
});

test('internal failures do not expose implementation paths in protocol errors', async () => {
  jest.spyOn(app.backend, 'projectResource').mockRejectedValue(new Error(`Failure inside ${workspace}`));
  try {
    await client.readResource({ uri: uri('configuration') });
    throw new Error('Expected a protocol error');
  } catch (error) {
    expect(error.code).toBe(-32603);
    expect(error.message).not.toContain(workspace);
    expect(error.data).toBeUndefined();
  }
});

test('stdio main entrypoint exposes and reads the same project resources', async () => {
  const connection = new Client({ name: 'stdio-resources-acceptance', version: '1.0.0' });
  clients.push(connection);
  await connection.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/mcp/index.js'],
    env: { ...process.env, DEVGUARDIAN_WORKSPACE_ROOT: allowed, DEVGUARDIAN_DB_MODE: 'local',
      DEVGUARDIAN_DB_PATH: path.join(root, 'db.json') }, stderr: 'pipe' }));
  expect((await connection.listResources()).resources).toHaveLength(4);
  expect(json(await connection.readResource({ uri: uri('configuration') })).projectId).toBe(project.id);
});
