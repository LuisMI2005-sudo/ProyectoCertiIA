import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, lstat, copyFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { WorkspacePathGuard, validateWorkspaceRelativePath } from "../shared/path-security.js";
import { TestExecutionError, ValidationError } from "../shared/errors.js";
import { runProcess } from "./process.js";
import type { TestSandbox, SandboxRun, ProcessOutcome } from "./types.js";
import { z } from "zod";

const EXCLUDED = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", ".obsidian", ".codex", ".agents", ".platform-local", ".platform-pg", ".devguardian", ".devguardian-imports"]);
const secretFile = (name: string) => /^\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/iu.test(name);
/** Only a daemon administrator supplies a previously built, immutable image ID. */
export class DockerTestSandbox implements TestSandbox {
  public readonly fingerprint: string;
  public constructor(private readonly executable: string, private readonly imageId: string) {
    if (!executable || !/^sha256:[a-f0-9]{64}$/u.test(imageId)) throw new ValidationError("Sandbox requires a trusted Docker binary and immutable image ID.");
    this.fingerprint = `docker-isolation-v1:${imageId}`;
  }
  public async ready(): Promise<boolean> {
    const environment: NodeJS.ProcessEnv = { ...process.env };
    const engine = await runProcess({ executable: this.executable, args: ["info", "--format", "{{.OSType}}"], cwd: tmpdir(), env: environment, timeoutMs: 5000, maxOutputBytes: 1000 });
    if (engine.exitCode !== 0 || engine.stdout.trim() !== "linux") return false;
    const image = await runProcess({ executable: this.executable, args: ["image", "inspect", "--format", "{{.Id}}", this.imageId], cwd: tmpdir(), env: environment, timeoutMs: 5000, maxOutputBytes: 1000 });
    if (image.exitCode !== 0 || image.stdout.trim() !== this.imageId) return false;
    const schema = await runProcess({ executable: this.executable, args: ["image", "inspect", "--format", '{{index .Config.Labels "org.devguardian.runner.schema"}}', this.imageId], cwd: tmpdir(), env: environment, timeoutMs: 5000, maxOutputBytes: 1000 });
    return schema.exitCode === 0 && schema.stdout.trim() === "1";
  }
  public async run(options: SandboxRun) {
    const source = await WorkspacePathGuard.create(options.workspaceRoot);
    const temporary = await mkdtemp(path.join(tmpdir(), "devguardian-sandbox-"));
    const snapshot = path.join(temporary, "workspace");
    await mkdir(snapshot);
    let files = 0, bytes = 0;
    const name = `devguardian-${randomUUID()}`;
    let started = false, removed = false;
    let outcome: ProcessOutcome | undefined, report: string | undefined;
    const environment = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "USERPROFILE", "HOME", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP", "DOCKER_HOST", "DOCKER_CONTEXT"].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
    async function copy(relative: string): Promise<void> {
      for (const entry of await readdir(path.join(source.root, relative), { withFileTypes: true })) {
        if (EXCLUDED.has(entry.name.toLowerCase()) || secretFile(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new TestExecutionError("Sandbox snapshot refuses symbolic links.");
        const child = relative ? `${relative}/${entry.name}` : entry.name;
        if (child.split("/").length > 20) throw new TestExecutionError("Sandbox snapshot exceeds its depth limit.");
        const verified = await source.resolve(child, { kind: "any" });
        const metadata = await lstat(verified.absolutePath);
        if (metadata.isSymbolicLink() || (!metadata.isDirectory() && (!metadata.isFile() || metadata.nlink !== 1))) throw new TestExecutionError("Sandbox snapshot refuses links and special files.");
        if (metadata.isDirectory()) { await mkdir(path.join(snapshot, child)); await copy(child); }
        else {
          bytes += metadata.size;
          if (++files > 5000 || metadata.size > 10_000_000 || bytes > 100_000_000) throw new TestExecutionError("Sandbox snapshot exceeds its size limit.");
          await copyFile(verified.absolutePath, path.join(snapshot, child));
        }
      }
    }
    try {
      await copy("");
      if (snapshot.includes(",")) throw new ValidationError("Sandbox mount paths cannot contain commas.");
      const args = ["run", "--detach", "--pull=never", "--name", name, "--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
        "--pids-limit=64", "--memory=256m", "--memory-swap=256m", "--cpus=1", "--user=65532:65532", "--workdir=/workspace",
        "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777", "--tmpfs=/reports:rw,noexec,nosuid,nodev,size=16m,mode=1777", "--env=HOME=/tmp", "--env=PYTHONDONTWRITEBYTECODE=1",
        "--mount", `type=bind,source=${snapshot},target=/workspace,readonly`, this.imageId, "idle"];
      started = true;
      const created = await runProcess({ executable: this.executable, args, cwd: temporary, env: environment,
        timeoutMs: 15000, maxOutputBytes: 10000, signal: options.signal });
      if (created.exitCode !== 0 || created.timedOut || created.cancelled) throw new TestExecutionError("The isolated runner could not start.");
      outcome = await runProcess({ executable: this.executable, args: ["exec", name, "node", "/opt/runner/command.mjs", options.runner, ...options.targets], cwd: temporary, env: environment,
        timeoutMs: options.timeoutMs, maxOutputBytes: options.maxOutputBytes, signal: options.signal });
      if (!outcome.timedOut && !outcome.cancelled && outcome.spawnError === null) {
        const exported = await runProcess({ executable: this.executable, args: ["exec", name, "/bin/cat", "/reports/report.json"], cwd: temporary,
          env: environment, timeoutMs: 5000, maxOutputBytes: 16_000_000 });
        if (exported.exitCode === 0 && !exported.truncated) report = exported.stdout;
      }
    } finally {
      if (started) {
        const cleanup = await runProcess({ executable: this.executable, args: ["rm", "--force", name], cwd: temporary,
          env: environment, timeoutMs: 15000, maxOutputBytes: 10000 });
        removed = cleanup.exitCode === 0;
        if (!removed) throw new TestExecutionError("Cannot confirm sandbox termination; verification is refused and snapshot is quarantined.");
      }
      if (!started || removed) {
        if (path.dirname(path.resolve(temporary)) !== path.resolve(tmpdir()) || !path.basename(temporary).startsWith("devguardian-sandbox-")) throw new TestExecutionError("Sandbox cleanup path rejected.");
        await rm(temporary, { recursive: true, force: true });
      }
    }
    if (!outcome) throw new TestExecutionError("No isolated execution result was obtained.");
    if (report !== undefined) {
      if (options.runner === "jest") {
        const parsed = z.object({ testResults: z.array(z.object({ name: z.string() }).passthrough()) }).passthrough().parse(JSON.parse(report) as unknown);
        for (const suite of parsed.testResults) {
          if (!suite.name.startsWith("/workspace/")) throw new TestExecutionError("Sandbox reported a file outside its snapshot.");
          suite.name = path.join(source.root, validateWorkspaceRelativePath(suite.name.slice("/workspace/".length)));
        }
        report = JSON.stringify(parsed);
      }
      await writeFile(options.reportPath, report, { flag: "wx", mode: 0o600 });
    }
    return outcome;
  }
}
