import { parentPort, workerData } from "node:worker_threads";
import { DiagnosticSubagent, VerificationSubagent, PatchSafetySubagent } from "./specialists.js";
import { ContextSchemas, TaskEnvelopeSchema } from "./types.js";
import type { SubagentToolClient } from "./specialists.js";

const port = parentPort;
if (!port) throw new Error("Specialists must run inside a delegated worker.");
let nextId = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
port.on("message", (message: { type: string; id: number; ok: boolean; output?: unknown; reason?: string }) => {
  if (message.type !== "tool_result") return;
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.ok) callback.resolve(message.output);
  else callback.reject(new Error(message.reason ?? "Tool invocation rejected."));
});
const tools: SubagentToolClient = {
  call(name, input) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      port.postMessage({ type: "tool", id, name, input });
    });
  }
};
try {
  const task = TaskEnvelopeSchema.parse(workerData);
  const output = task.role === "diagnostic"
    ? await new DiagnosticSubagent().execute(ContextSchemas.diagnostic.parse(task.scopedContext), tools)
    : task.role === "verification"
      ? await new VerificationSubagent().execute(ContextSchemas.verification.parse(task.scopedContext), tools)
      : await new PatchSafetySubagent().execute(ContextSchemas["patch-safety"].parse(task.scopedContext), tools);
  port.postMessage({ type: "done", output });
} catch {
  // Domain reasons are retained in the host tool journal, without leaking worker internals.
  port.postMessage({ type: "failed", reason: "Specialist could not complete its delegated task." });
}
