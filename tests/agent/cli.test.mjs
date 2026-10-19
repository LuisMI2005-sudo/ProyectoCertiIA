import { afterEach, describe, expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
let root;
async function git(...args) {
  return execute('git', args, { cwd: root, timeout: 15000, maxBuffer: 1_000_000 });
}

afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe('agent CLI safety preflight', () => {
  test('detects missing Phase 4 tools before creating a repair branch', async () => {
    root = await mkdtemp(path.join(process.cwd(), '.phase6-test-'));
    await git('init', '-b', 'main');
    await git('config', 'user.name', 'Phase Six Test');
    await git('config', 'user.email', 'phase6@example.test');
    await writeFile(path.join(root, 'sample.ts'), 'export const value = 1;\n');
    await git('add', '.');
    await git('commit', '-m', 'test fixture');
    const request = path.join(root, 'request.json');
    await writeFile(request, JSON.stringify({ slug: 'repair', analysis: { paths: ['sample.ts'], checks: ['syntax'] }, runner: 'jest' }));

    await expect(execute(process.execPath, ['dist/agent/cli.js'], {
      cwd: process.cwd(), timeout: 30000, maxBuffer: 1_000_000,
      env: { ...process.env, DEVGUARDIAN_WORKSPACE: root, DEVGUARDIAN_REPAIR_REQUEST: request,
        DEVGUARDIAN_MCP_COMMAND: process.execPath,
        DEVGUARDIAN_MCP_ARGS: JSON.stringify([path.resolve('dist/mcp-server/index.js')]),
        ANTHROPIC_API_KEY: '' }
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('run_tests, compare_test_runs') });

    expect((await git('branch', '--show-current')).stdout.trim()).toBe('main');
    expect((await git('branch', '--list', 'fix/*')).stdout.trim()).toBe('');
  });
});
