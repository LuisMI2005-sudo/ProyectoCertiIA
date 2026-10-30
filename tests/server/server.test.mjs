import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startHttpServer } from '../../dist/server/index.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/index.js';

jest.setTimeout(120000);
const execute = promisify(execFile);
const original = 'export const add = (a: number, b: number): number => String(a - b);\n';
const fixed = 'export const add = (a: number, b: number): number => a + b;\n';
const sha = (text) => createHash('sha256').update(text).digest('hex');
let root, workspace, database, app, logs, runner, projectId;
const git = async (...args) => (await execute('git', args, { cwd: workspace, timeout: 15000, windowsHide: true })).stdout.trim();
const repair = (content = fixed) => ({ projectId, mode: 'repair', repair: { path: 'src/bug.ts', slug: 'http-repair', message: 'Repair verified through HTTP',
  runner: 'jest', targets: ['tests/bug.test.cjs'], expectedFileHashes: { 'src/bug.ts': sha(original) },
  unifiedDiff: ['diff --git a/src/bug.ts b/src/bug.ts', '--- a/src/bug.ts', '+++ b/src/bug.ts', '@@ -1 +1 @@', `-${original.trimEnd()}`, `+${content.trimEnd()}`, ''].join('\n') } });
async function request(endpoint, body, headers = {}) {
  const response = await fetch(app.url + endpoint, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(110000) });
  return { response, body: await response.json() };
}
const rpc = (method, params = {}, id = 1) => request('/api/mcp', { jsonrpc: '2.0', id, method, params });
const tool = (name, args) => rpc('tools/call', { name, arguments: args });
const toolData = (reply) => { expect(reply.body.result?.isError).toBe(false); return reply.body.result.structuredContent.data; };
async function start(extra = {}) {
  const repository = await LocalFileDatabaseAdapter.create({ filePath: database });
  return startHttpServer({ repository, port: 0, host: '127.0.0.1', workspaceRoots: [root], runners: [runner], logger: (entry) => logs.push(entry), ...extra });
}
async function register() {
  const result = await request('/api/projects', { name: 'HTTP fixture', repoPath: workspace, defaultBranch: 'main', runnerType: 'jest' });
  expect(result.response.status).toBe(201); projectId = result.body.data.id; return result.body.data;
}
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devguardian-http-test-')); workspace = path.join(root, 'workspace'); database = path.join(root, 'db.json'); logs = [];
  await mkdir(path.join(workspace, 'src'), { recursive: true }); await mkdir(path.join(workspace, 'tests'));
  await writeFile(path.join(workspace, 'src/bug.ts'), original);
  await writeFile(path.join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
  const config = path.join(workspace, 'jest.config.cjs');
  await writeFile(config, "module.exports={testEnvironment:'node',testMatch:['**/bug.test.cjs'],transform:{},cache:false};\n");
  const ts = fileURLToPath(new URL('../../node_modules/typescript/lib/typescript.js', import.meta.url));
  await writeFile(path.join(workspace, 'tests/bug.test.cjs'), [
    "const fs=require('node:fs'),vm=require('node:vm');", `const ts=require(${JSON.stringify(ts)});`,
    "const compiled=ts.transpileModule(fs.readFileSync('src/bug.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;",
    "const loaded={exports:{}};vm.runInNewContext(compiled,{module:loaded,exports:loaded.exports});const add=loaded.exports.add;",
    "test('repairs addition',()=>expect(add(2,1)).toBe(3));", "test('preserves existing',()=>expect(Number(add(2,0))).toBe(2));", ''
  ].join('\n'));
  await git('init', '-b', 'main'); await git('config', 'user.name', 'HTTP Tests'); await git('config', 'user.email', 'http@devguardian.invalid');
  await git('config', 'core.autocrlf', 'false'); await git('config', 'commit.gpgsign', 'false'); await git('add', '.'); await git('commit', '-m', 'HTTP fixture baseline');
  runner = { runner: 'jest', executable: process.execPath,
    args: [fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url)), '--config', config, '--runInBand'], timeoutMs: 30000, maxOutputBytes: 100000 };
  app = await start();
});
afterEach(async () => { await app?.close(); app = undefined; await rm(root, { recursive: true, force: true }); });

