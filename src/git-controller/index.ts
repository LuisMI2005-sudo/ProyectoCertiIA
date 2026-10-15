import type {
  GitController as GitControllerContract, ToolHandler
} from "../shared/contracts.js";
import { captureResult } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import { PatchManager } from "./patch-manager.js";
import { Repository } from "./repository.js";
import type { RepositoryOptions } from "./types.js";

export interface GitControllerTools {
  readonly git_status: ToolHandler<"git_status">;
  readonly git_create_fix_branch: ToolHandler<"git_create_fix_branch">;
  readonly git_begin_attempt: ToolHandler<"git_begin_attempt">;
  readonly git_apply_patch: ToolHandler<"git_apply_patch">;
  readonly git_diff: ToolHandler<"git_diff">;
  readonly git_commit_fix: ToolHandler<"git_commit_fix">;
  readonly git_rollback_attempt: ToolHandler<"git_rollback_attempt">;
}

/** Domain methods implement shared/contracts; MCP-facing tools always return Result<T>. */
export class GitController implements GitControllerContract {
  public readonly status: GitControllerContract["status"];
  public readonly createFixBranch: GitControllerContract["createFixBranch"];
  public readonly beginAttempt: GitControllerContract["beginAttempt"];
  public readonly applyPatch: GitControllerContract["applyPatch"];
  public readonly diff: GitControllerContract["diff"];
  public readonly commitFix: GitControllerContract["commitFix"];
  public readonly rollbackAttempt: GitControllerContract["rollbackAttempt"];
  public readonly tools: GitControllerTools;

  private constructor(private readonly repository: Repository) {
    const patches = new PatchManager(repository);
    this.status = repository.status.bind(repository);
    this.createFixBranch = repository.createFixBranch.bind(repository);
    this.beginAttempt = repository.beginAttempt.bind(repository);
    this.applyPatch = patches.applyPatch.bind(patches);
    this.diff = patches.diff.bind(patches);
    this.commitFix = patches.commitFix.bind(patches);
    this.rollbackAttempt = patches.rollbackAttempt.bind(patches);
    this.tools = {
      git_status: (input) => captureResult(() => this.status(input)),
      git_create_fix_branch: (input) => captureResult(() => this.createFixBranch(input)),
      git_begin_attempt: (input) => captureResult(() => this.beginAttempt(input)),
      git_apply_patch: (input) => captureResult(() => this.applyPatch(input)),
      git_diff: (input) => captureResult(() => this.diff(input)),
      git_commit_fix: (input) => captureResult(() => this.commitFix(input)),
      git_rollback_attempt: (input) => captureResult(() => this.rollbackAttempt(input))
    };
  }

  public static async create(options: RepositoryOptions): Promise<GitController> {
    return new GitController(await Repository.create(options));
  }

  /** Test runners should call this before and after a run to detect state changes. */
  public workspaceStateHash(): Promise<string> {
    return this.repository.workspaceStateHash();
  }
}

export function createGitController(options: RepositoryOptions): Promise<Result<GitController>> {
  return captureResult(() => GitController.create(options));
}

export { Repository } from "./repository.js";
export { PatchManager } from "./patch-manager.js";
export type { RepositoryOptions } from "./types.js";
