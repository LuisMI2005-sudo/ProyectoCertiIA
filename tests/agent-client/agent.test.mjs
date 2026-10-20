import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { startHttpServer } from '../../dist/server/index.js';
import { LocalFileDatabaseAdapter } from '../../dist/db/index.js';
import { AgentConfigSchema, PatchProposalSchema, DevGuardianAgent, McpClientAdapter, MockChatModel,
  RepairPlanner, buildReplacementDiff, proposalDiff } from '../../dist/agent-client/index.js';

jest.setTimeout(120000);
const execute = promisify(execFile);
const original = 'export const add = (a: number, b: number): number => a - b;\n';
const fixed = 'export const add = (a: number, b: number): number => a + b;\n';
const regression = 'export const add = (a: number, b: number): number => a * b;\n';
const proposal = (code = fixed, targetPath = 'src/bug.ts') => ({ explanation: 'Repair the failing addition without changing existing behavior.', targetPath, replacementCode: code });
let root, workspace, database, app, projectId, agents, runner;
const git = async (...args) => (await execute('git', args, { cwd: workspace, timeout: 15000, windowsHide: true })).stdout.trim();
const config = (overrides = {}) => ({ projectId, targetPath: 'src/bug.ts', runner: 'jest', targets: ['tests/bug.test.cjs'],
  transportType: 'http', serverUrl: app.url + '/api/mcp', maxAttempts: 1, ...overrides });
async function agent(responses, overrides = {}, dependencies = {}) {
  const model = new MockChatModel(responses);
  const instance = await DevGuardianAgent.create(config(overrides), { model, ...dependencies }); agents.push(instance);
  return { instance, model };
}
async function launch(extra = {}) {
  return startHttpServer({ repository: await LocalFileDatabaseAdapter.create({ filePath: database }), port: 0,
    host: '127.0.0.1', workspaceRoots: [root], runners: [runner], logger: () => {}, ...extra });
}
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devguardian-agent-test-')); workspace = path.join(root, 'workspace');
  database = path.join(root, 'db.json'); agents = [];
  await mkdir(path.join(workspace, 'src'), { recursive: true }); await mkdir(path.join(workspace, 'tests'));
  await writeFile(path.join(workspace, 'src/bug.ts'), original);
  await writeFile(path.join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
  const jestConfig = path.join(workspace, 'jest.config.cjs');
  await writeFile(jestConfig, "module.exports={testEnvironment:'node',testMatch:['**/bug.test.cjs'],transform:{},cache:false};\n");
  const ts = fileURLToPath(new URL('../../node_modules/typescript/lib/typescript.js', import.meta.url));
  await writeFile(path.join(workspace, 'tests/bug.test.cjs'), [
    "const fs=require('node:fs'),vm=require('node:vm');", `const ts=require(${JSON.stringify(ts)});`,
    "const compiled=ts.transpileModule(fs.readFileSync('src/bug.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;",
    "const loaded={exports:{}};vm.runInNewContext(compiled,{module:loaded,exports:loaded.exports});const add=loaded.exports.add;",
    "test('repairs addition',()=>expect(add(2,1)).toBe(3));", "test('preserves existing',()=>expect(add(2,0)).toBe(2));"
  ].join('\n'));
  await git('init', '-b', 'main'); await git('config', 'user.name', 'Agent Tests'); await git('config', 'user.email', 'agent@devguardian.invalid');
  await git('config', 'commit.gpgsign', 'false'); await git('config', 'core.autocrlf', 'false');
  await git('add', '.'); await git('commit', '-m', 'Agent fixture');
  runner = { runner: 'jest', executable: process.execPath,
    args: [fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url)), '--config', jestConfig, '--runInBand'], timeoutMs: 30000, maxOutputBytes: 100000 };
  app = await launch();
  const response = await fetch(app.url + '/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Agent fixture', repoPath: workspace, defaultBranch: 'main', runnerType: 'jest' }) });
  expect(response.status).toBe(201); projectId = (await response.json()).data.id;
});
afterEach(async () => {
  for (const instance of agents ?? []) await instance.close();
  await app?.close(); await rm(root, { recursive: true, force: true });
});