describe('HTTP contracts, controls and health', () => {
  test('public isolation policy blocks host execution before a repair begins', async () => {
    await app.close(); app = await start({ requireSandbox: true });
    await register();
    const health = await request('/api/health');
    expect(health.body.data.capabilities).toEqual({ isolatedTests: false, requiresIsolation: true });
    const denied = await request('/api/audits/run', repair());
    expect(denied.response.status).toBe(403);
    expect((await request('/api/audits')).body.data).toEqual([]);
    const blocked = await tool('run_tests', { projectId, runner: 'jest', targets: ['tests/bug.test.cjs'] });
    expect(blocked.body.result.isError).toBe(true);
    expect(await git('branch', '--show-current')).toBe('main');
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original);
  });
  test('cloud demo is opt-in and rejects caller-controlled paths and commands', async () => {
    expect((await request('/api/demo/prepare', {})).response.status).toBe(404);
    await app.close(); app = await start({ demoEnabled: true });
    expect((await request('/api/demo/prepare', { repoPath: '../outside', command: 'ignored' })).response.status).toBe(422);
    expect((await request('/api/projects')).body.data).toEqual([]);
  });
  test('prepares a real isolated cloud demo, consumes workers, commits and recovers its evidence', async () => {
    await app.close();
    app = await start({ demoEnabled: true, runners: [{ runner: 'jest', executable: process.execPath,
      args: [fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url)), '--runInBand'],
      timeoutMs: 30000, maxOutputBytes: 100000 }] });
    const prepared = await request('/api/demo/prepare', {});
    expect(prepared.response.status).toBe(201);
    const demo = prepared.body.data;
    expect(demo.project.defaultBranch).toBe('Dev');
    expect(demo.project.repoPath).not.toBe(workspace);
    const sourcePath = path.join(demo.project.repoPath, demo.repair.path);
    expect(sha(await readFile(sourcePath, 'utf8'))).toBe(demo.repair.expectedFileHashes[demo.repair.path]);
    const diagnosed = await request('/api/audits/run', { projectId: demo.project.id, mode: 'diagnose', path: demo.repair.path });
    expect(diagnosed.body.data.audit.summaryJson.outcome).toBe('diagnosed');
    expect(diagnosed.body.data.delegations[0]).toMatchObject({ role: 'diagnostic', status: 'completed', consumptionStatus: 'diagnosis_only' });
    const repaired = await request('/api/audits/run', { projectId: demo.project.id, mode: 'repair', repair: demo.repair });
    expect(repaired.body.data.audit.status).toBe('committed');
    expect(repaired.body.data.testRuns).toHaveLength(2);
    expect(repaired.body.data.testRuns.some(run => run.status === 'failed' && run.complete)).toBe(true);
    expect(repaired.body.data.testRuns.some(run => run.status === 'passed' && run.complete && run.summary.passed === 2)).toBe(true);
    expect(repaired.body.data.delegations.some(entry => entry.consumptionStatus === 'committed')).toBe(true);
    expect((await request('/api/audits/' + repaired.body.data.audit.id)).body.data.audit.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect((await readFile(path.join(workspace, 'src/bug.ts'), 'utf8'))).toBe(original);
    const again = await request('/api/demo/prepare', {});
    expect(again.body.data.project.id).not.toBe(demo.project.id);
    expect(sha(await readFile(path.join(again.body.data.project.repoPath, again.body.data.repair.path), 'utf8')))
      .toBe(again.body.data.repair.expectedFileHashes[again.body.data.repair.path]);
  });
  test.each(['/health', '/api/health'])('%s reports a live database, version, uptime, table count and real runner availability', async (endpoint) => {
    const reply = await request(endpoint);
    expect(reply.response.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: true, data: { status: 'ok', database: { connected: true, mode: 'local', tables: 5 }, version: '0.1.0',
      runners: [{ runner: 'jest', available: true }] } });
    expect(reply.body.data.uptimeSeconds).toBeGreaterThan(0); expect(reply.response.headers.get('x-request-id')).toBeTruthy();
  });
  test('registers and lists validated projects without exposing internal system projects', async () => {
    const saved = await register(); const reply = await request('/api/projects');
    expect(reply.body.data).toEqual([saved]); expect(await git('status', '--porcelain')).toBe('');
  });
  test('rejects workspaces outside trusted roots', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'devguardian-http-outside-'));
    try {
      const reply = await request('/api/projects', { name: 'Outside', repoPath: outside, defaultBranch: 'main', runnerType: 'jest' });
      expect(reply.response.status).toBe(403); expect((await request('/api/projects')).body.data).toEqual([]);
    } finally { await rm(outside, { recursive: true, force: true }); }
  });
  test('rejects a directory which is not an exact Git root', async () => {
    const reply = await request('/api/projects', { name: 'Not a Git root', repoPath: root, defaultBranch: 'main', runnerType: 'jest' });
    expect(reply.response.status).toBe(422);
  });
  test.each([
    { name: 'Invalid', repoPath: '../escape', defaultBranch: 'main', runnerType: 'jest' },
    { name: 'Invalid', repoPath: 'relative', defaultBranch: 'main', runnerType: 'shell' }
  ])('validates project input %j', async (body) => {
    expect((await request('/api/projects', body)).response.status).toBe(422);
  });
  test('handles missing resources, unknown routes and unsupported methods', async () => {
    expect((await request('/missing')).response.status).toBe(404);
    expect((await request('/api/audits/' + randomUUID())).response.status).toBe(404);
    expect((await request('/api/audits/invalid-id')).response.status).toBe(422);
    const response = await fetch(app.url + '/api/projects', { method: 'DELETE' });
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toContain('GET'); await response.json();
  });
  test('returns degraded health when storage is unavailable without leaking errors', async () => {
    await app.backend.repository.close(); const reply = await request('/api/health');
    expect(reply.response.status).toBe(503); expect(reply.body.data.database.connected).toBe(false);
    expect(JSON.stringify(reply.body)).not.toContain('stack');
  });
  test('serves configured CORS, rejects other origins and handles preflight', async () => {
    await app.close(); app = await start({ allowedOrigin: 'https://dashboard.example' });
    const allowed = await request('/api/health', undefined, { Origin: 'https://dashboard.example' });
    expect(allowed.response.headers.get('access-control-allow-origin')).toBe('https://dashboard.example');
    expect((await request('/api/health', undefined, { Origin: 'https://other.example' })).response.status).toBe(403);
    const preflight = await fetch(app.url + '/api/projects', { method: 'OPTIONS', headers: { Origin: 'https://dashboard.example', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.status).toBe(204); expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization');
  });
  test('supports bearer authentication while keeping health public and logs free of credentials', async () => {
    await app.close(); const token = 'fixture-access-value'; app = await start({ apiToken: token });
    expect((await request('/api/health')).response.status).toBe(200);
    expect((await request('/api/projects')).response.status).toBe(401);
    expect((await request('/api/projects', undefined, { Authorization: 'Bearer wrong' })).response.status).toBe(401);
    expect((await request('/api/projects', undefined, { Authorization: 'Bearer ' + token })).response.status).toBe(200);
    expect(JSON.stringify(logs)).not.toContain(token); expect(logs.every((entry) => entry.requestId && entry.method && entry.durationMs >= 0)).toBe(true);
  });
  test('bounds bodies and rejects wrong content types and malformed JSON', async () => {
    await app.close(); app = await start({ maxBodyBytes: 512 });
    const oversized = await fetch(app.url + '/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'x'.repeat(1000) }) });
    expect(oversized.status).toBe(413); await oversized.json();
    const bad = await fetch(app.url + '/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    expect(bad.status).toBe(400); await bad.json();
    const content = await fetch(app.url + '/api/projects', { method: 'POST', body: '{}' });
    expect(content.status).toBe(415); await content.json();
  });
  test('rejects duplicate/unknown query parameters and invalid pagination', async () => {
    for (const query of ['?limit=0', '?limit=1&limit=2', '?unknown=value', '?projectId=bad']) expect((await request('/api/audits' + query)).response.status).toBe(422);
  });
});

describe('REST orchestration, durable state and hook demonstrations', () => {
  test('runs real AST -> subagents -> baseline -> patch -> Jest -> hooks -> commit and survives a server restart', async () => {
    await register(); const initial = await git('rev-parse', 'HEAD');
    const reply = await request('/api/audits/run', repair());
    expect(reply.response.status).toBe(200); expect(reply.body.data.status).toBe('committed');
    const details = reply.body.data; const id = details.audit.id;
    expect(details.result.commit.commit).not.toBe(initial); expect(await git('rev-parse', 'HEAD')).toBe(details.result.commit.commit);
    expect(details.testRuns.map((row) => row.status).sort()).toEqual(['failed', 'passed']);
    expect(details.delegations).toHaveLength(3); expect(details.hookLogs.some((row) => row.event === 'pre:git_commit')).toBe(true);
    expect(details.audit.summaryJson.findings.length).toBeGreaterThan(0); expect(details.audit.summaryJson.attempts).toHaveLength(1);
    const recovered = (await request('/api/audits/' + id)).body.data;
    await app.close(); app = await start();
    expect((await request('/api/audits/' + id)).body.data).toEqual(recovered);
    expect((await request('/api/audits?projectId=' + projectId)).body.data).toEqual([recovered]);
    const delegations = (await request('/api/subagents/delegations?auditId=' + id)).body.data;
    expect(delegations).toHaveLength(3); expect(delegations.every((row) => row.consumptionStatus && row.snapshots.length >= 3)).toBe(true);
  });
  test('rolls a real regression back without changing HEAD', async () => {
    await register(); const initial = await git('rev-parse', 'HEAD');
    const reply = await request('/api/audits/run', repair('export const add = (a: number, b: number): number => a * b;\n'));
    expect(reply.body.data.status).toBe('rolled_back'); expect(await git('rev-parse', 'HEAD')).toBe(initial);
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original);
    expect(reply.body.data.testRuns).toHaveLength(2);
  });
  test('blocks a secret-bearing repair and exposes the persisted guardrail decision', async () => {
    await register(); const initial = await git('rev-parse', 'HEAD');
    const reply = await request('/api/audits/run', repair(fixed.trimEnd() + ' // SECRET_KEY=example\n'));
    expect(reply.body.data.status).toBe('blocked'); expect(reply.body.data.audit.status).toBe('rolled_back');
    expect(await git('rev-parse', 'HEAD')).toBe(initial);
    const history = await request('/api/hooks/logs?auditId=' + reply.body.data.audit.id);
    expect(history.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'block' })]));
    expect(await readFile(database, 'utf8')).not.toContain('SECRET_KEY=example');
  });
  test('evaluates allowed and blocked hooks live without modifying files', async () => {
    await register(); const initial = await git('rev-parse', 'HEAD');
    const allowed = await request('/api/hooks/evaluate', { projectId, files: ['src/bug.ts'], unifiedDiff: '+export const n=1;' });
    expect(allowed.response.status).toBe(200); expect(allowed.body.data.decision).toBe('allow');
    const blocked = await request('/api/hooks/evaluate', { projectId, files: ['.env'], unifiedDiff: '+example' });
    expect(blocked.response.status).toBe(403); expect(blocked.body.data.decision).toBe('block');
    expect((await request('/api/hooks/logs?auditId=' + blocked.body.data.auditId)).body.data.some((row) => row.decision === 'block')).toBe(true);
    expect((await request('/api/hooks/config')).body.data.protectedFiles).toContain('.env'); expect(await git('rev-parse', 'HEAD')).toBe(initial);
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original);
  });
  test('supports diagnosis-only mode with a consumed real delegation and no mutations', async () => {
    await register(); const initial = await git('rev-parse', 'HEAD');
    const reply = await request('/api/audits/run', { projectId, mode: 'diagnose', path: 'src/bug.ts' });
    expect(reply.body.data.audit.summaryJson.outcome).toBe('diagnosed'); expect(reply.body.data.delegations).toHaveLength(1);
    expect(reply.body.data.delegations[0].consumptionStatus).toBe('diagnosis_only'); expect(await git('rev-parse', 'HEAD')).toBe(initial);
  });
  test('rejects arbitrary commands, invalid modes, traversal and missing projects', async () => {
    await register();
    for (const input of [{ projectId, mode: 'shell', command: 'anything' }, { projectId, mode: 'diagnose', path: '../outside' },
      { ...repair(), command: 'anything' }]) expect((await request('/api/audits/run', input)).response.status).toBe(422);
    expect((await request('/api/audits/run', { projectId: randomUUID(), mode: 'diagnose', path: 'src/bug.ts' })).response.status).toBe(404);
  });
});

