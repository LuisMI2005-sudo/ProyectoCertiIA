import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { ServerResponse } from "node:http";
import { z } from "zod";
import ts from "typescript";
import { WorkspacePathGuard, validateWorkspaceRelativePath } from "../shared/path-security.js";
import { runProcess } from "../test-runner/process.js";
import type { ProjectRecord } from "../db/types.js";
import { HttpError } from "./contracts.js";

export const ImportProjectSchema = z.strictObject({ url: z.string().trim().max(300).transform((raw, ctx) => {
  try {
    const url = new URL(raw);
    const match = /^\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/u.exec(url.pathname);
    if (url.protocol !== "https:" || url.host !== "github.com" || url.username || url.password || url.search || url.hash || !match || match[2] === "." || match[2] === "..") throw new Error();
    return `https://github.com/${match[1]}/${match[2]}.git`;
  } catch { ctx.addIssue({ code: "custom", message: "Usa https://github.com/propietario/repositorio, sin credenciales ni parámetros." }); return z.NEVER; }
}) });
export interface CompatibilityIssue { readonly path: string; readonly code: string; readonly message: string }
export interface Compatibility {
  readonly compatible: boolean; readonly scope: "static-analysis"; readonly entryFile: string | null;
  readonly missing: readonly CompatibilityIssue[]; readonly warnings: readonly CompatibilityIssue[];
}
const object = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Inspection only: never loads a config module or runs repository code. */
export async function validateImportedProject(root: string, files: readonly string[]): Promise<Compatibility> {
  const guard = await WorkspacePathGuard.create(root);
  const missing: CompatibilityIssue[] = [], warnings: CompatibilityIssue[] = [];
  const source = files.filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(file) && !/(?:^|\/)(?:node_modules|dist|vendor)\//u.test(file));
  const entryFile = source.find((file) => !/(?:\.test\.|\.spec\.|\.config\.|\.d\.ts$)/u.test(file)) ?? source[0] ?? null;
  if (!entryFile) missing.push({ path: "*.ts / *.js", code: "NO_SUPPORTED_SOURCE", message: "El analizador actual necesita código JavaScript o TypeScript; Python solo tiene soporte de pruebas." });
  let manifest: Record<string, unknown> = {};
  if (!files.includes("package.json")) missing.push({ path: "package.json", code: "MISSING_MANIFEST", message: "Falta el manifiesto Node.js en la raíz. Los monorepos deben exponer su proyecto desde esta raíz." });
  else {
    try {
      const file = await guard.resolve("package.json");
      if ((await stat(file.absolutePath)).size > 1_000_000) throw new Error();
      const raw: unknown = JSON.parse(await readFile(file.absolutePath, "utf8"));
      manifest = object(raw);
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error();
    } catch { missing.push({ path: "package.json", code: "INVALID_MANIFEST", message: "El manifiesto debe ser un objeto JSON válido de hasta 1 MB." }); }
  }
  if (source.some((file) => /\.(?:[cm]?ts|tsx)$/iu.test(file)) && !files.includes("tsconfig.json"))
    missing.push({ path: "tsconfig.json", code: "MISSING_TYPESCRIPT_CONFIG", message: "Falta tsconfig.json para resolver tipos, imports y opciones del proyecto TypeScript." });
  if (files.includes("tsconfig.json")) {
    try {
      const config = await guard.resolve("tsconfig.json");
      if ((await stat(config.absolutePath)).size > 1_000_000) throw new Error();
      const parsed = ts.parseConfigFileTextToJson("tsconfig.json", await readFile(config.absolutePath, "utf8"));
      const configValue: unknown = parsed.config;
      if (parsed.error || typeof configValue !== "object" || configValue === null || Array.isArray(configValue)) throw new Error();
    } catch { missing.push({ path: "tsconfig.json", code: "INVALID_TYPESCRIPT_CONFIG", message: "tsconfig.json debe contener una configuración JSON/JSONC válida de hasta 1 MB." }); }
  }
  const deps = { ...object(manifest["dependencies"]), ...object(manifest["devDependencies"]) };
  if (!("jest" in deps)) warnings.push({ path: "package.json", code: "JEST_NOT_DECLARED", message: "No se declaró Jest. La importación habilita análisis estático, no certifica compatibilidad de pruebas." });
  if (!files.some((file) => /^(?:eslint\.config\.|\.eslintrc)/u.test(file))) warnings.push({ path: "eslint.config.*", code: "LINT_CONFIG_NOT_FOUND", message: "No se encontró configuración ESLint en la raíz. Se aplicarán las reglas internas de DevGuardian, sin ejecutar configuraciones del repositorio." });
  warnings.push({ path: "node_modules", code: "DEPENDENCIES_NOT_INSTALLED", message: "No se instalaron dependencias ni ejecutaron scripts. Pueden aparecer imports o tipos sin resolver; las pruebas requieren un entorno aislado preparado por un administrador." });
  return { compatible: missing.length === 0, scope: "static-analysis", entryFile, missing, warnings };
}

/** ls-tree runs before checkout: reject symlinks, submodules, traversal and oversized trees. */
export function inspectImportTree(output: string): string[] {
  const entries = output.split("\0").filter(Boolean);
  if (entries.length > 10000) throw new HttpError(422, "El repositorio supera 10.000 archivos.");
  let bytes = 0;
  return entries.map((entry) => {
    const match = /^(100644|100755) blob [a-f0-9]+\s+(\d+)\t([^\0]+)$/u.exec(entry);
    if (!match) throw new HttpError(422, "No se admiten enlaces simbólicos, submódulos ni entradas especiales.");
    const file = validateWorkspaceRelativePath(match[3] ?? "");
    const size = Number(match[2]); bytes += size;
    if (size > 2_000_000 || bytes > 25_000_000) throw new HttpError(422, "Límite: 2 MB por archivo y 25 MB de contenido.");
    return file;
  });
}

