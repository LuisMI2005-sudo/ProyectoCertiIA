import { z } from "zod";

export const IdeEventSchema = z.object({
  hook_event_name: z.enum(["SessionStart", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop"]),
  cwd: z.string().max(4096).optional(),
  session_id: z.string().max(4096).optional(),
  tool_name: z.string().max(200).optional(),
  tool_input: z.unknown().optional(),
  agent_id: z.string().max(4096).optional(),
  agent_type: z.string().max(200).optional()
});
export type IdeEvent = z.infer<typeof IdeEventSchema>;
export type IdeHookMode = "session" | "files" | "commands" | "verify" | "audit";
export interface IdeHookReply {
  readonly exitCode: 0 | 2;
  readonly reason: string;
  readonly output: Readonly<Record<string, unknown>>;
}
export interface IdeCheckResult { readonly passed: boolean; readonly summary: string }
export interface IdeHookOptions {
  readonly workspaceRoot: string;
  /** Trusted dependency for tests/integration; never taken from hook stdin. */
  readonly check?: (paths: readonly string[]) => Promise<IdeCheckResult>;
}
