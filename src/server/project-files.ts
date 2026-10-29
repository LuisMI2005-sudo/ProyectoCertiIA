import { opendir, lstat } from "node:fs/promises";
import { ErrorCode } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { HttpError } from "./contracts.js";

export interface ProjectFile { readonly path: string; readonly analyzable: boolean }
/** Bounded directory walk. Never follows symlinks or exposes secrets/Git metadata. */
export async function listProjectFiles(root: string): Promise<{ files: ProjectFile[]; truncated: boolean }> {
  let guard: WorkspacePathGuard;
  try { guard = await WorkspacePathGuard.create(root); }
  catch { throw new HttpError(409, "Los archivos del proyecto no están disponibles en el servidor. Usa Reclonar Workspace para restaurarlos sin crear un proyecto duplicado.", ErrorCode.WORKSPACE_UNAVAILABLE); }
  const files: ProjectFile[] = [];
  const excluded = /^(?:\.git|\.env(?:\..*)?|node_modules|dist|build|coverage|\.venv|venv|__pycache__|\.devguardian.*|\.codex|\.claude|\.opencode|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu;
  const text = /\.(?:[cm]?[jt]s|[jt]sx|json|md|txt|py|ya?ml|html|css|sql|toml)$/iu;
  let visited = 0, truncated = false;
  const started = Date.now();
  const walk = async (directory: string, prefix: string, depth: number): Promise<void> => {
    if (depth > 15) { truncated = true; return; }
    for await (const entry of await opendir(directory)) {
      if (++visited > 10000 || files.length >= 2000 || Date.now() - started > 8000) { truncated = true; return; }
      if (excluded.test(entry.name) || entry.isSymbolicLink()) continue;
      if (!entry.isDirectory() && (!entry.isFile() || !text.test(entry.name) || /(?:private|secret|credential|password|token)[_.-]/iu.test(entry.name))) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      try {
        const file = await guard.resolve(relative, { kind: "any" });
        const metadata = await lstat(file.absolutePath);
        if (metadata.isSymbolicLink() || (metadata.isFile() && metadata.nlink > 1)) continue;
        if (entry.isDirectory()) await walk(file.absolutePath, relative, depth + 1);
        else if (metadata.isFile() && metadata.size <= 2_000_000) files.push({ path: relative, analyzable: /\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(relative) });
      } catch { truncated = true; }
    }
  };
  await walk(guard.root, "", 0);
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), truncated };
}
