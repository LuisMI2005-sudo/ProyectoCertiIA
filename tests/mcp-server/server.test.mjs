import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { DevGuardianMcpServer } from '../../dist/mcp-server/index.js';

const execFileAsync = promisify(execFile);
let root;
let server;
let client;

async function git(...args) {
  await execFileAsync('git', args, { cwd: root });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(process.cwd(), '.phase5-test-'));
  await cp(path.join(process.cwd(), 'fixtures', 'typescript'), root, { recursive: true });
  await git('init');
  await git('config', 'user.email', 'phase5@example.test');
  await git('config', 'user.name', 'Phase Five');
  await git('add', '.');
  await git('commit', '-m', 'fixture');

  server = await DevGuardianMcpServer.create(root);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'phase5-test-client', version: '1.0.0' });
  await Promise.all([server.mcp.connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client?.close();
  await server?.mcp.close();
  if (root) await rm(root, { recursive: true, force: true });
});

describe('DevGuardian MCP server', () => {
  test('advertises exactly the implemented domain tools and the analysis resource template', async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      'analyze_code', 'get_symbol_context', 'git_apply_patch', 'git_begin_attempt', 'git_commit_fix',
      'git_create_fix_branch', 'git_diff', 'git_rollback_attempt', 'git_status', 'read_file_context'
    ]);
    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates).toEqual(expect.arrayContaining([
      expect.objectContaining({ uriTemplate: 'devguardian://analysis/{analysisId}' })
    ]));
  });

  test('validates inputs and preserves the domain Result envelope in structured MCP output', async () => {
    const rejected = await client.callTool({ name: 'read_file_context', arguments: { path: '../secret.txt' } });
    expect(rejected.isError).toBe(true);

    const response = await client.callTool({
      name: 'analyze_code', arguments: { paths: ['semantic-error.ts'], checks: ['semantic'] }
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ ok: true });
    expect(response.structuredContent.data.analysisId).toEqual(expect.any(String));
  });

  test('serves a stored analysis through the dynamic MCP resource', async () => {
    const response = await client.callTool({
      name: 'analyze_code', arguments: { paths: ['semantic-error.ts'], checks: ['semantic'] }
    });
    const analysisId = response.structuredContent.data.analysisId;
    const resource = await client.readResource({ uri: `devguardian://analysis/${analysisId}` });
    expect(JSON.parse(resource.contents[0].text)).toMatchObject({ ok: true, data: { analysisId } });
  });
});