describe('deterministic generative client over real MCP, Jest and Git', () => {
  test('repairs a real logical bug with no static error and commits only verified evidence', async () => {
    const initial = await git('rev-parse', 'HEAD'); const { instance, model } = await agent([proposal()]);
    const result = await instance.run();
    expect(result).toMatchObject({ success: true, finalState: 'committed', attemptsUsed: 1, recoveryRequired: false, hookDecisionsCaught: [] });
    expect(result.commitSha).toBe(await git('rev-parse', 'HEAD')); expect(result.commitSha).not.toBe(initial);
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(fixed); expect(await git('status', '--porcelain')).toBe('');
    expect(result.history.map((entry) => entry.state)).toEqual(['idle', 'analyzing', 'baseline_testing', 'generating_patch', 'applying_patch', 'verifying_candidate', 'committed']);
    expect(model.getCalls()).toHaveLength(1); expect(JSON.stringify(model.getCalls())).toContain('repairs addition');
    const audit = await app.backend.audit(result.auditId);
    expect(audit.audit.summaryJson.tool).toBe('git_commit_fix'); expect(audit.audit.summaryJson.resultReferences.commit).toBe(result.commitSha);
    expect((await app.backend.hookLogs({ projectId, limit: 200, offset: 0 })).some((row) => row.event === 'pre:git_commit' && row.decision === 'allow')).toBe(true);
  });
  test('detects an actual regression, restores the file and leaves HEAD intact', async () => {
    const initial = await git('rev-parse', 'HEAD'); const { instance } = await agent([proposal(regression)]);
    const result = await instance.run();
    expect(result).toMatchObject({ success: false, finalState: 'failed', attemptsUsed: 1, recoveryRequired: false });
    expect(result.history.some((entry) => entry.state === 'rolled_back')).toBe(true);
    expect(await git('rev-parse', 'HEAD')).toBe(initial); expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original);
    expect(await git('status', '--porcelain')).toBe('');
  });
  test('catches a real secret guardrail, retrieves exact audit evidence and replans compliantly', async () => {
    const secret = fixed.trimEnd() + ' // SECRET_KEY=example\n';
    const { instance, model } = await agent([proposal(secret), proposal()], { maxAttempts: 2 });
    const result = await instance.run();
    expect(result).toMatchObject({ success: true, finalState: 'committed', attemptsUsed: 2, recoveryRequired: false });
    expect(result.hookDecisionsCaught).toEqual(expect.arrayContaining([expect.objectContaining({ decision: 'block', hookId: 'protected-files-and-secrets', event: 'pre:apply_patch' })]));
    const blocked = result.hookDecisionsCaught.find((entry) => entry.auditId);
    expect((await app.backend.audit(blocked.auditId)).hookLogs.some((entry) => entry.decision === 'block')).toBe(true);
    expect(model.getCalls()[1].join('\n')).toContain('POLICY BLOCK');
    expect(model.getCalls()[1].join('\n')).not.toContain('SECRET_KEY=example');
    expect(await readFile(database, 'utf8')).not.toContain('SECRET_KEY=example');
  });
  test('exhausts the planning budget safely and never commits', async () => {
    const initial = await git('rev-parse', 'HEAD');
    const { instance, model } = await agent([new Error('model failed'), new Error('model failed')], { maxAttempts: 2 });
    const result = await instance.run();
    expect(result).toMatchObject({ success: false, finalState: 'failed', attemptsUsed: 2, recoveryRequired: false });
    expect(model.getCalls()).toHaveLength(2); expect(result.history.filter((entry) => entry.state === 'rolled_back')).toHaveLength(2);
    expect(await git('rev-parse', 'HEAD')).toBe(initial); expect(await git('status', '--porcelain')).toBe('');
  });
  test('returns regression feedback to the planner and retries on the same fix branch', async () => {
    const { instance, model } = await agent([proposal(regression), proposal()], { maxAttempts: 2 });
    const result = await instance.run(); expect(result.success).toBe(true); expect(result.attemptsUsed).toBe(2);
    expect(model.getCalls()[1].join('\n')).toContain('Candidate rejected: regression');
    expect((await git('branch', '--list', 'fix/*')).split('\n')).toHaveLength(1);
  });
  test('aborts an already-passing baseline before creating a branch or invoking the model', async () => {
    await writeFile(path.join(workspace, 'src/bug.ts'), fixed); await git('add', '.'); await git('commit', '-m', 'Already fixed');
    const { instance, model } = await agent([proposal()]); const result = await instance.run();
    expect(result).toMatchObject({ success: false, finalState: 'failed', attemptsUsed: 0 });
    expect(model.getCalls()).toHaveLength(0); expect(await git('branch', '--show-current')).toBe('main');
  });
  test('rejects a dirty workspace without losing unrelated changes', async () => {
    await writeFile(path.join(workspace, 'notes.txt'), 'user work');
    const { instance, model } = await agent([proposal()]); expect((await instance.run()).attemptsUsed).toBe(0);
    expect(model.getCalls()).toHaveLength(0); expect(await readFile(path.join(workspace, 'notes.txt'), 'utf8')).toBe('user work');
  });
  test('rejects a cross-file proposal locally, without claiming a server hook fired', async () => {
    const { instance } = await agent([proposal('example', '.env'), proposal()], { maxAttempts: 2 });
    const result = await instance.run(); expect(result.success).toBe(true); expect(result.hookDecisionsCaught).toEqual([]);
    await expect(readFile(path.join(workspace, '.env'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('does not permit the model to inject system IDs into its structured proposal', async () => {
    const { instance } = await agent([{ ...proposal(), projectId: randomUUID() }]);
    const result = await instance.run(); expect(result.success).toBe(false);
    expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(original);
  });
  test('bounds planning time even when an injected model ignores cancellation', async () => {
    const hanging = { invoke: async () => new Promise(() => {}) };
    const { instance } = await agent([proposal()], { planningTimeoutMs: 100 }, { model: hanging });
    const result = await instance.run(); expect(result).toMatchObject({ success: false, attemptsUsed: 1, recoveryRequired: false });
    expect(await git('status', '--porcelain')).toBe('');
  });
  test('observes cancellation before any repository mutation', async () => {
    const abort = new AbortController(); abort.abort(); const { instance, model } = await agent([proposal()]);
    const result = await instance.run(abort.signal); expect(result).toMatchObject({ success: false, attemptsUsed: 0 });
    expect(model.getCalls()).toHaveLength(0); expect(await git('branch', '--show-current')).toBe('main');
  });
  test('rejects concurrent runs on the same instance before its first awaited MCP call completes', async () => {
    const { instance } = await agent([proposal()]);
    const first = instance.run();
    await expect(instance.run()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((await first).success).toBe(true);
  });
  test('supports server authentication without leaking the bearer token into model context or history', async () => {
    await app.close(); const token = 'fixture-private-api-value'; app = await launch({ apiToken: token });
    const { instance, model } = await agent([proposal()], { apiToken: token }); const result = await instance.run();
    expect(result.success).toBe(true); expect(JSON.stringify(result)).not.toContain(token); expect(JSON.stringify(model.getCalls())).not.toContain(token);
  });
  test('connects through official stdio to the same durable project registry', async () => {
    const { instance } = await agent([proposal()], { transportType: 'stdio' }, { stdio: {
      environment: { DEVGUARDIAN_DB_MODE: 'local', DEVGUARDIAN_DB_PATH: database, DEVGUARDIAN_WORKSPACE_ROOT: root }
    } });
    expect((await instance.bridge.status()).headCommit).toBe(await git('rev-parse', 'HEAD'));
    expect(await instance.bridge.call('read_file_context', { path: 'src/bug.ts' })).toMatchObject({ content: original });
    const logs = await app.backend.hookLogs({ projectId, limit: 100, offset: 0 }); expect(logs.some((row) => row.event === 'pre:tool_call')).toBe(true);
  });
  test('uses real ChatAnthropic structured output with a simulated provider HTTP response and no external request', async () => {
    const { ChatAnthropic } = await import('@langchain/anthropic'); const bodies = [];
    const llm = new ChatAnthropic({ model: 'claude-sonnet-4-6', apiKey: 'fixture-anthropic-key', maxRetries: 0,
      clientOptions: { fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ id: 'msg_fixture', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
          content: [{ type: 'tool_use', id: 'toolu_fixture', name: 'repair_proposal', input: proposal() }],
          stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      } } });
    const { instance } = await agent([proposal()], {}, { model: llm.withStructuredOutput(PatchProposalSchema, { name: 'repair_proposal' }) });
    expect((await instance.run()).success).toBe(true); expect(bodies).toHaveLength(1);
    expect(bodies[0].tools.some((tool) => tool.name === 'repair_proposal')).toBe(true);
    expect(JSON.stringify(bodies)).not.toContain('fixture-anthropic-key');
  });
  test('executes the compiled CLI with a mock proposal, real MCP and no provider credentials', async () => {
    const configFile = path.join(root, 'agent.json'), mockFile = path.join(root, 'proposals.json');
    await writeFile(configFile, JSON.stringify(config())); await writeFile(mockFile, JSON.stringify([proposal()]));
    const { stdout } = await execute(process.execPath, [fileURLToPath(new URL('../../dist/agent-client/main.js', import.meta.url)),
      '--config', configFile, '--mock', mockFile], { timeout: 110000, windowsHide: true, env: { ...process.env, ANTHROPIC_API_KEY: '' } });
    expect(JSON.parse(stdout)).toMatchObject({ success: true, finalState: 'committed' });
  });
});

describe('contracts, diff generation and defensive client boundaries', () => {
  test.each(['.env', '.env.ts', '../escape.ts', 'tests/bug.test.ts', 'package.json'])('rejects unauthorized target %s before connecting', async (targetPath) => {
    await expect(DevGuardianAgent.create(config({ targetPath }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('requires exactly one patch representation', () => {
    expect(PatchProposalSchema.safeParse({ ...proposal(), unifiedDiff: 'diff' }).success).toBe(false);
    expect(PatchProposalSchema.safeParse({ explanation: 'fix', targetPath: 'src/bug.ts' }).success).toBe(false);
  });
  test('defaults maxAttempts and active model while bounding the retry budget', () => {
    expect(AgentConfigSchema.parse({ ...config(), maxAttempts: undefined }).maxAttempts).toBe(3);
    expect(AgentConfigSchema.safeParse(config({ maxAttempts: 11 })).success).toBe(false);
  });
  test('rejects a multi-file or mode-changing diff even when the outer targetPath is valid', () => {
    expect(() => proposalDiff({ explanation: 'fix', targetPath: 'src/bug.ts', unifiedDiff: buildReplacementDiff('src/other.ts', original, fixed) }, 'src/bug.ts', original)).toThrow();
    expect(() => proposalDiff({ explanation: 'fix', targetPath: 'src/bug.ts', unifiedDiff: buildReplacementDiff('src/bug.ts', original, fixed) + 'new mode 100755\n' }, 'src/bug.ts', original)).toThrow();
  });
  test('applies generated CRLF and missing-newline diffs with actual git apply --check', async () => {
    for (const [before, after] of [['export const n=1;\r\n', 'export const n=2;\r\n'], ['export const n=1;', 'export const n=2;']]) {
      await writeFile(path.join(workspace, 'src/bug.ts'), before);
      const diffFile = path.join(root, 'patch.diff'); await writeFile(diffFile, buildReplacementDiff('src/bug.ts', before, after));
      await git('apply', '--check', diffFile); await git('apply', diffFile);
      expect(await readFile(path.join(workspace, 'src/bug.ts'), 'utf8')).toBe(after);
    }
  });
  test('validates malformed MCP responses and refuses false success with isError', async () => {
    const parsed = AgentConfigSchema.parse(config());
    for (const reply of [{ structuredContent: { ok: true, data: {} } }, { isError: true, structuredContent: { ok: true, data: {} } }]) {
      const connection = { callTool: async () => reply, close: async () => {}, listTools: async () => ({ tools: [] }) };
      await expect(new McpClientAdapter(connection, parsed).status()).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });
  test('does not replay a mutation when the transport outcome is unknown', async () => {
    const { instance } = await agent([proposal()]);
    const originalApply = instance.bridge.applyProposedPatch.bind(instance.bridge);
    let calls = 0;
    instance.bridge.applyProposedPatch = async (...args) => { calls += 1; await originalApply(...args);
      const { McpOutcomeUnknownError } = await import('../../dist/agent-client/index.js'); throw new McpOutcomeUnknownError('git_apply_patch'); };
    const result = await instance.run(); expect(result).toMatchObject({ success: false, recoveryRequired: true, attemptsUsed: 1 });
    expect(calls).toBe(1); const active = instance.bridge.activeAttemptId; expect(active).toBeTruthy();
    await instance.bridge.rollback(active); // Test owner explicitly reconciles and restores the known fixture.
  });
  test('refuses secret-like source before exposing it to the model', async () => {
    const model = new MockChatModel([proposal()]); const planner = new RepairPlanner(AgentConfigSchema.parse(config()), model);
    await expect(planner.plan({ targetPath: 'src/bug.ts', source: { content: 'const password="private-value";', truncated: false },
      analysis: { diagnostics: [] }, baseline: { cases: [] }, feedback: [], attempt: 1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(model.getCalls()).toHaveLength(0);
  });
});
