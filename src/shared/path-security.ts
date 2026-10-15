import { lstat, realpath, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import {
  DevGuardianError, ErrorCode, FileSystemError, PathSecurityError, hasSystemErrorCode
} from "./errors.js";

const INVALID_CHARACTERS = /[\u0000-\u001f\u007f<>:"|?*]/u;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;

export function validateWorkspaceRelativePath(input: string): string {
  if (
    input.length === 0 || input.length > 4096 || INVALID_CHARACTERS.test(input) ||
    path.posix.isAbsolute(input) || path.win32.isAbsolute(input)
  ) {
    throw new PathSecurityError(ErrorCode.PATH_INVALID, "Expected a safe workspace-relative path.");
  }
  const segments = input.split(/[\\/]/u);
  for (const segment of segments) {
    if (
      segment.length === 0 || segment.length > 255 || segment === "." || segment === ".." ||
      /[. ]$/u.test(segment) || WINDOWS_DEVICE.test(segment)
    ) {
      throw new PathSecurityError(ErrorCode.PATH_INVALID, "Invalid path component.");
    }
    if (segment.toLowerCase() === ".git") {
      throw new PathSecurityError(ErrorCode.PATH_PROTECTED, "Direct access to Git metadata is forbidden.");
    }
  }
  return segments.join("/");
}

export function isWorkspaceRelativePath(input: string): boolean {
  try {
    validateWorkspaceRelativePath(input);
    return true;
  } catch {
    return false;
  }
}

function assertInsideWorkspace(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new PathSecurityError(ErrorCode.PATH_OUTSIDE_WORKSPACE, "Path resolves outside the workspace.");
  }
  if (relative.split(path.sep).some((segment) => segment.toLowerCase() === ".git")) {
    throw new PathSecurityError(ErrorCode.PATH_PROTECTED, "Path resolves into Git metadata.");
  }
}

export interface ResolvePathOptions {
  readonly operation?: "read" | "write";
  readonly mustExist?: boolean;
  readonly kind?: "file" | "directory" | "any";
}

export interface ResolvedWorkspacePath {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly exists: boolean;
  readonly kind: "file" | "directory";
}

/** Use one guard per trusted workspace. Untrusted clients cannot choose its root. */
export class WorkspacePathGuard {
  private constructor(public readonly root: string) {}

  public static async create(workspaceRoot: string): Promise<WorkspacePathGuard> {
    try {
      if (!path.isAbsolute(workspaceRoot)) {
        throw new PathSecurityError(ErrorCode.PATH_INVALID, "Workspace root must be absolute.");
      }
      const root = await realpath(workspaceRoot);
      if (!(await stat(root)).isDirectory()) {
        throw new PathSecurityError(ErrorCode.FILE_TYPE_INVALID, "Workspace root must be a directory.");
      }
      return new WorkspacePathGuard(root);
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new FileSystemError("Cannot initialize the workspace root.", { cause: error });
    }
  }

  /**
   * Only the final component may be absent; its parent must already exist.
   * This checks a filesystem snapshot, not a lock: callers must serialize writes
   * and use an isolated checkout against untrusted concurrent filesystem changes.
   */
  public async resolve(input: string, options: ResolvePathOptions = {}): Promise<ResolvedWorkspacePath> {
    const relativePath = validateWorkspaceRelativePath(input);
    const operation = options.operation ?? "read";
    const mustExist = options.mustExist ?? true;
    const expectedKind = options.kind ?? "file";
    try {
      if (await realpath(this.root) !== this.root) {
        throw new PathSecurityError(ErrorCode.PATH_OUTSIDE_WORKSPACE, "Workspace root has changed.");
      }
      const segments = relativePath.split("/");
      let current = this.root;
      for (const [index, segment] of segments.entries()) {
        const last = index === segments.length - 1;
        const candidate = path.join(current, segment);
        assertInsideWorkspace(this.root, candidate);
        let metadata: Stats;
        try {
          metadata = await lstat(candidate);
        } catch (error: unknown) {
          if (hasSystemErrorCode(error, "ENOENT")) {
            if (last && !mustExist && operation === "write" && expectedKind !== "any") {
              return { relativePath, absolutePath: candidate, exists: false, kind: expectedKind };
            }
            throw new PathSecurityError(ErrorCode.FILE_NOT_FOUND, "Path or parent directory does not exist.");
          }
          throw error;
        }
        if (metadata.isSymbolicLink() && operation === "write") {
          throw new PathSecurityError(ErrorCode.SYMLINK_FORBIDDEN, "Writes through symbolic links are forbidden.");
        }
        current = await realpath(candidate);
        assertInsideWorkspace(this.root, current);
        const target = await stat(current);
        if (!target.isFile() && !target.isDirectory()) {
          throw new PathSecurityError(ErrorCode.FILE_TYPE_INVALID, "Special filesystem objects are forbidden.");
        }
        if (!last && !target.isDirectory()) {
          throw new PathSecurityError(ErrorCode.FILE_TYPE_INVALID, "Parent component is not a directory.");
        }
        if (last) {
          const kind = target.isFile() ? "file" : "directory";
          if (expectedKind !== "any" && expectedKind !== kind) {
            throw new PathSecurityError(ErrorCode.FILE_TYPE_INVALID, "Path has an unexpected filesystem type.");
          }
          if (operation === "write" && target.isFile() && target.nlink > 1) {
            throw new PathSecurityError(ErrorCode.SYMLINK_FORBIDDEN, "Writes to files with multiple hard links are forbidden.");
          }
          return { relativePath, absolutePath: current, exists: true, kind };
        }
      }
      throw new PathSecurityError(ErrorCode.PATH_INVALID, "Path has no components.");
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      if (hasSystemErrorCode(error, "ENOENT")) {
        throw new PathSecurityError(ErrorCode.FILE_NOT_FOUND, "Path contains a missing or dangling target.");
      }
      if (hasSystemErrorCode(error, "ELOOP")) {
        throw new PathSecurityError(ErrorCode.SYMLINK_FORBIDDEN, "Symbolic link cycle detected.");
      }
      throw new FileSystemError("Cannot resolve workspace path.", { cause: error });
    }
  }
}
