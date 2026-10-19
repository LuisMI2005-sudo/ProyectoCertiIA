import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentCoordinator, DevGuardianCoordinator, DelegationStore, ScopedToolProxy, SubagentRuntime,
  ToolScopeError, TaskBudgetError, ROLE_TOOLS, OutputSchemas, getDelegationLogs, getDelegationSummary
} from '../../dist/subagents/index.js';
import { createHookManager } from '../../dist/hooks/index.js';

jest.setTimeout(120000);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const target = 'src/bug.ts';
const original = 'export const add = (a: number, b: number): number => String(a - b);\n';
const fixed = 'export const add = (a: number, b: number): number => a + b;\n';
const patch = (content = fixed) => [
  `diff --git a/${target} b/${target}`, `--- a/${target}`, `+++ b/${target}`,
  '@@ -1 +1 @@', `-${original.trimEnd()}`, `+${content.trimEnd()}`, ''
].join('\n');
const task = (role = 'diagnostic', scopedContext = { path: target }, overrides = {}) => ({
  taskId: randomUUID(), parentSessionId: randomUUID(), role, objective: 'Bounded specialist task', scopedContext,
  allowedTools: [...ROLE_TOOLS[role]], budget: { maxToolCalls: 6, timeoutMs: 10000 }, ...overrides
});
const analysis = () => ({ analysisId: randomUUID(), diagnostics: [], affectedSymbols: [], dependencies: [], analyzedFiles: [target], truncated: false });
const handlers = () => ({
  analyze_code: jest.fn(async () => analysis()),
  read_file_context: jest.fn(async () => ({ path: target, content: original, startLine: 1, endLine: 1, fileHash: hash(original), truncated: false })),
  git_apply_patch: jest.fn(async () => { throw new Error('Must never execute'); }),
  git_commit_fix: jest.fn(async () => { throw new Error('Must never execute'); })
});

