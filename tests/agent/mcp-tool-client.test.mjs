import { describe, expect, jest, test } from '@jest/globals';
import { SdkMcpToolClient } from '../../dist/agent/index.js';

const status = { branch: 'main', headCommit: 'a'.repeat(40), clean: true,
  staged: [], modified: [], untracked: [], conflicted: [] };

describe('SdkMcpToolClient', () => {
  test('validates and returns MCP structured content', async () => {
    const mcp = { callTool: jest.fn(async () => ({ structuredContent: { ok: true, data: status } })) };
    const client = new SdkMcpToolClient(mcp);
    await expect(client.callTool('git_status', {})).resolves.toEqual({ ok: true, data: status });
    expect(mcp.callTool).toHaveBeenCalledWith({ name: 'git_status', arguments: {} });
  });

  test('supports text-only MCP responses while enforcing domain output contracts', async () => {
    const client = new SdkMcpToolClient({ callTool: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ ok: false, error: {
        code: 'WORKTREE_DIRTY', message: 'Workspace is dirty.', retryable: false
      } }) }], isError: true
    }) });
    await expect(client.callTool('git_status', {})).resolves.toMatchObject({ ok: false, error: { code: 'WORKTREE_DIRTY' } });
  });

  test('rejects malformed responses, invalid JSON and error flags without error envelopes', async () => {
    const malformed = new SdkMcpToolClient({ callTool: async () => ({ structuredContent: { ok: true, data: { clean: true } } }) });
    await expect(malformed.callTool('git_status', {})).rejects.toThrow();
    const invalidJson = new SdkMcpToolClient({ callTool: async () => ({ content: [{ type: 'text', text: 'not-json' }] }) });
    await expect(invalidJson.callTool('git_status', {})).rejects.toThrow('invalid JSON');
    const flagged = new SdkMcpToolClient({ callTool: async () => ({ structuredContent: { ok: true, data: status }, isError: true }) });
    await expect(flagged.callTool('git_status', {})).rejects.toThrow('without a domain error');
  });

  test('wraps connection failures without leaking arbitrary provider errors', async () => {
    const client = new SdkMcpToolClient({ callTool: async () => { throw new Error('socket reset'); } });
    await expect(client.callTool('git_status', {})).rejects.toMatchObject({ code: 'AGENT_ERROR', retryable: true });
  });
});
