import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  AuditPersistenceService, createDatabaseRepository, DatabaseHookPersistenceAdapter, DatabaseDelegationPersistenceAdapter,
  LocalFileDatabaseAdapter, PostgresDatabaseAdapter, loadSchemaSql, runMigrations
} from '../../dist/db/index.js';
import { createHookManager } from '../../dist/hooks/index.js';
import { DelegationStore } from '../../dist/subagents/store.js';

jest.setTimeout(120000);
const execute = promisify(execFile);
const moduleUrl = new URL('../../dist/db/index.js', import.meta.url).href;
const now = () => new Date().toISOString();
const project = (repoPath, name = 'Demo') => ({ id: randomUUID(), name, repoPath, defaultBranch: 'main', runnerType: 'jest', createdAt: now() });
const session = (projectId) => ({ id: randomUUID(), projectId, status: 'running', targetFile: 'src/bug.ts', branchName: null,
  baselineRunId: null, candidateRunId: null, commitSha: null, startedAt: now(), finishedAt: null, summaryJson: {} });
const run = (audit) => ({ runId: randomUUID(), projectId: audit.projectId, auditId: audit.id,
  runner: 'jest', status: 'passed', complete: true, exitCode: 0, durationMs: 1,
  workspaceStateHash: 'a'.repeat(64), configurationHash: 'b'.repeat(64),
  summary: { total: 1, passed: 1, failed: 0, skipped: 0, todo: 0 }, cases: [{ id: 'test::adds', name: 'adds', path: 'tests/bug.test.cjs',
    status: 'passed', durationMs: 1, failureMessage: null }], stdout: '', stderr: '', truncated: false, startedAt: now(), finishedAt: now() });
let root, database, repository;
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'devguardian-db-test-')); database = path.join(root, 'db.json'); });
afterEach(async () => { await repository?.close(); repository = undefined; await rm(root, { recursive: true, force: true }); });