describe('delegation runtime and capability isolation', () => {
  test.each(['git_apply_patch', 'git_commit_fix'])('diagnostic cannot invoke %s even when host has a handler', async (tool) => {
    const tools = handlers(); const proxy = new ScopedToolProxy(task(), tools);
    await expect(proxy.call(tool, { secret: 'do-not-log' })).rejects.toBeInstanceOf(ToolScopeError);
    expect(tools[tool]).not.toHaveBeenCalled();
    expect(proxy.getToolCalls()[0]).toMatchObject({ tool, status: 'denied', dispatched: false, input: null });
    expect(JSON.stringify(proxy.getToolCalls())).not.toContain('do-not-log');
  });
  test('verification cannot mutate Git; a forged whitelist cannot grant role privileges', async () => {
    const request = task('verification', { mode: 'baseline', runner: 'jest', targets: ['tests/bug.test.cjs'] });
    await expect(new ScopedToolProxy(request, handlers()).call('git_commit_fix', {})).rejects.toBeInstanceOf(ToolScopeError);
    expect(() => new ScopedToolProxy({ ...request, allowedTools: ['git_commit_fix'] }, handlers())).toThrow(ToolScopeError);
    const rejected = await new SubagentRuntime(handlers()).execute({ ...request, allowedTools: ['git_commit_fix'] });
    expect(rejected).toMatchObject({ status: 'rejected', workerThreadId: null, output: null });
  });
  test('tool whitelist cannot be changed by mutating the caller request', async () => {
    const request = task(); const tools = handlers(); const proxy = new ScopedToolProxy(request, tools);
    request.allowedTools.push('git_apply_patch'); request.scopedContext.path = 'src/other.ts';
    await expect(proxy.call('git_apply_patch', {})).rejects.toBeInstanceOf(ToolScopeError);
    expect(tools.git_apply_patch).not.toHaveBeenCalled();
  });
  test('rejects an envelope that includes global state outside the scoped context contract', async () => {
    const tools = handlers();
    const result = await new SubagentRuntime(tools).execute(task('diagnostic', { path: target, globalState: { credentials: 'private' } }));
    expect(result).toMatchObject({ status: 'rejected', output: null, workerThreadId: null });
    expect(tools.analyze_code).not.toHaveBeenCalled();
  });
  test('file, runner targets and evidence IDs are scoped as well as tool names', async () => {
    const tools = handlers();
    await expect(new ScopedToolProxy(task(), tools).call('read_file_context', { path: 'src/other.ts' })).rejects.toBeInstanceOf(ToolScopeError);
    const verification = task('verification', { mode: 'candidate', runner: 'jest', targets: ['tests/bug.test.cjs'], baselineRunId: randomUUID() });
    await expect(new ScopedToolProxy(verification, {}).call('run_tests', { runner: 'jest', targets: ['tests/other.test.cjs'] })).rejects.toBeInstanceOf(ToolScopeError);
    await expect(new ScopedToolProxy(verification, {}).call('compare_test_runs', { baselineRunId: randomUUID(), candidateRunId: randomUUID() })).rejects.toBeInstanceOf(ToolScopeError);
    expect(tools.read_file_context).not.toHaveBeenCalled();
  });
  test('enforces maxToolCalls before dispatch, and journals the denied attempt', async () => {
    const tools = handlers(); const proxy = new ScopedToolProxy(task('diagnostic', { path: target }, { budget: { maxToolCalls: 1, timeoutMs: 10000 } }), tools);
    await proxy.call('analyze_code', { paths: [target], checks: ['syntax'] });
    await expect(proxy.call('read_file_context', { path: target })).rejects.toBeInstanceOf(TaskBudgetError);
    expect(tools.analyze_code).toHaveBeenCalledTimes(1); expect(tools.read_file_context).not.toHaveBeenCalled();
    expect(proxy.getToolCalls().map((entry) => entry.dispatched)).toEqual([true, false]);
  });
  test('rejects tool calls after deadline and validates domain output contracts', async () => {
    const tools = handlers();
    const proxy = new ScopedToolProxy(task('diagnostic', { path: target }, { budget: { maxToolCalls: 2, timeoutMs: 1 } }), tools);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(proxy.call('analyze_code', { paths: [target], checks: ['syntax'] })).rejects.toBeInstanceOf(TaskBudgetError);
    expect(tools.analyze_code).not.toHaveBeenCalled();
    const runtime = new SubagentRuntime({ analyze_code: async () => ({ invalid: true }) });
    expect(await runtime.execute(task())).toMatchObject({ status: 'failed', output: null,
      toolCallsExecuted: [expect.objectContaining({ tool: 'analyze_code', status: 'failed', dispatched: true })] });
    expect(OutputSchemas.verification.safeParse({ verdict: 'ready_to_commit', baselineRunId: randomUUID(), candidateRunId: randomUUID(), verificationId: null, reason: 'Forged' }).success).toBe(false);
  });
  test('fresh workers return independent identities and runtime budget failures are terminal', async () => {
    const runtime = new SubagentRuntime(handlers());
    const first = await runtime.execute(task()); const second = await runtime.execute(task());
    expect(first.status).toBe('completed'); expect(second.status).toBe('completed');
    expect(first.workerThreadId).toBeGreaterThan(0); expect(first.workerThreadId).not.toBe(second.workerThreadId);
    expect(first.subagentId).not.toBe(second.subagentId);
    const exceeded = await runtime.execute(task('diagnostic', { path: target }, { budget: { maxToolCalls: 1, timeoutMs: 10000 } }));
    expect(exceeded).toMatchObject({ status: 'budget_exceeded', output: null });
    expect(exceeded.toolCallsExecuted.filter((entry) => entry.dispatched)).toHaveLength(1);
  });
  test('deadline terminates the worker, aborts in-flight tools and waits for cleanup', async () => {
    let invoked = false, cleaned = false;
    const runtime = new SubagentRuntime({ analyze_code: async (_input, signal) => {
      invoked = true;
      await new Promise((resolve) => { if (signal.aborted) resolve(); else signal.addEventListener('abort', resolve, { once: true }); });
      cleaned = true; return analysis();
    } });
    const result = await runtime.execute(task('diagnostic', { path: target }, { budget: { maxToolCalls: 2, timeoutMs: 2000 } }));
    expect(result).toMatchObject({ status: 'budget_exceeded', output: null });
    expect(invoked).toBe(true); expect(cleaned).toBe(true);
  });
  test.each(['skipped', 'incomplete'])('verification refuses commit for %s evidence even if comparison reports success', async (kind) => {
    const now = new Date().toISOString(), runId = randomUUID();
    const testCase = (id, status) => ({ id, path: 'tests/bug.test.cjs', name: id, status, durationMs: 1, failureMessage: null });
    const run = { runId, runner: 'jest', status: kind === 'incomplete' ? 'error' : 'passed', exitCode: 0, durationMs: 1,
      complete: kind !== 'incomplete', truncated: false,
      cases: kind === 'skipped' ? [testCase('fix', 'passed'), testCase('existing', 'skipped')] : [],
      summary: kind === 'skipped' ? { total: 2, passed: 1, failed: 0, skipped: 1, todo: 0 } : { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0 },
      stdout: '', stderr: '', startedAt: now, finishedAt: now, workspaceStateHash: 'a'.repeat(64), configurationHash: 'b'.repeat(64) };
    const runtime = new SubagentRuntime({ run_tests: async () => run,
      compare_test_runs: async () => ({ comparable: true, verdict: 'success', resolvedFailures: ['fix'], newFailures: [], missingTests: [] }) });
    const result = await runtime.execute(task('verification', { mode: 'candidate', runner: 'jest', targets: ['tests/bug.test.cjs'], baselineRunId: randomUUID() }));
    expect(result).toMatchObject({ status: 'completed', output: { verdict: kind === 'skipped' ? 'regression_detected' : 'inconclusive', verificationId: null } });
  });
  test('hooks can block delegation before any worker/tool is started', async () => {
    const tools = handlers(); const hooks = createHookManager(); const store = new DelegationStore();
    hooks.register({ id: 'deny-delegation', name: 'Deny delegation', events: ['pre:delegate'], execute: () => ({ decision: 'block', reason: 'Delegation denied by policy.' }) });
    const agent = new AgentCoordinator(new SubagentRuntime(tools), hooks, store);
    const result = await agent.delegate(task());
    expect(result).toMatchObject({ status: 'rejected', workerThreadId: null });
    expect(tools.analyze_code).not.toHaveBeenCalled();
    expect(getDelegationLogs(store).at(-1)).toMatchObject({ phase: 'returned', result: { status: 'rejected' } });
    expect(hooks.logStore.getAuditLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:delegate', decision: 'block' })]));
  });
  test('trace persistence is append-only and query results are defensive copies', async () => {
    const appended = []; const store = new DelegationStore({ async append(record) { appended.push(record); record.coordinatorId = 'adapter-mutated'; } });
    const agent = new AgentCoordinator(new SubagentRuntime(handlers()), createHookManager(), store);
    const request = task(); const result = await agent.delegate(request);
    await store.consume(result.taskId, 'stop', 'No static defect found.');
    const logs = getDelegationLogs(store);
    expect(logs.map((entry) => entry.phase)).toEqual(['delegated', 'returned', 'consumed']);
    logs[0].request.objective = 'tampered';
    expect(store.getDelegationLogs()[0].request.objective).toBe(request.objective);
    expect(store.getDelegationLogs()[0].coordinatorId).toBe(agent.coordinatorId);
    expect(appended).toHaveLength(3);
    expect(getDelegationSummary(store)).toMatchObject({ tasks: 1, completed: 1, toolCalls: 2 });
    await expect(agent.delegate(request)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  test('audit adapter failure prevents a worker from starting', async () => {
    const tools = handlers(); const store = new DelegationStore({ async append() { throw new Error('DB offline'); } });
    const agent = new AgentCoordinator(new SubagentRuntime(tools), createHookManager(), store);
    await expect(agent.delegate(task())).rejects.toThrow('DB offline');
    expect(tools.analyze_code).not.toHaveBeenCalled();
    expect(store.getDelegationLogs()).toHaveLength(1);
  });
  test('patch-safety delegates a hook preflight without giving access to Git mutation', async () => {
    const hooks = createHookManager();
    const runtime = new SubagentRuntime({ inspect_patch: async (input) => {
      const decision = await hooks.trigger('pre:apply_patch', input);
      return { allowed: decision.ok, reason: decision.ok ? 'Preflight allowed.' : decision.error.message };
    } });
    const store = new DelegationStore(); const agent = new AgentCoordinator(runtime, hooks, store);
    const result = await agent.delegate(task('patch-safety', { files: ['.env'], unifiedDiff: '+SECRET_KEY=example\n' }));
    expect(result).toMatchObject({ status: 'completed', output: { allowed: false, reason: 'Protected file: .env' } });
    expect(result.toolCallsExecuted[0]).toMatchObject({ tool: 'inspect_patch', dispatched: true, input: null });
    expect(JSON.stringify(store.getDelegationLogs())).not.toContain('SECRET_KEY=example');
  });
});

describe('real domain delegation and coordinated repair', () => {
  let root, coordinator, head;
  const execute = promisify(execFile);
  const git = async (...args) => (await execute('git', args, { cwd: root, timeout: 15000, windowsHide: true })).stdout.trim();
  const request = (overrides = {}) => ({ path: target, slug: 'delegated-repair', message: 'Fix addition through delegated diagnosis and verification',
    unifiedDiff: patch(), expectedFileHashes: { [target]: hash(original) }, runner: 'jest', targets: ['tests/bug.test.cjs'], ...overrides });
  beforeEach(async () => {
    root = await mkdtemp(path.join(process.cwd(), '.subagents-test-'));
    await mkdir(path.join(root, 'src')); await mkdir(path.join(root, 'tests'));
    await writeFile(path.join(root, target), original);
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
    await writeFile(path.join(root, 'jest.config.cjs'), "module.exports = { testEnvironment: 'node', testMatch: ['**/bug.test.cjs'], transform: {}, cache: false };\n");
    const ts = fileURLToPath(new URL('../../node_modules/typescript/lib/typescript.js', import.meta.url));
    const suite = [
      "const { readFileSync } = require('node:fs');", "const { runInNewContext } = require('node:vm');",
      `const ts = require(${JSON.stringify(ts)});`,
      "const source = readFileSync('src/bug.ts', 'utf8');",
      "const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;",
      "const loaded = { exports: {} }; runInNewContext(compiled, { module: loaded, exports: loaded.exports });",
      "const add = loaded.exports.add;",
      "test('repairs addition', () => expect(add(2, 1)).toBe(3));",
      "test('preserves existing behavior', () => expect(Number(add(2, 0))).toBe(2));", ''
    ].join('\n');
    await writeFile(path.join(root, 'tests/bug.test.cjs'), suite);
    await git('init', '-b', 'main'); await git('config', 'user.name', 'Delegation Tests');
    await git('config', 'user.email', 'delegation@devguardian.invalid');
    await git('config', 'core.autocrlf', 'false'); await git('config', 'commit.gpgsign', 'false');
    await git('add', '.'); await git('commit', '-m', 'Defective baseline'); head = await git('rev-parse', 'HEAD');
    const jestCli = fileURLToPath(new URL('../../node_modules/jest/bin/jest.js', import.meta.url));
    coordinator = await DevGuardianCoordinator.create({ workspaceRoot: root,
      runners: [{ runner: 'jest', executable: process.execPath,
        args: [jestCli, '--config', path.join(root, 'jest.config.cjs'), '--runInBand'], timeoutMs: 30000, maxOutputBytes: 100000 }] });
  });
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
  test('delegates actual AST/lint diagnosis in a separate worker with bounded context and exact source', async () => {
    const result = await coordinator.diagnose(target);
    expect(result).toMatchObject({ role: 'diagnostic', status: 'completed', output: { path: target, remediationCandidate: true, snippet: { content: original, fileHash: hash(original) } } });
    expect(result.workerThreadId).toBeGreaterThan(0);
    expect(result.output.findings.some((finding) => finding.source === 'typescript' && finding.severity === 'error')).toBe(true);
    expect(result.output.rootCause).toContain('number');
    expect(result.toolCallsExecuted.map((entry) => entry.tool)).toEqual(['analyze_code', 'read_file_context']);
    const logs = coordinator.delegationStore.getDelegationLogs();
    expect(logs[0].request.scopedContext).toEqual({ path: target });
    expect(logs.at(-1).result.subagentId).toBe(result.subagentId);
    expect(coordinator.hooks.getHookLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:delegate', metadata: expect.objectContaining({ delegation: expect.objectContaining({ taskId: result.taskId }) }) })]));
  });
  test('SUCCESS: coordinator -> diagnostic worker -> patch/hooks -> verifier workers -> real Jest -> commit', async () => {
    const result = await coordinator.repair(request());
    expect(result).toMatchObject({ status: 'committed', diagnostic: { remediationCandidate: true }, verification: { verdict: 'ready_to_commit' } });
    expect(await git('rev-parse', 'HEAD')).toBe(result.commit.commit);
    expect(await git('rev-parse', 'HEAD')).not.toBe(head);
    expect(await git('branch', '--show-current')).toBe('fix/delegated-repair');
    expect(await readFile(path.join(root, target), 'utf8')).toBe(fixed);
    expect(await git('status', '--porcelain')).toBe('');
    const evidence = await coordinator.runner.getEvidence(result.verification.verificationId);
    expect(evidence.baseline.status).toBe('failed'); expect(evidence.candidate.status).toBe('passed');
    expect(evidence.baseline.workspaceStateHash).not.toBe(evidence.candidate.workspaceStateHash);
    const logs = coordinator.delegationStore.getDelegationLogs();
    const returned = logs.filter((record) => record.phase === 'returned');
    expect(returned.map((record) => record.request.role)).toEqual(['diagnostic', 'verification', 'verification']);
    expect(new Set(returned.map((record) => record.result.workerThreadId)).size).toBe(3);
    expect(returned.at(-1).result.toolCallsExecuted.map((call) => call.tool)).toEqual(['run_tests', 'compare_test_runs']);
    expect(logs.at(-1)).toMatchObject({ phase: 'consumed', consumption: { decision: 'committed', reason: expect.stringContaining(result.commit.commit) } });
    expect(coordinator.delegationStore.getDelegationSummary()).toMatchObject({ tasks: 3, completed: 3, toolCalls: 5 });
    for (const event of ['pre:delegate', 'post:delegate', 'pre:apply_patch', 'pre:git_commit', 'post:commit']) expect(coordinator.hooks.getHookLogs().some((log) => log.event === event)).toBe(true);
  });
  test('REGRESSION: verifier reports new failure, coordinator rolls back and preserves HEAD', async () => {
    const bad = 'export const add = (a: number, b: number): number => a * b;\n';
    const result = await coordinator.repair(request({ unifiedDiff: patch(bad) }));
    expect(result).toMatchObject({ status: 'rolled_back', commit: null, verification: { verdict: 'regression_detected', verificationId: null } });
    expect(await readFile(path.join(root, target), 'utf8')).toBe(original);
    expect(await git('rev-parse', 'HEAD')).toBe(head); expect(await git('status', '--porcelain')).toBe('');
    const logs = coordinator.delegationStore.getDelegationLogs();
    expect(logs.at(-1)).toMatchObject({ consumption: { decision: 'rolled_back' }, result: { output: { verdict: 'regression_detected' } } });
    expect(logs.at(-1).result.toolCallsExecuted.at(-1).output.newFailures).toHaveLength(1);
    expect(coordinator.hooks.getHookLogs().some((entry) => entry.event === 'pre:git_commit')).toBe(false);
  });
  test('hook blocks an injected secret and coordinator closes the attempt with rollback', async () => {
    const result = await coordinator.repair(request({ unifiedDiff: patch(fixed.trimEnd() + ' // SECRET_KEY=example\n') }));
    expect(result).toMatchObject({ status: 'rolled_back', commit: null, reason: 'Secret pattern detected in added content.' });
    expect(await readFile(path.join(root, target), 'utf8')).toBe(original);
    expect(await git('rev-parse', 'HEAD')).toBe(head);
    expect(coordinator.delegationStore.getDelegationSummary().tasks).toBe(2);
    expect(coordinator.hooks.logStore.getAuditLogs()).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'pre:apply_patch', decision: 'block' })]));
  });
  test('diagnostic budget exhaustion rejects repair before creating a branch', async () => {
    expect(await coordinator.repair(request({ budget: { maxToolCalls: 1, timeoutMs: 30000 } }))).toMatchObject({ status: 'rejected', commit: null });
    expect(await git('branch', '--show-current')).toBe('main');
    expect(coordinator.delegationStore.getDelegationLogs().at(-1)).toMatchObject({ consumption: { decision: 'stop' }, result: { status: 'budget_exceeded' } });
  });
  test('delegation hook can reject verification and prevents the baseline tool from running', async () => {
    coordinator.hooks.register({ id: 'no-verification', name: 'No verification', events: ['pre:delegate'], execute: (payload) =>
      ({ decision: payload.delegation.role === 'verification' ? 'block' : 'allow', reason: 'Verification role restricted.' }) });
    expect(await coordinator.repair(request())).toMatchObject({ status: 'rolled_back', commit: null });
    expect(await readFile(path.join(root, target), 'utf8')).toBe(original);
    const denied = coordinator.delegationStore.getDelegationLogs().find((entry) => entry.phase === 'returned' && entry.request.role === 'verification');
    expect(denied.result).toMatchObject({ status: 'rejected', workerThreadId: null, toolCallsExecuted: [] });
    expect(coordinator.hooks.getHookLogs().some((entry) => entry.event === 'pre:run_tests')).toBe(false);
  });
});
