import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { simpleGit } from "simple-git";
import {
  GitBeginAttemptInputSchema, GitBeginAttemptOutputSchema,
  GitCreateFixBranchInputSchema, GitCreateFixBranchOutputSchema,
  GitStatusInputSchema, GitStatusOutputSchema, Limits, parseContract
} from "../shared/contracts.js";
import type {
  GitBeginAttemptInput, GitBeginAttemptOutput, GitCreateFixBranchInput,
  GitCreateFixBranchOutput, GitStatusInput, GitStatusOutput
} from "../shared/contracts.js";
import {
  DevGuardianError, ErrorCode, ExecutionTimeoutError, FileSystemError,
  RepositoryError, ValidationError, hasSystemErrorCode
} from "../shared/errors.js";
import { WorkspacePathGuard, validateWorkspaceRelativePath } from "../shared/path-security.js";
import type { ResolvedWorkspacePath } from "../shared/path-security.js";
import type {
  AttemptState, FileSnapshot, RepositoryOptions, RepositoryState, SessionState, TemporaryIndex
} from "./types.js";

const states = new Map<string, RepositoryState>();
export const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

/** Internal domain service. Public Tool handlers wrap its errors as Result<T>. */
export class Repository {
  private constructor(
    public readonly guard: WorkspacePathGuard,
    public readonly gitDirectory: string,
    private readonly commonDirectory: string,
    private readonly hooksDirectory: string,
    public readonly options: RepositoryOptions,
    private readonly shared: RepositoryState
  ) {}

