import path from "node:path";
import { z } from "zod";
import { createHookManager, DEFAULT_HOOK_CONFIG } from "../hooks/index.js";
import { ValidationError } from "../shared/errors.js";
import { validateWorkspaceRelativePath, WorkspacePathGuard } from "../shared/path-security.js";
import type { IdeEvent } from "./types.js";

const ToolInputSchema = z.object({
  command: z.string().max(1_000_000).optional(),
  file_path: z.string().max(4096).optional(),
  new_string: z.string().max(1_000_000).optional(),
  content: z.string().max(1_000_000).optional()
});
export const EDIT_TOOLS = new Set(["apply_patch", "Edit", "Write"]);
export function toolInput(event: IdeEvent): z.infer<typeof ToolInputSchema> {
  const result = ToolInputSchema.safeParse(event.tool_input);
  if (!result.success) throw new ValidationError("La herramienta no contiene una entrada valida para el hook.");
  return result.data;
}
export function editPaths(event: IdeEvent): string[] {
  const input = toolInput(event);
  if (event.tool_name !== "apply_patch") {
    if (!input.file_path) throw new ValidationError("La edicion no identifica el archivo destino.");
    return [input.file_path];
  }
  if (!input.command || !input.command.startsWith("*** Begin Patch") || !input.command.trimEnd().endsWith("*** End Patch")) {
    throw new ValidationError("El hook requiere un parche apply_patch completo.");
  }
  const files = [...input.command.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)\r?$/gmu)]
    .map((match) => match[1]?.trim()).filter((value): value is string => Boolean(value));
  if (!files.length || files.length > 200) throw new ValidationError("El parche no identifica archivos o excede el limite.");
  return [...new Set(files)];
}
export async function resolveEditPaths(root: string, event: IdeEvent): Promise<string[]> {
  const guard = await WorkspacePathGuard.create(root);
  const cwd = path.resolve(event.cwd ?? root);
  const cwdRelative = path.relative(guard.root, cwd);
  if (cwdRelative) await guard.resolve(cwdRelative, { kind: "directory" });
  const result: string[] = [];
  for (const file of editPaths(event)) {
    if (file.replaceAll("\\", "/").split("/").includes("..")) throw new ValidationError("El parche contiene traversal de rutas.");
    const relative = validateWorkspaceRelativePath(path.relative(guard.root, path.resolve(cwd, file)).split(path.sep).join("/"));
    const segments = relative.split("/");
    // Add File may introduce several directories. Check every existing ancestor.
    for (let size = 1; size <= segments.length; size += 1) {
      const checked = await guard.resolve(segments.slice(0, size).join("/"), {
        operation: "write", mustExist: false, kind: size === segments.length ? "file" : "directory"
      });
      if (!checked.exists) break;
    }
    result.push(relative);
  }
  return [...new Set(result)];
}
export async function enforceEditPolicy(root: string, event: IdeEvent): Promise<string[]> {
  const files = await resolveEditPaths(root, event);
  const input = toolInput(event);
  const diff = event.tool_name === "apply_patch" ? input.command ?? ""
    : (input.new_string ?? input.content ?? "").split(/\r?\n/u).map((line) => `+${line}`).join("\n");
  const manager = createHookManager({ protectedFiles: [
    ...DEFAULT_HOOK_CONFIG.protectedFiles,
    "tests/**", "**/tests/**", "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
    ".codex/**", ".claude/**", ".opencode/**", "scripts/ide-hooks.mjs",
    "src/ide-integration/**", ".devguardian/**"
  ] });
  await manager.assertAllowed("pre:apply_patch", { files, unifiedDiff: diff });
  return files;
}
export function enforceCommandPolicy(event: IdeEvent): void {
  const command = toolInput(event).command;
  if (!command?.trim()) throw new ValidationError("El hook requiere el comando como texto.");
  const rules: readonly [RegExp, string][] = [
    [/\bgit\s+(?:-[^\s]+\s+)*reset\b[^\r\n]*--hard\b/iu, "restauracion destructiva del repositorio"],
    [/\bgit\s+(?:-[^\s]+\s+)*push\b[^\r\n]*(?:--force(?:-with-lease)?\b|(?:^|\s)-f(?:\s|$))/iu, "push forzado"],
    [/\brm\b[^\r\n]*(?:\s-[a-z]*r[a-z]*\b|--recursive\b)/iu, "borrado recursivo"],
    [/\b(?:Remove-Item|ri|rmdir|rd|del)\b[^\r\n]*(?:-Recurse\b|\/s\b)/iu, "borrado recursivo"],
    [/\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/iu, "SQL destructivo"],
    [/\b(?:curl|wget|Invoke-WebRequest|iwr)\b[^\r\n]*\|\s*(?:bash|sh|iex|Invoke-Expression|powershell|pwsh)\b/iu, "descarga y ejecucion directa"],
    [/(?:^|[\s/\\"'])\.env(?:\.[\w.-]+)?(?=$|[\s"';|])/iu, "acceso a archivos de secretos desde shell"],
    [/\b(?:Set-Content|Add-Content|Out-File|tee)\b[^\r\n]*(?:\.codex|\.claude|\.opencode|[/\\]tests[/\\])/iu,
      "escritura de configuracion o pruebas protegidas desde shell"]
  ];
  for (const [pattern, label] of rules) if (pattern.test(command)) {
    throw new ValidationError(`Comando bloqueado por politica: ${label}.`);
  }
}
