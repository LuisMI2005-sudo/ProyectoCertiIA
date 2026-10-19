import { resultSchema, ToolSchemas } from "../shared/contracts.js";
import type { McpToolClient, ToolInput, ToolName, ToolOutput } from "../shared/contracts.js";
import type { Result } from "../shared/errors.js";
import { AgentError } from "../shared/errors.js";
import { parseContract } from "../shared/contracts.js";

export interface McpCallResult {
  readonly structuredContent?: unknown;
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
  readonly isError?: boolean;
}

export interface McpClientTransport {
  callTool(params: { readonly name: string; readonly arguments: Record<string, unknown> }): Promise<McpCallResult>;
}

/** Converts MCP SDK responses to the strict domain Result<T> contract used by the agent. */
export class SdkMcpToolClient implements McpToolClient {
  public constructor(private readonly client: McpClientTransport) {}

  public async callTool<T extends ToolName>(name: T, input: ToolInput<T>): Promise<Result<ToolOutput<T>>> {
    let response: McpCallResult;
    try {
      response = await this.client.callTool({ name, arguments: input as Record<string, unknown> });
    } catch (error: unknown) {
      throw new AgentError(`MCP transport failed while calling ${name}.`, { cause: error, retryable: true });
    }

    let payload = response.structuredContent;
    if (payload === undefined) {
      const text = response.content?.find((block) => block.type === "text")?.text;
      if (text === undefined || text.length > 1_000_000) throw new AgentError(`MCP tool ${name} returned no bounded structured result.`);
      try { payload = JSON.parse(text) as unknown; }
      catch (error: unknown) { throw new AgentError(`MCP tool ${name} returned invalid JSON.`, { cause: error }); }
    }

    const schema = resultSchema(ToolSchemas[name].output);
    const result = parseContract(schema, payload) as Result<ToolOutput<T>>;
    if (response.isError && result.ok) throw new AgentError(`MCP tool ${name} reported an error without a domain error result.`);
    return result;
  }
}