describe('MCP over JSON HTTP and stdio', () => {
  test('negotiates initialization and discovers the twelve tools, rollback alias and persistent queries', async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'defense', version: '1.0.0' } });
    expect(init.body.result.serverInfo.name).toBe('devguardian');
    const listed = await rpc('tools/list'); const names = listed.body.result.tools.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(['analyze_code', 'read_file_context', 'get_symbol_context', 'git_status', 'git_create_fix_branch', 'git_begin_attempt',
      'git_apply_patch', 'git_diff', 'git_commit_fix', 'git_rollback_attempt', 'git_rollback', 'run_tests', 'compare_test_runs',
      'hooks_get_logs', 'hooks_get_config', 'subagents_get_delegations', 'db_list_projects', 'db_list_audits', 'db_get_audit']));
    expect(listed.body.result.tools.find((entry) => entry.name === 'analyze_code').inputSchema.required).toContain('projectId');
  });
  test('runs a validated real diagnosis through tools/call and persists pre/post hooks', async () => {
    await register(); const diagnostic = toolData(await tool('analyze_code', { projectId, paths: ['src/bug.ts'], checks: ['semantic', 'lint'] }));
    expect(diagnostic.diagnostics.some((entry) => entry.source === 'typescript')).toBe(true);
    const source = toolData(await tool('read_file_context', { projectId, path: 'src/bug.ts' })); expect(source.fileHash).toBe(sha(original));
    const logs = (await request('/api/hooks/logs?projectId=' + projectId)).body.data;
    expect(logs.map((entry) => entry.event)).toEqual(expect.arrayContaining(['pre:tool_call', 'post:tool_call', 'pre:analyze']));
    expect(logs.some((entry) => entry.metadataJson.toolCall?.name === 'analyze_code')).toBe(true);
    expect((await request('/api/audits?projectId=' + projectId)).body.data.some((entry) => entry.audit.summaryJson.tool === 'analyze_code')).toBe(true);
  });
  test('exposes stored projects, audits, hooks and delegations as MCP queries', async () => {
    await register(); const demonstration = await request('/api/hooks/evaluate', { projectId, files: ['.env'], unifiedDiff: '+example' });
    const auditId = demonstration.body.data.auditId;
    expect(toolData(await tool('db_list_projects', {})).map((entry) => entry.id)).toContain(projectId);
    expect(toolData(await tool('db_get_audit', { projectId, auditId })).audit.id).toBe(auditId);
    expect(toolData(await tool('hooks_get_logs', { projectId, auditId })).some((entry) => entry.decision === 'block')).toBe(true);
    expect(toolData(await tool('hooks_get_config', { projectId })).protectedFiles).toContain('.env');
    expect(toolData(await tool('subagents_get_delegations', { projectId, auditId }))).toEqual([]);
    expect(toolData(await tool('db_list_audits', { projectId, auditId }))).toHaveLength(1);
  });
  test('preserves Git sessions between MCP requests and safely applies/diffs/rolls back', async () => {
    await register(); const expectedHead = await git('rev-parse', 'HEAD');
    const session = toolData(await tool('git_create_fix_branch', { projectId, slug: 'mcp', expectedHead }));
    const attempt = toolData(await tool('git_begin_attempt', { projectId, sessionId: session.sessionId }));
    const ids = { projectId, sessionId: session.sessionId, attemptId: attempt.attemptId };
    const applied = toolData(await tool('git_apply_patch', { ...ids, unifiedDiff: repair().repair.unifiedDiff, expectedFileHashes: { 'src/bug.ts': sha(original) } }));
    expect(applied.applied).toBe(true); expect(toolData(await tool('git_diff', ids)).changedFiles).toEqual(['src/bug.ts']);
    expect(toolData(await tool('git_rollback', ids)).clean).toBe(true);
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original); expect(await git('rev-parse', 'HEAD')).toBe(expectedHead);
  });
  test('runs and compares real MCP test runs, persists them and refuses a commit without evidence', async () => {
    await register(); const baseline = toolData(await tool('run_tests', { projectId, runner: 'jest', targets: ['tests/bug.test.cjs'] }));
    expect(baseline.status).toBe('failed');
    const another = toolData(await tool('run_tests', { projectId, runner: 'jest', targets: ['tests/bug.test.cjs'] }));
    expect(toolData(await tool('compare_test_runs', { projectId, baselineRunId: baseline.runId, candidateRunId: another.runId })).verdict).toBe('inconclusive');
    expect((await request('/api/audits?projectId=' + projectId)).body.data.flatMap((entry) => entry.testRuns)).toHaveLength(2);
    const denied = await tool('git_commit_fix', { projectId, sessionId: randomUUID(), attemptId: randomUUID(), message: 'Unverified', expectedDiffHash: 'a'.repeat(64), verificationRunId: randomUUID() });
    expect(denied.body.result.isError).toBe(true); expect(await git('branch', '--show-current')).toBe('main');
  });
  test('audits unknown names and invalid arguments and blocks secret-file reads', async () => {
    await register();
    expect((await tool('not_a_tool', { projectId })).body.result.isError).toBe(true);
    expect((await tool('analyze_code', { projectId, paths: ['src/bug.ts'], checks: ['semantic'], command: 'injected' })).body.result.isError).toBe(true);
    expect((await tool('read_file_context', { projectId, path: '.env' })).body.result.isError).toBe(true);
    const audits = (await request('/api/audits?projectId=' + projectId)).body.data;
    expect(audits).toHaveLength(3); expect(audits.every((entry) => entry.hookLogs.some((row) => row.event === 'pre:tool_call'))).toBe(true);
    expect(audits.flatMap((entry) => entry.hookLogs).some((row) => row.decision === 'block')).toBe(true);
    expect(await git('status', '--porcelain')).toBe('');
  });
  test('rejects invalid JSON-RPC envelopes and unknown methods; acknowledges notifications', async () => {
    const invalid = await request('/api/mcp', { jsonrpc: '1.0', id: 1, method: 'tools/list' }); expect(invalid.body.error.code).toBe(-32600);
    const unknown = await rpc('unknown_method'); expect(unknown.body.error.code).toBe(-32601);
    const response = await fetch(app.url + '/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    expect((await response.json()).error.code).toBe(-32700);
    const notification = await fetch(app.url + '/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    expect(notification.status).toBe(202);
  });
  test('interoperates with the official SDK HTTP client', async () => {
    await register(); const client = new Client({ name: 'integration', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(app.url + '/api/mcp')));
      expect((await client.listTools()).tools.some((entry) => entry.name === 'analyze_code')).toBe(true);
      const reply = await client.callTool({ name: 'read_file_context', arguments: { projectId, path: 'src/bug.ts' } });
      expect(reply.structuredContent.data.fileHash).toBe(sha(original));
    } finally { await client.close(); }
  });
  test('interoperates with official stdio transport and persists calls in the same database', async () => {
    await register(); const client = new Client({ name: 'stdio-integration', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [fileURLToPath(new URL('../../dist/mcp/index.js', import.meta.url))],
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)),
        DEVGUARDIAN_DB_MODE: 'local', DEVGUARDIAN_DB_PATH: database, DEVGUARDIAN_WORKSPACE_ROOT: root }, stderr: 'pipe' });
    try {
      await client.connect(transport); expect((await client.listTools()).tools.length).toBeGreaterThanOrEqual(12);
      const reply = await client.callTool({ name: 'analyze_code', arguments: { projectId, paths: ['src/bug.ts'], checks: ['semantic'] } });
      expect(reply.structuredContent.ok).toBe(true);
      expect((await request('/api/hooks/logs?projectId=' + projectId)).body.data.some((row) => row.event === 'pre:tool_call')).toBe(true);
    } finally { await client.close(); }
  });
});
