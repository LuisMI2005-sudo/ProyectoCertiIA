import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { captureResult, DevGuardianError, ValidationError } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { runProcess } from "../test-runner/process.js";
import { EDIT_TOOLS, enforceCommandPolicy, enforceEditPolicy, resolveEditPaths } from "./policy.js";
import { IdeEventSchema } from "./types.js";
import type { IdeCheckResult, IdeEvent, IdeHookMode, IdeHookOptions, IdeHookReply } from "./types.js";

export * from "./types.js";
export { enforceCommandPolicy, enforceEditPolicy, editPaths } from "./policy.js";
function redact(text: string): string {
  let result = text;
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length > 5 && /(?:TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL)/iu.test(name)) result = result.replaceAll(value, "[REDACTED]");
  }
  return result.replace(/(?:sk-|gh[pousr]_)[A-Za-z0-9_-]{16,}/gu, "[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[REDACTED]")
    .replace(/((?:SECRET_KEY|PASSWORD|API_KEY|TOKEN)\s*[:=]\s*)[^\r\n,;]+/giu, "$1[REDACTED]").slice(-5000);
}
const identity = (value: string | undefined): string | null => value
  ? createHash("sha256").update(value).digest("hex").slice(0, 24) : null;
const safeName = (value: string | undefined): string | null => value && /^[\w.:-]{1,200}$/u.test(value) && redact(value) === value ? value : null;
async function audit(root: string, event: IdeEvent, mode: IdeHookMode, decision: "allow" | "block", reason: string): Promise<void> {
  const guard = await WorkspacePathGuard.create(root);
  const folder = await guard.resolve(".devguardian", { operation: "write", mustExist: false, kind: "directory" });
  if (!folder.exists) await mkdir(folder.absolutePath, { mode: 0o700, recursive: true });
  const file = await guard.resolve(".devguardian/ide-audit.jsonl", { operation: "write", mustExist: false });
  const handle = await open(file.absolutePath, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.nlink !== 1 || stats.size > 5_000_000) throw new ValidationError("El log de IA requiere revision o archivo manual.");
    await handle.writeFile(JSON.stringify({ timestamp: new Date().toISOString(), event: event.hook_event_name, mode,
      tool: safeName(event.tool_name), agentType: safeName(event.agent_type), session: identity(event.session_id),
      agent: identity(event.agent_id), decision, reason: redact(reason) }) + "\n");
  } finally { await handle.close(); }
}
/** Fixed project commands; neither commands nor executables are accepted from hook stdin. */
export async function checkIdeChanges(root: string, files: readonly string[]): Promise<IdeCheckResult> {
  const affected = files.filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(file));
  if (!affected.length) return { passed: true, summary: "Sin cambios ejecutables; no se requieren pruebas automaticas." };
  const guard = await WorkspacePathGuard.create(root);
  const areas = new Set(affected.map((file) => file.split("/")[1]));
  const mapping: Record<string, string> = { shared: "tests/shared.test.mjs", analyzer: "tests/analyzer",
    "git-controller": "tests/git-controller", "test-runner": "tests/test-runner", hooks: "tests/hooks",
    subagents: "tests/subagents", db: "tests/db", server: "tests/server", mcp: "tests/server",
    "mcp-server": "tests/mcp-server", "agent-client": "tests/agent-client", "ide-integration": "tests/ide-integration" };
  const targets = affected.every((file) => file.startsWith("src/") && mapping[file.split("/")[1] ?? ""] !== undefined)
    && !areas.has("shared") ? [...new Set([...areas].map((area) => mapping[area ?? ""]).filter((value): value is string => Boolean(value)))] : [];
  const commands: readonly { file: string; args: readonly string[] }[] = [
    { file: "node_modules/typescript/bin/tsc", args: ["-p", "tsconfig.json"] },
    { file: "scripts/copy-db-schema.mjs", args: [] },
    { file: "node_modules/eslint/bin/eslint.js", args: ["--no-config-lookup", "--ext", ".ts", "--parser", "@typescript-eslint/parser",
      "--plugin", "@typescript-eslint", "--rule", "@typescript-eslint/no-explicit-any:error", "--rule", "@typescript-eslint/no-unused-vars:error", "src"] },
    { file: "node_modules/jest/bin/jest.js", args: ["--runInBand", ...targets] }
  ];
  const started = performance.now();
  for (const command of commands) {
    const executable = await guard.resolve(command.file);
    const remaining = 300_000 - (performance.now() - started);
    if (remaining <= 0) return { passed: false, summary: "Se agoto el presupuesto de verificacion; no afirmar que las pruebas pasaron." };
    const result = await runProcess({ executable: process.execPath,
      args: ["--experimental-vm-modules", executable.absolutePath, ...command.args], cwd: root,
      env: process.env, timeoutMs: Math.floor(remaining), maxOutputBytes: 100_000 });
    if (result.exitCode !== 0 || result.timedOut || result.spawnError || result.cancelled || result.truncated) {
      return { passed: false, summary: redact(`La verificacion fallo o quedo incompleta (${path.basename(command.file)}). ` +
        (result.timedOut ? "Tiempo agotado. " : "") + result.stdout + result.stderr) };
    }
  }
  return { passed: true, summary: `Compilacion, lint y pruebas aprobados${targets.length ? ` para ${targets.join(", ")}` : " en la suite completa"}.` };
}
const EXPECTED: Record<IdeHookMode, readonly IdeEvent["hook_event_name"][]> = {
  session: ["SessionStart"], files: ["PreToolUse"], commands: ["PreToolUse"], verify: ["PostToolUse"],
  audit: ["PostToolUse", "SubagentStart", "SubagentStop"]
};
/** Codex native hook adapter; does not alter REST, MCP contracts, or deterministic workers. */
export function runIdeHook(mode: IdeHookMode, raw: unknown, options: IdeHookOptions): Promise<Result<IdeHookReply>> {
  return captureResult(async () => {
    const event = IdeEventSchema.parse(raw);
    if (!EXPECTED[mode]?.includes(event.hook_event_name)) throw new ValidationError("Evento incompatible con el hook solicitado.");
    const guard = await WorkspacePathGuard.create(options.workspaceRoot);
    let reason = "Evento del asistente registrado.";
    let denied = false;
    try {
      if (mode === "session") {
        if (Number(process.versions.node.split(".")[0]) !== 24) throw new ValidationError("DevGuardian requiere Node.js 24.");
        await guard.resolve("package.json");
        reason = "DevGuardian listo. Protege secretos y pruebas; usa revisor-codigo, depurador, verificador o documentador segun la tarea.";
      } else if (mode === "files") {
        if (!EDIT_TOOLS.has(event.tool_name ?? "")) throw new ValidationError("El protector solo acepta herramientas de edicion conocidas.");
        await enforceEditPolicy(guard.root, event);
        reason = "Edicion autorizada por rutas, archivos protegidos y patrones de secretos.";
      } else if (mode === "commands") {
        if (event.tool_name !== "Bash") throw new ValidationError("El bloqueador requiere el nombre canonico Bash.");
        enforceCommandPolicy(event); reason = "El comando no coincide con patrones bloqueados.";
      } else if (mode === "verify") {
        if (!EDIT_TOOLS.has(event.tool_name ?? "")) throw new ValidationError("La verificacion requiere un evento de edicion.");
        const paths = await resolveEditPaths(guard.root, event);
        const result = await (options.check ?? ((files) => checkIdeChanges(guard.root, files)))(paths);
        reason = redact(result.summary); denied = !result.passed;
      }
    } catch (error: unknown) {
      denied = true;
      // Never forward Zod issues, tool input, arbitrary exception messages or source content.
      reason = error instanceof DevGuardianError ? redact(error.message) : "No se pudo verificar la politica de IA de forma segura.";
    }
    // Verification feedback can contain source excerpts; audit only its outcome.
    const auditReason = mode === "verify" ? (denied ? "Verificacion fallida o incompleta." : "Verificacion aprobada.") : reason;
    await audit(guard.root, event, mode, denied ? "block" : "allow", auditReason);
    const output: Record<string, unknown> = mode === "audit" && event.hook_event_name === "SubagentStop" ? {} : { hookSpecificOutput: { hookEventName: event.hook_event_name,
      ...(mode === "files" || mode === "commands" ? {
        permissionDecision: denied ? "deny" : "allow", permissionDecisionReason: reason
      } : { additionalContext: reason }) }, ...(denied && mode === "verify" ? { decision: "block", reason } : {}) };
    return { exitCode: denied ? 2 : 0, reason, output };
  });
}