export class ProjectImporter {
  private busy = false;
  public constructor(private readonly root: string, private readonly register: (raw: unknown) => Promise<ProjectRecord>) {}
  public async stream(raw: unknown, response: ServerResponse): Promise<void> {
    const parsed = ImportProjectSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError(422, "Usa un enlace HTTPS de un repositorio público de GitHub, sin credenciales ni parámetros.");
    if (this.busy) throw new HttpError(429, "Ya se está importando un proyecto. Espera a que termine.");
    this.busy = true;
    const abort = new AbortController();
    let destination: string | undefined, destinationParent: string | undefined, retained = false;
    const disconnect = (): void => { if (!response.writableEnded) abort.abort(); };
    response.once("close", disconnect);
    response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
    response.flushHeaders();
    const emit = (event: string, data: unknown): void => {
      if (!response.destroyed && !response.writableEnded) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = setInterval(() => { if (!response.destroyed) response.write(": keep-alive\n\n"); }, 10000);
    const deadline = setTimeout(() => abort.abort(), 180000);
    let checkingDisk = false;
    const diskLimit = setInterval(() => {
      if (!destination || checkingDisk) return;
      checkingDisk = true;
      const measure = async (directory: string): Promise<number> => {
        let total = 0;
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const target = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) throw new Error();
          total += entry.isDirectory() ? await measure(target) : (await stat(target)).size;
          if (total > 100_000_000) throw new Error();
        }
        return total;
      };
      void measure(destination).catch((error: unknown) => {
        // Git atomically renames temporary pack/index files; disappearance is normal.
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) abort.abort();
      }).finally(() => { checkingDisk = false; });
    }, 2000);
    try {
      const guard = await WorkspacePathGuard.create(this.root);
      const folder = await guard.resolve(".devguardian-imports", { mustExist: false, kind: "directory", operation: "write" });
      await mkdir(folder.absolutePath, { recursive: true });
      // Bound retained storage across restarts, not just per process.
      if ((await readdir(folder.absolutePath)).length >= 10) throw new HttpError(429, "Capacidad de importaciones alcanzada (10). Solicita limpieza al administrador.");
      destinationParent = folder.absolutePath;
      destination = path.join(folder.absolutePath, randomUUID());
      const env: NodeJS.ProcessEnv = { PATH: process.env["PATH"], SystemRoot: process.env["SystemRoot"], TEMP: process.env["TEMP"],
        HOME: folder.absolutePath, USERPROFILE: folder.absolutePath, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" };
      const git = async (args: readonly string[], cwd: string): Promise<string> => {
        if (abort.signal.aborted) throw new Error();
        const result = await runProcess({ executable: "git", args: ["-c", "core.hooksPath=/dev/null", "-c", "credential.helper=", "-c", "protocol.file.allow=never", ...args],
          cwd, env, signal: abort.signal, timeoutMs: 90000, maxOutputBytes: 2_000_000 });
        if (result.exitCode !== 0 || result.timedOut || result.cancelled || result.truncated || result.spawnError) throw new Error();
        return result.stdout;
      };
      emit("progress", { phase: "cloning", message: "Descargando el repositorio público desde GitHub…" });
      await git(["clone", "--depth=1", "--single-branch", "--no-checkout", "--template=", "--", parsed.data.url, destination], this.root);
      emit("progress", { phase: "inspecting", message: "Descarga terminada. Revisando rutas, tipos y tamaños de archivos…" });
      const files = inspectImportTree(await git(["ls-tree", "-rlz", "HEAD"], destination));
      await git(["-c", "core.symlinks=false", "checkout", "--force", "HEAD", "--", "."], destination);
      emit("progress", { phase: "validating", message: "Validando compatibilidad y configuraciones, sin ejecutar el código…" });
      const validation = await validateImportedProject(destination, files);
      if (!validation.compatible) { emit("incompatible", validation); return; }
      const branch = (await git(["symbolic-ref", "--short", "HEAD"], destination)).trim();
      if (abort.signal.aborted) return;
      emit("progress", { phase: "registering", message: "Guardando el proyecto para su análisis…" });
      const project = await this.register({ name: parsed.data.url.split("/").at(-1)?.replace(/\.git$/u, "") ?? "GitHub", repoPath: destination,
        defaultBranch: branch, runnerType: "jest", sourceUrl: parsed.data.url });
      retained = true;
      emit("ready", { project, validation });
    } catch (error: unknown) {
      emit("failed", { message: error instanceof HttpError ? error.message : "No se pudo preparar el repositorio. Comprueba que sea público, accesible y que Git esté disponible. También puede haberse agotado el tiempo de descarga." });
    } finally {
      clearInterval(heartbeat); clearInterval(diskLimit); clearTimeout(deadline); response.off("close", disconnect);
      if (destination && destinationParent && !retained) {
        // Only the fresh UUID directory owned by this request may be removed.
        if (path.dirname(destination) === destinationParent && /^[a-f0-9-]{36}$/u.test(path.basename(destination))) {
          await rm(destination, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
        }
      }
      this.busy = false;
      if (!response.destroyed) response.end();
    }
  }
}
