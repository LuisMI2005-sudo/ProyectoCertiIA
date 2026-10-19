import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DevGuardianCoordinator } from '../dist/subagents/index.js';

const execute = promisify(execFile);
const outputDirectory = path.resolve(process.argv[2] ?? 'artifacts/subagents');
const jestCli = fileURLToPath(new URL('../node_modules/jest/bin/jest.js', import.meta.url));
const typescript = fileURLToPath(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url));
const original = 'export const add = (a: number, b: number): number => String(a - b);\n';
const target = 'src/bug.ts';
await mkdir(outputDirectory, { recursive: true });
for (const scenario of ['success', 'regression']) {
  const root = await mkdtemp(path.join(process.cwd(), '.subagents-demo-'));
  const git = async (...args) => (await execute('git', args, { cwd: root, timeout: 15000, windowsHide: true })).stdout.trim();
  try {
    await mkdir(path.join(root, 'src')); await mkdir(path.join(root, 'tests'));
    await writeFile(path.join(root, target), original);
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true }, include: ['src/**/*.ts'] }));
    const config = path.join(root, 'jest.config.cjs');
    await writeFile(config, "module.exports = { testEnvironment: 'node', testMatch: ['**/bug.test.cjs'], transform: {}, cache: false };\n");
    await writeFile(path.join(root, 'tests/bug.test.cjs'), [
      "const { readFileSync } = require('node:fs');", "const { runInNewContext } = require('node:vm');",
      `const ts = require(${JSON.stringify(typescript)});`,
      "const compiled = ts.transpileModule(readFileSync('src/bug.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;",
      "const loaded = { exports: {} }; runInNewContext(compiled, { module: loaded, exports: loaded.exports });",
      "test('repairs addition', () => expect(loaded.exports.add(2, 1)).toBe(3));",
      "test('preserves behavior', () => expect(Number(loaded.exports.add(2, 0))).toBe(2));", ''
    ].join('\n'));
    await git('init', '-b', 'main'); await git('config', 'user.name', 'DevGuardian Demo');
    await git('config', 'user.email', 'demo@devguardian.invalid'); await git('config', 'core.autocrlf', 'false');
    await git('config', 'commit.gpgsign', 'false'); await git('add', '.'); await git('commit', '-m', 'Demo baseline');
    const originalHead = await git('rev-parse', 'HEAD');
    const proposed = `export const add = (a: number, b: number): number => a ${scenario === 'success' ? '+' : '*'} b;\n`;
    const unifiedDiff = [`diff --git a/${target} b/${target}`, `--- a/${target}`, `+++ b/${target}`, '@@ -1 +1 @@',
      `-${original.trimEnd()}`, `+${proposed.trimEnd()}`, ''].join('\n');
    const coordinator = await DevGuardianCoordinator.create({ workspaceRoot: root, runners: [{
      runner: 'jest', executable: process.execPath, args: [jestCli, '--config', config, '--runInBand'], timeoutMs: 30000, maxOutputBytes: 100000
    }] });
    const result = await coordinator.repair({ path: target, slug: `demo-${scenario}`, message: 'Delegated repair demo', unifiedDiff,
      expectedFileHashes: { [target]: createHash('sha256').update(original).digest('hex') }, runner: 'jest', targets: ['tests/bug.test.cjs'] });
    const currentHead = await git('rev-parse', 'HEAD');
    const expectedStatus = scenario === 'success' ? 'committed' : 'rolled_back';
    if (result.status !== expectedStatus) throw new Error(`Unexpected demo result: ${JSON.stringify(result)}`);
    const restored = await readFile(path.join(root, target), 'utf8');
    if (scenario === 'regression' && (currentHead !== originalHead || restored !== original)) throw new Error('Rollback evidence does not match original workspace.');
    const evidence = {
      scenario, generatedAt: new Date().toISOString(), originalHead, currentHead,
      result, delegationSummary: coordinator.delegationStore.getDelegationSummary(),
      delegationLogs: coordinator.delegationStore.getDelegationLogs(),
      hookConfig: coordinator.hooks.getConfig(), hookLogs: coordinator.hooks.getHookLogs(), hookAudits: coordinator.hooks.logStore.getAuditLogs()
    };
    const artifact = path.join(outputDirectory, `${scenario}.json`);
    await writeFile(artifact, JSON.stringify(evidence, null, 2) + '\n');
    console.log(`${scenario}: ${result.status}; ${evidence.delegationSummary.tasks} delegated tasks, ${evidence.delegationSummary.toolCalls} real tool calls -> ${artifact}`);
  } finally {
    // Only remove the exact mkdtemp-created directory inside this workspace.
    const resolvedRoot = path.resolve(root);
    if (path.dirname(resolvedRoot) !== process.cwd() || !path.basename(resolvedRoot).startsWith('.subagents-demo-')) throw new Error('Unexpected demo cleanup path.');
    await rm(resolvedRoot, { recursive: true, force: true });
  }
}
