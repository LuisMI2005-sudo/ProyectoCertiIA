import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { simpleGit } from "simple-git";
import { ErrorCode, hasSystemErrorCode } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { runProcess } from "../test-runner/process.js";
import { HttpError } from "./contracts.js";
import { inspectImportTree } from "./project-import.js";

export interface WorkspaceState {
  readonly exists: boolean;
  readonly available: boolean;
  readonly headCommit: string | null;
  readonly branch: string | null;
}
export interface WorkspaceCloneResult {
  readonly headCommit: string;
  readonly branch: string;
  readonly files: number;
}
export interface CloneWorkspaceOptions {
  readonly workspaceRoot: string;
  readonly destination: string;
  readonly url: string;
  readonly branch: string;
  readonly replaceExisting: boolean;
}

/** A registered workspace is usable only when it is the canonical top level of its own Git repository. */
export async function inspectWorkspace(destination: string): Promise<WorkspaceState> {
  try {
    await lstat(destination);
  } catch (error: unknown) {
    if (hasSystemErrorCode(error, "ENOENT")) return { exists: false, available: false, headCommit: null, branch: null };
    throw new HttpError(409, "No se pudo inspeccionar el workspace del proyecto.", ErrorCode.WORKSPACE_UNAVAILABLE);
  }
  try {
    const guard = await WorkspacePathGuard.create(destination);
    const git = simpleGit({ baseDir: guard.root, timeout: { block: 10000 } });
    const top = (await git.revparse(["--show-toplevel"])).trim();
    if ((await WorkspacePathGuard.create(top)).root !== guard.root) throw new Error();
    const headCommit = (await git.revparse(["HEAD"])).trim();
    const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    return { exists: true, available: true, headCommit, branch };
  } catch {
    return { exists: true, available: false, headCommit: null, branch: null };
  }
}

/**
 * Clones into a sibling temporary directory, validates the tree and only then replaces the
 * destination. Git and credential helpers run without the backend environment or user config.
 */
export async function cloneWorkspace(options: CloneWorkspaceOptions): Promise<WorkspaceCloneResult> {
  const guard = await WorkspacePathGuard.create(options.workspaceRoot);
  const relative = path.relative(guard.root, options.destination);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new HttpError(403, "El workspace registrado está fuera de las raíces permitidas.", ErrorCode.PATH_OUTSIDE_WORKSPACE);
  }
  const parent = path.dirname(options.destination);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.reclone-${randomUUID()}`);
  const env: NodeJS.ProcessEnv = { PATH: process.env["PATH"], SystemRoot: process.env["SystemRoot"], TEMP: process.env["TEMP"],
    HOME: guard.root, USERPROFILE: guard.root, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" };
  const git = async (args: readonly string[], cwd: string): Promise<string> => {
    const result = await runProcess({ executable: "git",
      args: ["-c", "core.hooksPath=/dev/null", "-c", "credential.helper=", "-c", "protocol.file.allow=never", ...args],
      cwd, env, timeoutMs: 90000, maxOutputBytes: 2_000_000 });
    if (result.exitCode !== 0 || result.timedOut || result.cancelled || result.truncated || result.spawnError) throw new Error("Git failed.");
    return result.stdout;
  };
  try {
    await git(["clone", "--depth=1", "--single-branch", "--branch", options.branch, "--no-checkout", "--template=", "--",
      options.url, temporary], guard.root);
    const files = inspectImportTree(await git(["ls-tree", "-rlz", "HEAD"], temporary));
    await git(["-c", "core.symlinks=false", "checkout", "--force", "HEAD", "--", "."], temporary);
    const headCommit = (await git(["rev-parse", "HEAD"], temporary)).trim();
    const branch = (await git(["symbolic-ref", "--short", "HEAD"], temporary)).trim();
    try {
      const metadata = await lstat(options.destination);
      if (metadata.isSymbolicLink()) throw new HttpError(409, "El workspace no se puede reemplazar de forma segura.", ErrorCode.WORKSPACE_UNAVAILABLE);
      if (!options.replaceExisting) throw new HttpError(409, "El workspace ya existe y no será reemplazado.", ErrorCode.WORKSPACE_UNAVAILABLE);
      await rm(options.destination, { recursive: true, force: true });
    } catch (error: unknown) {
      if (!hasSystemErrorCode(error, "ENOENT") && !(error instanceof HttpError)) throw error;
      if (error instanceof HttpError) throw error;
    }
    await rename(temporary, options.destination);
    return { headCommit, branch, files: files.length };
  } catch (error: unknown) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "No se pudo reclonar el repositorio. Comprueba que la URL y la rama sigan siendo accesibles y que Git esté disponible.",
      ErrorCode.REPOSITORY_ERROR);
  }
}
