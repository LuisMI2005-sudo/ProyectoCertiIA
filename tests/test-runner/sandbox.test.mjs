import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { DockerTestSandbox } from '../../dist/test-runner/docker-sandbox.js';
import { TestRunner } from '../../dist/test-runner/index.js';
import { DevGuardianCoordinator } from '../../dist/subagents/coordinator.js';
import { buildReplacementDiff } from '../../dist/agent-client/orchestrator.js';
const execute = promisify(execFile);
const image = process.env.DEVGUARDIAN_SANDBOX_IMAGE_ID;
const integration = image ? describe : describe.skip;
jest.setTimeout(120000);
const original = 'export const add = (a: number, b: number): number => String(a - b);\n', fixed = 'export const add = (a: number, b: number): number => a + b;\n';
const configurations = [{ runner: 'jest', executable: process.execPath, args: [], timeoutMs: 30000, maxOutputBytes: 100000 }, { runner: 'pytest', executable: 'pytest', args: [], timeoutMs: 30000, maxOutputBytes: 100000 }];
describe('sandbox configuration', () => {
  test('refuses mutable image tags', () => expect(() => new DockerTestSandbox('docker', 'node:latest')).toThrow());
  test('binds the verification fingerprint to an immutable image ID', () => expect(new DockerTestSandbox('docker', 'sha256:' + 'a'.repeat(64)).fingerprint).toContain('sha256:' + 'a'.repeat(64)));
});
integration('real Docker isolation and repair', () => {
  let root, sandbox;
  const git = (...args) => execute('git', ['-C', root, ...args], { timeout: 15000, windowsHide: true });
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'devguardian-real-repair-'));
    await mkdir(path.join(root, 'src')); await mkdir(path.join(root, 'tests'));
    await writeFile(path.join(root, 'src/add.ts'), original);
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src/**/*.ts'] }));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'isolated-fixture', jest: { testMatch: ['**/tests/*.test.cjs'] } }));
    await writeFile(path.join(root, 'tests/add.test.cjs'), "const {add}=require('../src/add.ts');test('adds',()=>expect(add(2,3)).toBe(5));\n");
    await writeFile(path.join(root, 'tests/test_python.py'), 'def test_actual_pytest():\n    assert 2 + 3 == 5\n');
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Sandbox CI');
    await git('config', 'user.email', 'sandbox@example.invalid');
    await git('add', '.'); await git('commit', '-m', 'fixture');
    sandbox = new DockerTestSandbox(process.env.DEVGUARDIAN_DOCKER_BINARY || 'docker', image);
    expect(await sandbox.ready()).toBe(true);
  });
  afterEach(async () => { if (root) { if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('devguardian-real-repair-')) throw new Error('Cleanup path rejected.'); await rm(root, { recursive: true, force: true }); } });
  test('uses real pytest JSON and preserves the host checkout', async () => {
    const runner = await TestRunner.create({ workspaceRoot: root, runners: configurations, workspaceStateHash: async () => 'a'.repeat(64), sandbox });
    const run = await runner.runTests({ runner: 'pytest', targets: ['tests/test_python.py'] });
    expect(run).toMatchObject({ complete: true, status: 'passed', summary: { passed: 1 } });
    expect(await readFile(path.join(root, 'src/add.ts'), 'utf8')).toBe(original);
  });
  test('real Jest fails before the patch and passes after, then records a verified commit', async () => {
    const coordinator = await DevGuardianCoordinator.create({ workspaceRoot: root, runners: configurations, sandbox });
    const result = await coordinator.repair({ path: 'src/add.ts', slug: 'real-isolated-fix', message: 'fix: verified isolated addition', runner: 'jest', targets: ['tests/add.test.cjs'],
      expectedFileHashes: { 'src/add.ts': createHash('sha256').update(original).digest('hex') }, unifiedDiff: buildReplacementDiff('src/add.ts', original, fixed) });
    expect(result.status).toBe('committed'); expect(result.commit.branch).toMatch(/^fix\//); expect(result.verification.verdict).toBe('ready_to_commit');
    const evidence = await coordinator.runner.getEvidence(result.verification.verificationId);
    expect(evidence.baseline).toMatchObject({ status: 'failed', complete: true });
    expect(evidence.candidate).toMatchObject({ status: 'passed', complete: true });
    expect(await readFile(path.join(root, 'src/add.ts'), 'utf8')).toBe(fixed);
  });
  test('refuses writes to the source snapshot and hides host secrets and Docker socket', async () => {
    await writeFile(path.join(root, '.env'), 'PRIVATE_TEST_SENTINEL=not-a-real-secret\n');
    await writeFile(path.join(root, 'tests/isolation.test.cjs'), `const fs=require('fs');
      test('no host credentials',()=>{expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.GITHUB_TOKEN).toBeUndefined();expect(fs.existsSync('/workspace/.env')).toBe(false);expect(fs.existsSync('/var/run/docker.sock')).toBe(false);});
      test('source is read only',()=>expect(()=>fs.writeFileSync('/workspace/src/add.ts','changed')).toThrow());
      test('no outbound connection',()=>new Promise((resolve,reject)=>{const s=require('net').createConnection({host:'1.1.1.1',port:80});s.once('connect',()=>{s.destroy();reject(new Error('network escaped'));});s.once('error',()=>resolve());s.setTimeout(300,()=>{s.destroy();resolve();});}));`);
    const runner = await TestRunner.create({ workspaceRoot: root, runners: configurations, workspaceStateHash: async () => 'a'.repeat(64), sandbox });
    const run = await runner.runTests({ runner: 'jest', targets: ['tests/isolation.test.cjs'] });
    expect(run).toMatchObject({ complete: true, status: 'passed', summary: { passed: 3 } });
    expect(await readFile(path.join(root, 'src/add.ts'), 'utf8')).toBe(original);
  });
  test('reverts a candidate that still fails the real tests', async () => {
    const coordinator = await DevGuardianCoordinator.create({ workspaceRoot: root, runners: configurations, sandbox });
    const wrong = 'export const add = (a: number, b: number): number => a * b;\n';
    const result = await coordinator.repair({ path: 'src/add.ts', slug: 'isolated-rollback', message: 'fix: rejected candidate', runner: 'jest', targets: ['tests/add.test.cjs'],
      expectedFileHashes: { 'src/add.ts': createHash('sha256').update(original).digest('hex') }, unifiedDiff: buildReplacementDiff('src/add.ts', original, wrong) });
    expect(result.status).toBe('rolled_back'); expect(result.commit).toBeNull();
    expect(result.verification).not.toBeNull();
    expect(result.verification.verdict).not.toBe('ready_to_commit');
    expect(coordinator.runner.getRun(result.verification.baselineRunId)).toMatchObject({ ok: true, data: { status: 'failed', complete: true, summary: { failed: 1 } } });
    expect(coordinator.runner.getRun(result.verification.candidateRunId)).toMatchObject({ ok: true, data: { status: 'failed', complete: true, summary: { failed: 1 } } });
    expect(await readFile(path.join(root, 'src/add.ts'), 'utf8')).toBe(original);
  });
  test('kills a timed-out test container instead of accepting incomplete evidence', async () => {
    await writeFile(path.join(root, 'tests/hang.test.cjs'), "test('hang',()=>{while(true){}});\n");
    const runner = await TestRunner.create({ workspaceRoot: root, runners: configurations, workspaceStateHash: async () => 'a'.repeat(64), sandbox });
    const run = await runner.runTests({ runner: 'jest', targets: ['tests/hang.test.cjs'], timeoutMs: 500 });
    expect(run.status).toBe('timeout'); expect(run.complete).toBe(false);
  });
});