  public static async create(options: RepositoryOptions): Promise<Repository> {
    for (const value of [options.gitTimeoutMs, options.lockTimeoutMs]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > Limits.maxTimeoutMs)) {
        throw new ValidationError("Git and lock timeouts must be bounded positive integers.");
      }
    }
    if (options.maxFileBytes !== undefined &&
        (!Number.isInteger(options.maxFileBytes) || options.maxFileBytes < 1 || options.maxFileBytes > 10_000_000)) {
      throw new ValidationError("File size limit must be between 1 and 10000000 bytes.");
    }
    const guard = await WorkspacePathGuard.create(options.workspaceRoot);
    try {
      const discovery = simpleGit({ baseDir: guard.root, trimmed: true,
        timeout: { block: options.gitTimeoutMs ?? 30_000, stdOut: false, stdErr: false } });
      const root = await realpath(await discovery.raw(["rev-parse", "--show-toplevel"]));
      if (root !== guard.root) throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Workspace must be the repository root.");
      const gitDirectory = await realpath(await discovery.raw(["rev-parse", "--absolute-git-dir"]));
      const common = await discovery.raw(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
      const commonDirectory = await realpath(common);
      const hooksDirectory = path.join(gitDirectory, "devguardian-disabled-hooks");
      await mkdir(hooksDirectory, { recursive: true });
      if ((await lstat(hooksDirectory)).isSymbolicLink()) {
        throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Hook isolation directory cannot be a symlink.");
      }
      // Disable hooks using an empty directory that only this controller manages.
      const { readdir } = await import("node:fs/promises");
      if ((await readdir(hooksDirectory)).length > 0) {
        throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Hook isolation directory must be empty.");
      }
      const key = process.platform === "win32" ? guard.root.toLowerCase() : guard.root;
      let shared = states.get(key);
      if (!shared) {
        shared = { queue: { tail: Promise.resolve() }, sessions: new Map() };
        states.set(key, shared);
      }
      return new Repository(guard, gitDirectory, commonDirectory, hooksDirectory, options, shared);
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Cannot initialize the Git repository.", { cause: error });
    }
  }

  /** Same-process FIFO plus an exclusive lock shared with cooperating processes/worktrees. */
  public async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.shared.queue.tail;
    let release: () => void = () => {};
    this.shared.queue.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const lockPath = path.join(this.commonDirectory, "devguardian.lock");
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const deadline = Date.now() + (this.options.lockTimeoutMs ?? 30_000);
      while (!handle) {
        try {
          handle = await open(lockPath, "wx", 0o600);
        } catch (error: unknown) {
          if (!hasSystemErrorCode(error, "EEXIST")) throw error;
          if (Date.now() >= deadline) {
            throw new ExecutionTimeoutError("Repository lock timed out; an existing lock is never stolen.", { retryable: true });
          }
          await delay(25);
        }
      }
      await handle.writeFile(JSON.stringify({ pid: process.pid, token: randomUUID() }));
      return await operation();
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Repository operation failed.", { cause: error });
    } finally {
      try {
        if (handle) {
          await handle.close();
          await rm(lockPath);
        }
      } finally {
        release();
      }
    }
  }

  private async execute(args: string[], indexPath?: string, input?: Buffer | string): Promise<Buffer> {
    const abort = new AbortController();
    const chunks: Buffer[] = [];
    let bytes = 0;
    let oversized = false;
    const environment = {
      GIT_LITERAL_PATHSPECS: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      ...(indexPath === undefined ? {} : { GIT_INDEX_FILE: indexPath })
    };
    const git = simpleGit({
      baseDir: this.guard.root, maxConcurrentProcesses: 1, trimmed: false,
      timeout: { block: this.options.gitTimeoutMs ?? 30_000, stdOut: false, stdErr: false },
      abort: abort.signal,
      input: () => input,
      allowEnvironment: Object.keys(environment),
      // These exceptions only permit the fixed disabling settings below.
      unsafe: { allowUnsafeHooksPath: true, allowUnsafeFsMonitor: true },
      config: ["core.quotePath=false", "core.autocrlf=false", "core.fsmonitor=false",
        `core.hooksPath=${this.hooksDirectory}`, "gc.auto=0", "diff.mnemonicPrefix=false"]
    }).env(environment);
    git.outputHandler((_command, stdout, stderr) => {
      const count = (chunk: Buffer | string): Buffer => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > 12_000_000) { oversized = true; abort.abort(); }
        return buffer;
      };
      stdout.on("data", (chunk: Buffer | string) => { const buffer = count(chunk); if (!oversized) chunks.push(buffer); });
      stderr.on("data", count);
    });
    try {
      await git.raw(args);
      if (oversized) throw new RepositoryError(ErrorCode.REPOSITORY_ERROR, "Git output exceeded its limit.");
      return Buffer.concat(chunks);
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new RepositoryError(ErrorCode.REPOSITORY_ERROR,
        oversized ? "Git output exceeded its limit." : "Git command failed.", { cause: error });
    }
  }

  public async command(args: string[], indexPath?: string, input?: Buffer | string): Promise<string> {
    return (await this.execute(args, indexPath, input)).toString("utf8");
  }

  public blob(tree: string, file: string): Promise<Buffer> {
    return this.execute(["cat-file", "blob", `${tree}:${file}`]);
  }

  public async withIndex<T>(commit: string, operation: (index: TemporaryIndex) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(path.join(this.gitDirectory, "devguardian-index-"));
    const indexPath = path.join(directory, "index");
    try {
      await this.command(["read-tree", commit], indexPath);
      return await operation({ directory, indexPath });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  public async status(input: GitStatusInput): Promise<GitStatusOutput> {
    parseContract(GitStatusInputSchema, input);
    return this.serialized(() => this.statusUnlocked());
  }

  public async statusUnlocked(): Promise<GitStatusOutput> {
    const output = await this.command(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    const staged: string[] = [], modified: string[] = [], untracked: string[] = [], conflicted: string[] = [];
    const records = output.split("\0");
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (!record) continue;
      const code = record.slice(0, 2), file = record.slice(3);
      if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(code)) conflicted.push(file);
      else if (code === "??") untracked.push(file);
      else {
        if (code[0] !== " ") staged.push(file);
        if (code[1] !== " ") modified.push(file);
      }
      if (code.includes("R") || code.includes("C")) index++;
    }
    const reference = (await this.command(["symbolic-ref", "--quiet", "HEAD"])).trim();
    const head = (await this.command(["rev-parse", "--verify", "--quiet", "HEAD"])).trim();
    return parseContract(GitStatusOutputSchema, {
      branch: reference.startsWith("refs/heads/") ? reference.slice(11) : null,
      headCommit: head || null,
      clean: staged.length + modified.length + untracked.length + conflicted.length === 0,
      staged, modified, untracked, conflicted
    });
  }

  public async readSnapshot(file: string): Promise<FileSnapshot> {
    let resolved: ResolvedWorkspacePath;
    try {
      resolved = await this.guard.resolve(file, { operation: "write", mustExist: false });
    } catch (error: unknown) {
      if (!(error instanceof DevGuardianError) || error.code !== ErrorCode.FILE_NOT_FOUND) throw error;
      // Git removes empty parent directories on deletions. Validate every existing
      // ancestor before treating a file under a missing directory as absent.
      const components = validateWorkspaceRelativePath(file).split("/");
      for (let index = 1; index < components.length; index++) {
        const parent = await this.guard.resolve(components.slice(0, index).join("/"),
          { operation: "write", mustExist: false, kind: "directory" });
        if (!parent.exists) return { content: null, hash: null, mode: null };
      }
      throw error;
    }
    if (!resolved.exists) return { content: null, hash: null, mode: null };
    const metadata = await lstat(resolved.absolutePath);
    if (metadata.size > (this.options.maxFileBytes ?? 5_000_000)) {
      throw new ValidationError("Managed file exceeds the configured size limit.");
    }
    try {
      const content = await readFile(resolved.absolutePath);
      if (content.length > (this.options.maxFileBytes ?? 5_000_000)) throw new ValidationError("Managed file is too large.");
      const mode = process.platform === "win32" ? "100644" : (metadata.mode & 0o111) !== 0 ? "100755" : "100644";
      return { content, hash: sha256(content), mode };
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new FileSystemError("Cannot read managed file.", { cause: error });
    }
  }

  public async prepareParentDirectories(file: string): Promise<void> {
    const components = validateWorkspaceRelativePath(file).split("/");
    for (let index = 1; index < components.length; index++) {
      const relative = components.slice(0, index).join("/");
      const parent = await this.guard.resolve(relative, { operation: "write", mustExist: false, kind: "directory" });
      if (!parent.exists) {
        try {
          await mkdir(parent.absolutePath);
        } catch (error: unknown) {
          if (!hasSystemErrorCode(error, "EEXIST")) {
            throw new FileSystemError("Cannot create a validated patch directory.", { cause: error });
          }
        }
      }
      // An EEXIST result must never hide a symlink or a non-directory.
      await this.guard.resolve(relative, { operation: "write", kind: "directory" });
    }
  }

  /** Hash algorithm shared with the future Test Runner; ignored artifacts are excluded. */
  public async workspaceStateHashUnlocked(): Promise<string> {
    const head = (await this.command(["rev-parse", "--verify", "HEAD"])).trim();
    const entries = await this.command(["ls-files", "--stage", "-z"]);
    const files = await this.command(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
    const snapshots: { path: string; hash: string | null; mode: string | null }[] = [];
    for (const file of [...new Set(files.split("\0").filter(Boolean))].sort()) {
      validateWorkspaceRelativePath(file);
      const snapshot = await this.readSnapshot(file);
      snapshots.push({ path: file, hash: snapshot.hash, mode: snapshot.mode });
    }
    return sha256(JSON.stringify({ head, entries, files: snapshots }));
  }

  public workspaceStateHash(): Promise<string> {
    return this.serialized(() => this.workspaceStateHashUnlocked());
  }

  public session(sessionId: string): SessionState {
    const session = this.shared.sessions.get(sessionId);
    if (!session) throw new RepositoryError(ErrorCode.SESSION_NOT_FOUND, "Unknown repair session.");
    return session;
  }

  public async assertSession(session: SessionState, expectedHead?: string): Promise<GitStatusOutput> {
    const status = await this.statusUnlocked();
    if (status.branch !== session.branch || !status.branch.startsWith("fix/") ||
        (expectedHead !== undefined && status.headCommit !== expectedHead)) {
      throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Repair branch or HEAD changed outside this session.");
    }
    if (status.conflicted.length > 0) throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Repository has merge conflicts.");
    return status;
  }

  public async attempt(sessionId: string, attemptId: string): Promise<AttemptState> {
    const session = this.session(sessionId);
    const attempt = session.attempts.get(attemptId);
    if (!attempt) throw new RepositoryError(ErrorCode.ATTEMPT_NOT_FOUND, "Unknown repair attempt.");
    if (session.activeAttemptId !== attemptId || !["open", "applied"].includes(attempt.state)) {
      throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Attempt is no longer active.");
    }
    await this.assertSession(session, attempt.checkpoint.commit);
    return attempt;
  }

  public async createFixBranch(input: GitCreateFixBranchInput): Promise<GitCreateFixBranchOutput> {
    const parsed = parseContract(GitCreateFixBranchInputSchema, input);
    return this.serialized(async () => {
      const status = await this.statusUnlocked();
      if (!status.clean) throw new RepositoryError(ErrorCode.WORKTREE_DIRTY, "Branch creation requires a clean working tree.");
      if (!status.branch || status.headCommit !== parsed.expectedHead) {
        throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Expected HEAD mismatch or detached/unborn branch.");
      }
      // Check safety of the tracked tree before authorizing autonomous repairs.
      await this.workspaceStateHashUnlocked();
      const branch = `fix/${parsed.slug}`;
      await this.command(["switch", "--create", branch, parsed.expectedHead]);
      const session: SessionState = {
        sessionId: randomUUID(), branch, baseBranch: status.branch, baseCommit: parsed.expectedHead,
        createdAt: new Date().toISOString(), attempts: new Map(), activeAttemptId: null
      };
      this.shared.sessions.set(session.sessionId, session);
      return parseContract(GitCreateFixBranchOutputSchema, {
        sessionId: session.sessionId, branch, baseBranch: session.baseBranch, baseCommit: session.baseCommit
      });
    });
  }

  public async beginAttempt(input: GitBeginAttemptInput): Promise<GitBeginAttemptOutput> {
    const parsed = parseContract(GitBeginAttemptInputSchema, input);
    return this.serialized(async () => {
      const session = this.session(parsed.sessionId);
      const status = await this.assertSession(session);
      if (session.activeAttemptId) throw new RepositoryError(ErrorCode.STATE_CONFLICT, "A repair attempt is already active.");
      if (!status.clean || !status.headCommit) throw new RepositoryError(ErrorCode.WORKTREE_DIRTY, "Checkpoint requires a clean working tree.");
      const attempt: AttemptState = {
        attemptId: randomUUID(), sessionId: session.sessionId,
        checkpoint: {
          commit: status.headCommit, workspaceStateHash: await this.workspaceStateHashUnlocked(),
          indexEntries: await this.command(["ls-files", "--stage", "-z"]), createdAt: new Date().toISOString()
        }, files: new Map(), state: "open", lastPatchedAt: null
      };
      session.attempts.set(attempt.attemptId, attempt);
      session.activeAttemptId = attempt.attemptId;
      return parseContract(GitBeginAttemptOutputSchema, { attemptId: attempt.attemptId, checkpointCommit: status.headCommit });
    });
  }
}
