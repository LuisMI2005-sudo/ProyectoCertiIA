import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import type { ProcessOptions, ProcessOutcome } from "./types.js";

/** Terminates the child and its descendants without ever using a shell. */
function terminate(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    if (result.error) { try { child.kill("SIGKILL"); } catch { /* already exited */ } }
    return;
  }
  // Children are their own process-group leaders, so the whole group can be killed.
  try { process.kill(-child.pid, "SIGKILL"); }
  catch { try { child.kill("SIGKILL"); } catch { /* already exited */ } }
}

export function runProcess(options: ProcessOptions): Promise<ProcessOutcome> {
  return new Promise<ProcessOutcome>((resolve) => {
    const started = Date.now();
    const limit = Math.max(1, options.maxOutputBytes);
    const child = spawn(options.executable, [...options.args], {
      cwd: options.cwd, env: options.env, shell: false, windowsHide: true,
      detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"]
    });
    const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
    let stdout = "", stderr = "";
    let outBytes = 0, errBytes = 0, truncated = false;
    let timedOut = false, cancelled = false, settled = false;
    let spawnError: string | null = null;

    const capture = (chunk: Buffer | string, stream: "stdout" | "stderr"): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const used = stream === "stdout" ? outBytes : errBytes;
      if (used >= limit) { truncated = true; return; }
      const slice = buffer.subarray(0, limit - used);
      if (buffer.length > slice.length) truncated = true;
      const text = decoders[stream].write(slice);
      if (stream === "stdout") { stdout += text; outBytes += slice.length; }
      else { stderr += text; errBytes += slice.length; }
    };

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      stdout += decoders.stdout.end();
      stderr += decoders.stderr.end();
      // A spawn failure never started a process, so it reports no exit code.
      resolve({ exitCode: spawnError === null ? code : null, signal, timedOut, cancelled, spawnError,
        durationMs: Date.now() - started, stdout, stderr, truncated });
    };

    const onAbort = (): void => { cancelled = true; terminate(child); };
    const timer = setTimeout(() => { timedOut = true; terminate(child); }, options.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => capture(chunk, "stdout"));
    child.stderr?.on("data", (chunk: Buffer | string) => capture(chunk, "stderr"));
    child.on("error", (error: Error) => { spawnError = error.message; });
    child.on("close", (code, signal) => finish(code, signal));

    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