describe('local durable repository and invariants', () => {
  beforeEach(async () => { repository = await LocalFileDatabaseAdapter.create({ filePath: database }); });
  test('creates, lists and reads projects and complete audit sessions', async () => {
    const saved = await repository.createProject(project(root));
    expect(await repository.getProject(saved.id)).toEqual(saved);
    expect(await repository.listProjects()).toEqual([saved]);
    const audit = await repository.createAuditSession(session(saved.id));
    const finished = { ...audit, status: 'blocked', finishedAt: now(), summaryJson: { reason: 'policy' } };
    expect(await repository.saveAuditSession(finished)).toEqual(finished);
    expect(await repository.listAuditSessions(saved.id)).toEqual([finished]);
    expect(await repository.getAuditSession(audit.id)).toEqual(finished);
    expect(await repository.getProject(randomUUID())).toBeNull();
  });
  test('keeps run fields and validates baseline/candidate relationships on closing', async () => {
    const saved = await repository.createProject(project(root));
    const audit = await repository.createAuditSession(session(saved.id));
    const baseline = { ...run(audit), status: 'failed', exitCode: 1, summary: { total: 1, passed: 0, failed: 1, skipped: 0, todo: 0 },
      cases: [{ ...run(audit).cases[0], status: 'failed', failureMessage: 'Expected sum' }] };
    const candidate = run(audit);
    await repository.saveTestRun(baseline); await repository.saveTestRun(candidate);
    const closed = await repository.saveAuditSession({ ...audit, status: 'committed', branchName: 'fix/demo', baselineRunId: baseline.runId,
      candidateRunId: candidate.runId, commitSha: 'c'.repeat(40), finishedAt: now() });
    expect(closed.status).toBe('committed');
    expect(await repository.getTestRun(baseline.runId)).toEqual(baseline);
    expect(await repository.listTestRuns(audit.id)).toHaveLength(2);
    await expect(repository.saveAuditSession({ ...closed, summaryJson: { changed: true } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('rejects duplicates, orphan records and cross-audit evidence without changing disk', async () => {
    const saved = await repository.createProject(project(root));
    const audit = await repository.createAuditSession(session(saved.id));
    const before = await readFile(database, 'utf8');
    await expect(repository.createProject(saved)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(repository.createAuditSession(session(randomUUID()))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(repository.saveTestRun({ ...run(audit), projectId: randomUUID() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(repository.saveAuditSession({ ...audit, baselineRunId: randomUUID() })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await readFile(database, 'utf8')).toBe(before);
  });
  test.each([
    ['invalid runner', { runnerType: 'shell' }], ['relative root', { repoPath: '../outside' }],
    ['unknown fields', { token: 'not-a-real-secret' }], ['invalid UUID', { id: '1' }]
  ])('rejects %s', async (_label, changes) => {
    await expect(repository.createProject({ ...project(root), ...changes })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('provides defensive copies and immutable runs', async () => {
    const saved = await repository.createProject(project(root));
    const audit = await repository.createAuditSession(session(saved.id)); const original = run(audit);
    await repository.saveTestRun(original);
    const copy = await repository.getTestRun(original.runId); copy.summary.passed = 50;
    expect((await repository.getTestRun(original.runId)).summary.passed).toBe(1);
    await expect(repository.saveTestRun({ ...original, durationMs: 5 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('serializes concurrent writers across separate repository instances', async () => {
    const other = await LocalFileDatabaseAdapter.create({ filePath: database });
    try {
      await Promise.all(Array.from({ length: 16 }, (_, i) => (i % 2 ? other : repository).createProject(project(root, `Project ${i}`))));
      expect(await repository.listProjects()).toHaveLength(16);
      expect(await other.listProjects()).toHaveLength(16);
    } finally { await other.close(); }
  });
  test('serializes independent Node processes writing the same file', async () => {
    const script = `const {LocalFileDatabaseAdapter}=await import(${JSON.stringify(moduleUrl)}); const db=await LocalFileDatabaseAdapter.create({filePath:process.argv[1]}); await db.createProject(JSON.parse(process.argv[2])); await db.close();`;
    const outcomes = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => execute(process.execPath,
      ['--input-type=module', '-e', script, database, JSON.stringify(project(root, `Child ${i}`))], { timeout: 20000 })));
    for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
    expect(await repository.listProjects()).toHaveLength(3);
  });
  test('times out on an abandoned lock without overwriting the file', async () => {
    await writeFile(`${database}.lock`, 'operator must inspect this lock');
    const before = await readFile(database, 'utf8');
    await expect(LocalFileDatabaseAdapter.create({ filePath: database, lockTimeoutMs: 30 })).rejects.toThrow('lock timed out');
    expect(await readFile(database, 'utf8')).toBe(before);
    await rm(`${database}.lock`);
  });
  test('preserves a corrupt database rather than silently replacing it', async () => {
    await repository.close(); await writeFile(database, '{not-json');
    await expect(LocalFileDatabaseAdapter.create({ filePath: database })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(await readFile(database, 'utf8')).toBe('{not-json');
  });
  test('rejects links, metadata directories and unexpected file types', async () => {
    const outside = path.join(root, 'outside.json'); await writeFile(outside, '{}');
    const hard = path.join(root, 'hard.json'); await link(outside, hard);
    await expect(LocalFileDatabaseAdapter.create({ filePath: hard })).rejects.toThrow();
    const parent = path.join(root, 'linked-parent');
    await symlink(root, parent, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(LocalFileDatabaseAdapter.create({ filePath: path.join(parent, 'db.json') })).rejects.toThrow();
    await expect(LocalFileDatabaseAdapter.create({ filePath: path.join(root, '.git', 'db.json') })).rejects.toThrow();
    const directory = path.join(root, 'directory.json'); await mkdir(directory);
    await expect(LocalFileDatabaseAdapter.create({ filePath: directory })).rejects.toThrow();
  });
  test('persists allowed, blocked and warning hooks idempotently', async () => {
    const saved = await repository.createProject(project(root)); const audit = await repository.createAuditSession(session(saved.id));
    const bridge = new DatabaseHookPersistenceAdapter(repository, audit.id); const hooks = createHookManager({}, bridge);
    expect(await hooks.trigger('pre:apply_patch', { files: ['src/bug.ts'], unifiedDiff: '+export const n=1;' })).toMatchObject({ ok: true });
    expect(await hooks.trigger('pre:apply_patch', { files: ['.env'], unifiedDiff: '+example' })).toMatchObject({ ok: false });
    hooks.register({ id: 'warning', name: 'Warning', events: ['pre:analyze'], execute: () => ({ decision: 'warn', reason: 'Review this finding.' }) });
    await hooks.trigger('pre:analyze', {});
    const decisions = (await repository.listHookLogs(audit.id)).map((row) => row.decision);
    expect(decisions).toEqual(expect.arrayContaining(['allow', 'block', 'warn']));
    const decision = hooks.getHookLogs()[0]; const before = (await repository.listHookLogs(audit.id)).length;
    await bridge.appendExecution(decision); await bridge.appendAudit(decision);
    expect(await repository.listHookLogs(audit.id)).toHaveLength(before);
  });
  test('rejects operations after close and reopens the same data', async () => {
    const saved = await repository.createProject(project(root)); await repository.close();
    await expect(repository.getProject(saved.id)).rejects.toThrow('closed');
    repository = await LocalFileDatabaseAdapter.create({ filePath: database });
    expect(await repository.getProject(saved.id)).toEqual(saved);
  });
  test('rejects active/terminal timestamp contradictions and new tests after closing', async () => {
    const p = await repository.createProject(project(root)); const audit = await repository.createAuditSession(session(p.id));
    await expect(repository.saveAuditSession({ ...audit, status: 'blocked' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await repository.saveAuditSession({ ...audit, status: 'blocked', finishedAt: now() });
    await expect(repository.saveTestRun(run(audit))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

// This mock validates SQL and parameters, not the PostgreSQL query planner or network/TLS.
function mockPool() {
  const rows = new Map(); const calls = []; let checksum; let backup;
  const key = (row) => row.id ?? row.runId ?? row.taskId;
  const jsonb = (value) => Array.isArray(value) ? value.map(jsonb)
    : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, jsonb(entry)])) : value;
  const camel = (field) => field.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
  const client = { release: jest.fn(), async query(sql, values = []) {
    calls.push({ sql, values: structuredClone(values) });
    if (sql === 'BEGIN') backup = structuredClone(rows);
    if (sql === 'ROLLBACK' && backup) { rows.clear(); for (const [name, map] of backup) rows.set(name, map); }
    if (sql.startsWith('SELECT checksum')) return { rows: checksum ? [{ checksum }] : [] };
    if (sql.startsWith('INSERT INTO devguardian_migrations')) { checksum = values[1]; return { rows: [] }; }
    const select = sql.match(/^SELECT record_json FROM (\w+)(?: WHERE (\w+) = \$1)?/);
    if (select) return { rows: [...(rows.get(select[1])?.values() ?? [])].filter((row) => !select[2] || row[camel(select[2])] === values[0]).map((row) => ({ record_json: jsonb(row) })) };
    const insert = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/);
    const update = sql.match(/^UPDATE (\w+) SET (.+) WHERE/);
    if (insert || update) {
      const table = (insert ?? update)[1]; const index = insert ? insert[2].split(', ').indexOf('record_json') : update[2].split(', ').findIndex((field) => field.startsWith('record_json ='));
      const record = JSON.parse(values[index]);
      if (!rows.has(table)) rows.set(table, new Map());
      rows.get(table).set(key(record), record);
      const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      expect(Math.max(...placeholders)).toBe(values.length);
    }
    return { rows: [] };
  } };
  return { calls, client, connect: jest.fn(async () => client), end: jest.fn(async () => {}) };
}

describe('schema, migrations and parameterized PostgreSQL', () => {
  test('ships SQL containing all five tables, FKs, checks and indexes', async () => {
    const sql = await loadSchemaSql();
    for (const table of ['projects', 'audit_sessions', 'test_runs', 'hook_logs', 'subagent_delegations']) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    for (const column of ['repo_path', 'baseline_run_id', 'candidate_run_id', 'workspace_state_hash', 'configuration_hash', 'scoped_context_json', 'consumption_status']) expect(sql).toContain(column);
    expect(sql).toContain('FOREIGN KEY (audit_id, project_id)'); expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
    expect(sql).toContain("'committed', 'rolled_back', 'blocked', 'failed'");
  });
  test('applies a versioned schema once and releases the same transactional client', async () => {
    const pool = mockPool(); await runMigrations(pool); await runMigrations(pool);
    expect(pool.calls.filter((entry) => entry.sql.includes('CREATE TABLE IF NOT EXISTS projects'))).toHaveLength(1);
    expect(pool.calls.filter((entry) => entry.sql === 'COMMIT')).toHaveLength(2);
    expect(pool.client.release).toHaveBeenCalledTimes(2);
  });
  test('rolls migrations back on failure without leaking driver details', async () => {
    const pool = mockPool(); const query = pool.client.query;
    pool.client.query = async (sql, values) => { if (sql.includes('CREATE TABLE IF NOT EXISTS projects')) throw new Error('postgresql://user:private@host/db'); return query(sql, values); };
    await expect(runMigrations(pool)).rejects.toThrow('migration failed');
    expect(pool.calls.at(-1).sql).toBe('ROLLBACK'); expect(pool.client.release).toHaveBeenCalledTimes(1);
  });
  test('rejects modified checksums instead of accepting a rewritten migration', async () => {
    const pool = mockPool(); const query = pool.client.query;
    pool.client.query = async (sql, values) => sql.startsWith('SELECT checksum') ? { rows: [{ checksum: 'changed' }] } : query(sql, values);
    await expect(runMigrations(pool)).rejects.toThrow('migration failed');
    expect(pool.calls.at(-1).sql).toBe('ROLLBACK');
  });
  test('performs INSERT, SELECT and UPDATE with positional parameters and matching JSON', async () => {
    const pool = mockPool(); repository = await PostgresDatabaseAdapter.create({ pool });
    const payload = "Demo'); DROP TABLE projects; --";
    const saved = await repository.createProject(project(root, payload)); const audit = await repository.createAuditSession(session(saved.id));
    expect(await repository.getProject(saved.id)).toEqual(saved);
    expect(await repository.listProjects()).toEqual([saved]);
    await repository.saveTestRun(run(audit)); expect(await repository.listTestRuns(audit.id)).toHaveLength(1);
    await repository.saveAuditSession({ ...audit, status: 'blocked', finishedAt: now() });
    const hooks = createHookManager({}, new DatabaseHookPersistenceAdapter(repository, audit.id)); await hooks.trigger('pre:analyze', {});
    expect(await repository.listHookLogs(audit.id)).not.toHaveLength(0);
    expect(pool.calls.some((entry) => entry.sql.startsWith('UPDATE audit_sessions SET'))).toBe(true);
    const insert = pool.calls.find((entry) => entry.sql.startsWith('INSERT INTO projects'));
    expect(insert.sql).not.toContain(payload); expect(insert.values).toContain(payload);
    expect(pool.calls.some((entry) => entry.sql.startsWith('SELECT record_json FROM projects WHERE id = $1') && entry.values[0] === saved.id)).toBe(true);
    expect(pool.calls.filter((entry) => entry.sql.includes('pg_advisory_xact_lock(714219871)')).length).toBeGreaterThan(0);
    await expect(repository.createProject(saved)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(pool.calls.at(-1).sql).toBe('ROLLBACK');
  });
  test('sanitizes connection errors and disposes failed pools', async () => {
    const pool = mockPool(); pool.connect.mockRejectedValue(new Error('DATABASE_URL=postgresql://admin:private@cloud/db'));
    await expect(PostgresDatabaseAdapter.create({ pool })).rejects.toThrow('Cannot initialize PostgreSQL');
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
  test('persists delegation return and multiple consumptions without losing or rewriting the journal', async () => {
    const pool = mockPool(); repository = await PostgresDatabaseAdapter.create({ pool });
    const p = await repository.createProject(project(root)); const audit = await repository.createAuditSession(session(p.id));
    const store = new DelegationStore(new DatabaseDelegationPersistenceAdapter(repository)); const taskId = randomUUID();
    const id = await store.start(randomUUID(), { taskId, parentSessionId: audit.id, role: 'diagnostic', objective: 'Inspect one source file',
      scopedContext: { path: 'src/bug.ts' }, allowedTools: ['analyze_code', 'read_file_context'], budget: { maxToolCalls: 2, timeoutMs: 10000 } });
    await store.returned(id, { taskId, subagentId: randomUUID(), role: 'diagnostic', status: 'failed', output: null, reason: 'Deliberate failure',
      toolCallsExecuted: [], startedAt: now(), finishedAt: now(), durationMs: 1, workerThreadId: null });
    await store.consume(taskId, 'stop', 'Failure prevents mutation'); await store.consume(taskId, 'recovered', 'Audit reviewed');
    const saved = await repository.getDelegation(taskId);
    expect(saved).toMatchObject({ phase: 'consumed', status: 'failed', consumptionStatus: 'recovered' });
    expect(saved.snapshots).toHaveLength(4); expect(await repository.listDelegations(audit.id)).toEqual([saved]);
    await new DatabaseDelegationPersistenceAdapter(repository).append(store.getDelegationLogs().at(-1));
    expect((await repository.getDelegation(taskId)).snapshots).toHaveLength(4);
    await expect(repository.saveDelegation({ ...saved, snapshots: [{ forged: true }, ...saved.snapshots.slice(1)] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(pool.calls.some((entry) => entry.sql.startsWith('UPDATE subagent_delegations SET'))).toBe(true);
  });
  test.each(['https://example.org/db', 'bad-url'])('rejects invalid connection string %s', async (connectionString) => {
    await expect(PostgresDatabaseAdapter.create({ connectionString })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('factory selects local by default or explicitly even with DATABASE_URL', async () => {
    repository = await createDatabaseRepository({ baseDirectory: root, environment: { DEVGUARDIAN_DB_PATH: 'factory.json' } });
    expect(repository).toBeInstanceOf(LocalFileDatabaseAdapter); await repository.close();
    repository = await createDatabaseRepository({ baseDirectory: root, environment: { DEVGUARDIAN_DB_MODE: 'local', DATABASE_URL: 'not-a-url', DEVGUARDIAN_DB_PATH: 'forced.json' } });
    expect(repository).toBeInstanceOf(LocalFileDatabaseAdapter);
  });
  test('factory selects PostgreSQL by URL and supports the DB_MODE compatibility alias', async () => {
    const pool = mockPool();
    repository = await createDatabaseRepository({ postgresPool: pool, environment: { DATABASE_URL: 'postgresql://example:example@localhost/test' } });
    expect(repository).toBeInstanceOf(PostgresDatabaseAdapter); await repository.close();
    repository = await createDatabaseRepository({ baseDirectory: root, environment: { DB_MODE: 'local', DATABASE_URL: 'ignored', DEVGUARDIAN_DB_PATH: 'alias.json' } });
    expect(repository).toBeInstanceOf(LocalFileDatabaseAdapter);
  });
  test.each([{ DEVGUARDIAN_DB_MODE: 'unknown' }, { DEVGUARDIAN_DB_MODE: 'postgres' }])('rejects invalid factory configuration %j', async (environment) => {
    await expect(createDatabaseRepository({ environment })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('real coordinated repairs and restart durability', () => {
  const original = 'export const add = (a: number, b: number): number => String(a - b);\n';
  const fixed = 'export const add = (a: number, b: number): number => a + b;\n';
  async function fixture() {
    const workspace = path.join(root, 'workspace'); await mkdir(path.join(workspace, 'src'), { recursive: true }); await mkdir(path.join(workspace, 'tests'));
    await writeFile(path.join(workspace, 'src/bug.ts'), original);
    await writeFile(path.join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
    const config = path.join(workspace, 'jest.config.cjs');
    await writeFile(config, "module.exports={testEnvironment:'node',testMatch:['**/bug.test.cjs'],transform:{},cache:false};\n");
    const ts = fileURLToPath(new URL('../../node_modules/typescript/lib/typescript.js', import.meta.url));
    await writeFile(path.join(workspace, 'tests/bug.test.cjs'), [
      "const fs=require('node:fs'), vm=require('node:vm');", `const ts=require(${JSON.stringify(ts)});`,
      "const compiled=ts.transpileModule(fs.readFileSync('src/bug.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;",
      "const loaded={exports:{}}; vm.runInNewContext(compiled,{module:loaded,exports:loaded.exports}); const add=loaded.exports.add;",
      "test('repairs addition',()=>expect(add(2,1)).toBe(3));", "test('preserves existing',()=>expect(Number(add(2,0))).toBe(2));", ''
    ].join('\n'));
    const git = async (...args) => (await execute('git', args, { cwd: workspace, timeout: 15000, windowsHide: true })).stdout.trim();
    await git('init', '-b', 'main'); await git('config', 'user.name', 'DB Tests'); await git('config', 'user.email', 'db@devguardian.invalid');
    await git('config', 'core.autocrlf', 'false'); await git('config', 'commit.gpgsign', 'false'); await git('add', '.'); await git('commit', '-m', 'Fixture baseline');
    repository = await LocalFileDatabaseAdapter.create({ filePath: database }); const service = new AuditPersistenceService(repository);
    const saved = await service.registerProject({ name: 'Persistent repair', repoPath: workspace, defaultBranch: 'main', runnerType: 'jest' });
    const args = [fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url)), '--config', config, '--runInBand'];
    const repair = (content = fixed) => ({ path: 'src/bug.ts', slug: 'persistent', message: 'Verified persisted repair',
      runner: 'jest', targets: ['tests/bug.test.cjs'], expectedFileHashes: { 'src/bug.ts': createHash('sha256').update(original).digest('hex') },
      unifiedDiff: ['diff --git a/src/bug.ts b/src/bug.ts', '--- a/src/bug.ts', '+++ b/src/bug.ts', '@@ -1 +1 @@', `-${original.trimEnd()}`, `+${content.trimEnd()}`, ''].join('\n') });
    return { git, workspace, service, saved, repair, options: { runners: [{ runner: 'jest', executable: process.execPath, args, timeoutMs: 30000, maxOutputBytes: 100000 }] } };
  }
  test('persists project, findings, checkpoint, real runs, hooks and delegations across a fresh Node process', async () => {
    const f = await fixture(); const outcome = await f.service.repairProject(f.saved.id, f.repair(), f.options);
    expect(outcome.result.status).toBe('committed'); const id = outcome.audit.id;
    const hooks = createHookManager({}, new DatabaseHookPersistenceAdapter(repository, id));
    expect(await hooks.trigger('pre:apply_patch', { files: ['.env'], unifiedDiff: '+example' })).toMatchObject({ ok: false });
    const expected = await f.service.getAuditDetails(id);
    expect(expected.audit).toMatchObject({ status: 'committed', commitSha: await f.git('rev-parse', 'HEAD') });
    expect(expected.audit.summaryJson.findings.length).toBeGreaterThan(0);
    expect(expected.audit.summaryJson.attempts[0]).toMatchObject({ sessionId: expect.any(String), attemptId: expect.any(String), checkpointCommit: expect.any(String) });
    expect(expected.testRuns.map((entry) => entry.status).sort()).toEqual(['failed', 'passed']);
    expect(expected.hookLogs.map((entry) => entry.decision)).toEqual(expect.arrayContaining(['allow', 'block']));
    expect(expected.delegations).toHaveLength(3);
    expect(expected.delegations.every((entry) => entry.snapshots.length >= 3 && entry.phase === 'consumed')).toBe(true);
    await repository.close();
    const script = `const {LocalFileDatabaseAdapter,AuditPersistenceService}=await import(${JSON.stringify(moduleUrl)});const db=await LocalFileDatabaseAdapter.create({filePath:process.argv[1]});console.log(JSON.stringify(await new AuditPersistenceService(db).getAuditDetails(process.argv[2])));await db.close();`;
    const child = await execute(process.execPath, ['--input-type=module', '-e', script, database, id], { timeout: 20000, maxBuffer: 5_000_000 });
    expect(JSON.parse(child.stdout)).toEqual(expected);
    repository = await LocalFileDatabaseAdapter.create({ filePath: database });
    expect(await new AuditPersistenceService(repository).getAuditDetails(id)).toEqual(expected);
  });
  test('persists a real regression and rollback with unchanged HEAD after reopening', async () => {
    const f = await fixture(); const initialHead = await f.git('rev-parse', 'HEAD');
    const result = await f.service.repairProject(f.saved.id, f.repair('export const add = (a: number, b: number): number => a * b;\n'), f.options);
    expect(result.audit.status).toBe('rolled_back'); expect(result.audit.commitSha).toBeNull();
    expect(await f.git('rev-parse', 'HEAD')).toBe(initialHead); expect(await readFile(path.join(f.workspace, 'src/bug.ts'), 'utf8')).toBe(original);
    await repository.close(); repository = await LocalFileDatabaseAdapter.create({ filePath: database });
    const data = await new AuditPersistenceService(repository).getAuditDetails(result.audit.id);
    expect(data.testRuns).toHaveLength(2); expect(data.delegations.at(-1).snapshots.length).toBeGreaterThanOrEqual(3);
    expect(data.audit.summaryJson.result.verification.verdict).toBe('regression_detected');
  });
  test('persists a blocked real patch and baseline, without committing or storing the diff', async () => {
    const f = await fixture(); const before = await f.git('rev-parse', 'HEAD');
    const result = await f.service.repairProject(f.saved.id, f.repair(fixed.trimEnd() + ' // SECRET_KEY=example\n'), f.options);
    expect(result.audit.status).toBe('rolled_back'); expect(await f.git('rev-parse', 'HEAD')).toBe(before);
    const details = await f.service.getAuditDetails(result.audit.id);
    expect(details.hookLogs).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'block' })]));
    expect(details.testRuns).toHaveLength(1); expect(await readFile(database, 'utf8')).not.toContain('SECRET_KEY=example');
  });
});
