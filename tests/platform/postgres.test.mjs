import { afterAll, afterEach, beforeAll, describe, test, expect, jest } from '@jest/globals';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { Pool } from 'pg';
import { provision } from '../../dist/platform/provision.js';
import { PlatformConfigSchema, ServiceSchema } from '../../dist/platform/contracts.js';
import { DomainStore } from '../../dist/platform/store.js';
import { PostgresDatabaseAdapter } from '../../dist/db/postgres-adapter.js';
import { startGateway } from '../../dist/platform/gateway.js';
import { startIdentity } from '../../dist/platform/identity.js';
import { startExecution } from '../../dist/platform/execution.js';
import { startDomain } from '../../dist/platform/domains.js';
import { startPlanner } from '../../dist/platform/planner.js';
import { issueServiceToken } from '../../dist/platform/security.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const execute = promisify(execFile);
const adminUrl = process.env.DEVGUARDIAN_TEST_ADMIN_URL;
const integration = adminUrl ? describe : describe.skip;
jest.setTimeout(120000);
integration('PostgreSQL platform: real RLS and authenticated HTTP flow', () => {
  let directory, configs, tenantA, tenantB, subjectId, token, gateway, projectId;
  const running = [], pools = [];
  const password = randomBytes(24).toString('hex');
  const email = `test-${randomUUID()}@example.invalid`;
  async function call(route, body, tenant = tenantA, credential = token, extra = {}) {
    const response = await fetch(gateway + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(tenant ? { 'X-Tenant-Id': tenant } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
    return { status: response.status, body: await response.json() };
  }
  beforeAll(async () => {
    await mkdir('.platform-local', { recursive: true }); directory = path.resolve('.platform-local', `test-${randomUUID()}`);
    const result = await provision(adminUrl, directory, { email, password, name: 'Team A' }, 45000 + Math.floor(Math.random() * 1000));
    tenantA = result.tenantId; subjectId = result.subjectId; gateway = result.gateway;
    configs = Object.fromEntries(await Promise.all(ServiceSchema.options.map(async service => [service, PlatformConfigSchema.parse(JSON.parse(await readFile(path.join(directory, `${service}.json`), 'utf8')))])));
    for (const service of ServiceSchema.options) running.push(await (service === 'gateway' ? startGateway(configs[service]) : service === 'identity' ? startIdentity(configs[service]) : service === 'execution' ? startExecution(configs[service]) : service === 'planner' ? startPlanner(configs[service]) : startDomain(configs[service])));
    const login = await call('/api/auth/login', { email, password }, undefined, '');
    expect(login.status).toBe(200); token = login.body.token;
    const organization = await call('/api/organizations', { name: 'Team B' });
    expect(organization.status).toBe(201); tenantB = organization.body.id;
  });
  afterAll(async () => {
    for (const service of [...running].reverse()) await service.close();
    for (const pool of pools) await pool.close();
    if (!configs) return;
    const admin = new Pool({ connectionString: adminUrl, max: 1 });
    try {
      for (const config of Object.values(configs)) {
        if (!config.databaseUrl) continue;
        const url = new URL(config.databaseUrl), database = url.pathname.slice(1), role = url.username;
        if (!/^dg_[a-f0-9]{10}_[a-z]+$/u.test(database) || !/^dg_[a-f0-9]{10}_[a-z]+_runtime$/u.test(role)) throw new Error('Cleanup target rejected.');
        await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); await admin.query(`DROP ROLE ${role}`);
      }
    } finally { await admin.end(); }
  });
  afterEach(async () => { for (const pool of pools.splice(0)) await pool.close(); });
  test('requires a session, validates membership and rejects forged tenant selection', async () => {
    expect((await call('/api/projects', undefined, tenantA, '')).status).toBe(401);
    expect((await call('/api/projects', undefined, randomUUID())).status).toBe(403);
  });
  test('runtime role has no owner/superuser/bypassRLS privileges; other databases reject it', async () => {
    const pool = new DomainStore(configs.projects.databaseUrl, 'projects'); pools.push(pool);
    const roles = await pool.pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(roles.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const cross = new URL(configs.projects.databaseUrl); cross.pathname = new URL(configs.identity.databaseUrl).pathname;
    const forbidden = new Pool({ connectionString: cross.toString(), connectionTimeoutMillis: 3000 });
    try { await expect(forbidden.query('SELECT 1')).rejects.toThrow(); } finally { await forbidden.end(); }
  });
  test('RLS rejects unscoped writes, hides tenant B and resets context after transaction', async () => {
    const store = new DomainStore(configs.policies.databaseUrl, 'policies'); pools.push(store);
    const a = { tenantId: tenantA, subjectId, role: 'owner', correlationId: randomUUID() }, b = { ...a, tenantId: tenantB };
    const id = randomUUID();
    await store.save(a, 'policy', id, { label: 'A' }, 'active', null);
    expect(await store.get(b, 'policy', id)).toBeNull();
    await store.save(b, 'policy', id, { label: 'B' }, 'active', null);
    expect((await store.get(a, 'policy', id)).data.label).toBe('A');
    expect((await store.pool.query('SELECT * FROM domain_records')).rows).toHaveLength(0);
    await expect(store.pool.query("INSERT INTO domain_records(tenant_id,entity_type,id,version,status,data) VALUES($1,'test',$2,1,'active','{}')", [tenantA, randomUUID()])).rejects.toThrow();
    await expect(store.transaction(a, client => client.query("INSERT INTO domain_records(tenant_id,entity_type,id,version,status,data) VALUES($1,'test',$2,1,'active','{}')", [tenantB, randomUUID()]))).rejects.toThrow();
    expect((await store.events(a, 0))).toHaveLength(1);
    expect((await store.events(b, 0))).toHaveLength(1);
  });
  test('legacy execution repository applies tenant-scoped queries on the real schema', async () => {
    const a = await PostgresDatabaseAdapter.create({ connectionString: configs.execution.databaseUrl, tenantId: tenantA, externallyMigrated: true });
    const b = await PostgresDatabaseAdapter.create({ connectionString: configs.execution.databaseUrl, tenantId: tenantB, externallyMigrated: true });
    try {
      const id = randomUUID(), project = { id, name: 'Tenant A', repoPath: '/unused', defaultBranch: 'main', runnerType: 'jest', createdAt: new Date().toISOString() };
      await a.createProject(project); expect(await b.getProject(id)).toBeNull();
      await b.createProject({ ...project, name: 'Tenant B' }); expect((await a.getProject(id)).name).toBe('Tenant A');
    } finally { await a.close(); await b.close(); }
  });
  test('telemetry credentials cannot authorize execution writes', async () => {
    const context = { tenantId: tenantA, subjectId, role: 'owner', correlationId: randomUUID() };
    const response = await fetch(`http://127.0.0.1:${configs.execution.services.execution.port}/api/audits/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueServiceToken(configs.telemetry, 'telemetry', 'execution', context)}` }, body: '{}' });
    expect(response.status).toBe(401);
  });
  test('registers a real Git repository, diagnoses a type error and isolates history', async () => {
    const repo = path.join(configs.execution.workspaceRoot, tenantA, 'sample');
    await mkdir(path.join(repo, 'src'), { recursive: true });
    await writeFile(path.join(repo, 'src/calculator.ts'), 'export const answer: number = "wrong";\n');
    await writeFile(path.join(repo, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src'] }));
    const git = async (...args) => execute('git', ['-C', repo, ...args], { timeout: 15000, windowsHide: true });
    await git('init', '-b', 'main'); await git('add', '.'); await git('-c', 'user.name=Platform Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    const registered = await call('/api/projects', { name: 'Sample', repoPath: repo, defaultBranch: 'main', runnerType: 'jest' });
    expect(registered.status).toBe(201); projectId = registered.body.data.id;
    expect((await call('/api/projects')).body.data.some(project => project.id === projectId)).toBe(true);
    expect((await call('/api/projects', undefined, tenantB)).body.data.some(project => project.id === projectId)).toBe(false);
    expect((await call(`/api/projects/${projectId}/files`, undefined, tenantB)).status).toBeGreaterThanOrEqual(400);
    const key = randomUUID(), body = { projectId, mode: 'diagnose', path: 'src/calculator.ts', checks: ['syntax', 'semantic'] };
    const diagnosed = await call('/api/audits/run', body, tenantA, token, { 'X-Idempotency-Key': key });
    expect(diagnosed.status).toBe(200); expect(diagnosed.body.ok).toBe(true);
    const repeated = await call('/api/audits/run', body, tenantA, token, { 'X-Idempotency-Key': key });
    expect(repeated.body).toEqual(diagnosed.body);
    expect((await call('/api/audits/run', { ...body, checks: ['syntax'] }, tenantA, token, { 'X-Idempotency-Key': key })).status).toBe(409);
    const events = await call('/api/telemetry/events'); expect(events.status).toBe(200);
    expect(events.body.data.some(event => event.source === 'audits')).toBe(true);
    const repeatedEvents = await call('/api/telemetry/events'); expect(repeatedEvents.body.data.length).toBe(events.body.data.length);
  });
  test('viewer membership can read and cannot mutate or call arbitrary MCP tools', async () => {
    const viewer = `viewer-${randomUUID()}@example.invalid`;
    expect((await call('/api/organizations/members', { email: viewer, password, role: 'viewer' })).status).toBe(201);
    const login = await call('/api/auth/login', { email: viewer, password }, undefined, '');
    const credential = login.body.token;
    expect((await call('/api/projects', undefined, tenantA, credential)).status).toBe(200);
    expect((await call('/api/projects', {}, tenantA, credential)).status).toBe(403);
    expect((await call('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, tenantA, credential)).status).toBe(403);
    expect((await call('/api/organizations/members', { email: viewer, password, role: 'viewer' }, tenantA, credential)).status).toBe(403);
  });
  test('a real MCP client negotiates and lists the tools through the tenant gateway', async () => {
    const client = new Client({ name: 'platform-test', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp', gateway), { requestInit: { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantA } } }), { timeout: 10000 });
      const catalog = await client.listTools(); expect(catalog.tools.some(tool => tool.name === 'analyze_code')).toBe(true); expect(catalog.tools.length).toBe(19);
    } finally { await client.close(); }
  });
  test('revokes sessions and rejects disallowed origins', async () => {
    const response = await fetch(gateway + '/api/platform', { headers: { Origin: 'https://untrusted.invalid' } }); expect(response.status).toBe(403);
    expect((await call('/api/auth/logout', {})).status).toBe(200);
    expect((await call('/api/projects')).status).toBe(401);
  });
});
