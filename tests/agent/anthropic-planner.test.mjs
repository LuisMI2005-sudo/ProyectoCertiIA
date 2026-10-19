import { describe, expect, jest, test } from '@jest/globals';
import { AnthropicRepairPlanner } from '../../dist/agent/index.js';

const context = {
  input: { slug: 'repair', analysis: { paths: ['calc.ts'], checks: ['semantic'] }, runner: 'jest' },
  analysis: { analysisId: '00000000-0000-4000-8000-000000000001', diagnostics: [], affectedSymbols: [], dependencies: [], analyzedFiles: ['calc.ts'], truncated: false },
  baseline: { runId: '00000000-0000-4000-8000-000000000002', cases: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0 } },
  attempt: { attemptId: '00000000-0000-4000-8000-000000000003', checkpointCommit: 'a'.repeat(40) },
  attemptNumber: 1,
  fileContexts: [{ path: 'calc.ts', content: 'export const add = (a, b) => a - b;', startLine: 1, endLine: 1,
    fileHash: 'b'.repeat(64), truncated: false }]
};
const plan = { summary: 'Fix addition', unifiedDiff: 'diff --git a/calc.ts b/calc.ts', expectedFileHashes: { 'calc.ts': 'b'.repeat(64) } };

describe('AnthropicRepairPlanner', () => {
  test('uses constrained tool output and validates the returned plan', async () => {
    const fetch = jest.fn(async (_url, request) => {
      const body = JSON.parse(request.body);
      expect(body.tools[0].name).toBe('submit_repair_plan');
      expect(body.tool_choice.name).toBe('submit_repair_plan');
      expect(JSON.parse(body.messages[0].content).sourceFiles[0].fileHash).toBe('b'.repeat(64));
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_repair_plan', input: plan }] }), { status: 200 });
    });
    const planner = new AnthropicRepairPlanner({ apiKey: 'test-key', fetch });
    await expect(planner.propose(context)).resolves.toEqual(plan);
    expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.any(Object));
  });

  test('rejects absent credentials, invalid token limits, provider failures and malformed plans', async () => {
    expect(() => new AnthropicRepairPlanner({ apiKey: '' })).toThrow('ANTHROPIC_API_KEY');
    expect(() => new AnthropicRepairPlanner({ apiKey: 'test-key', maxTokens: 10 })).toThrow('maxTokens');
    const unavailable = new AnthropicRepairPlanner({ apiKey: 'test-key', fetch: async () => new Response('no', { status: 503 }) });
    await expect(unavailable.propose(context)).rejects.toThrow('HTTP 503');
    const malformed = new AnthropicRepairPlanner({ apiKey: 'test-key', fetch: async () => new Response(
      JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_repair_plan', input: { ...plan, extra: true } }] }), { status: 200 }) });
    await expect(malformed.propose(context)).rejects.toThrow();
  });
});
