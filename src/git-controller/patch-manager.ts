import { open, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  CompareTestRunsOutputSchema, GitApplyPatchInputSchema, GitApplyPatchOutputSchema,
  GitCommitFixInputSchema, GitCommitFixOutputSchema, GitDiffInputSchema, GitDiffOutputSchema,
  GitRollbackAttemptInputSchema, GitRollbackAttemptOutputSchema, Limits, RunTestsOutputSchema, parseContract
} from "../shared/contracts.js";
import type {
  GitApplyPatchInput, GitApplyPatchOutput, GitCommitFixInput, GitCommitFixOutput,
  GitDiffInput, GitDiffOutput, GitRollbackAttemptInput, GitRollbackAttemptOutput, VerificationEvidence
} from "../shared/contracts.js";
import { DevGuardianError, ErrorCode, RepositoryError } from "../shared/errors.js";
import { validateWorkspaceRelativePath } from "../shared/path-security.js";
import { Repository, sha256 } from "./repository.js";
import type { AttemptState, FileCheckpoint, FileFingerprint, FileSnapshot, PatchStatistics, TemporaryIndex } from "./types.js";

const DIFF_OPTIONS = ["--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", "--full-index",
  "--src-prefix=a/", "--dst-prefix=b/", "--diff-algorithm=myers", "--no-indent-heuristic", "--unified=3"];
const fingerprint = (snapshot: FileSnapshot): FileFingerprint => ({ hash: snapshot.hash, mode: snapshot.mode });
const matches = (left: FileFingerprint, right: FileFingerprint): boolean =>
  left.hash === right.hash && (process.platform === "win32" || left.mode === right.mode);

export class PatchManager {
  public constructor(private readonly repository: Repository) {}

  private statistics(output: string): PatchStatistics {
    const paths: string[] = [];
    let insertions = 0, deletions = 0;
    for (const record of output.split("\0").filter(Boolean)) {
      const match = /^(\d+)\t(\d+)\t(.+)$/su.exec(record);
      if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        throw new RepositoryError(ErrorCode.PATCH_INVALID, "Only text patches without renames are supported.");
      }
      const file = validateWorkspaceRelativePath(match[3]);
      if (file !== match[3] || paths.includes(file)) {
        throw new RepositoryError(ErrorCode.PATCH_INVALID, "Patch paths must be unique and use forward slashes.");
      }
      paths.push(file);
      insertions += Number(match[1]);
      deletions += Number(match[2]);
    }
    if (paths.length > Limits.maxPaths) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Patch affects too many files.");
    // Windows treats differently-cased names as the same path.
    if (process.platform === "win32" && new Set(paths.map((file) => file.toLowerCase())).size !== paths.length) {
      throw new RepositoryError(ErrorCode.PATCH_INVALID, "Case-colliding patch paths are forbidden.");
    }
    return { paths, insertions, deletions };
  }

  private async inspectPatch(diff: string): Promise<PatchStatistics> {
    let output: string;
    try {
      output = await this.repository.command(["apply", "--numstat", "-z", "-"], undefined, diff);
    } catch (error: unknown) {
      throw new RepositoryError(ErrorCode.PATCH_INVALID, "Malformed unified diff.", { cause: error });
    }
    const stats = this.statistics(output);
    if (stats.paths.length === 0) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Patch contains no file changes.");
    const sections = diff.split(/^diff --git /mu);
    if (sections.shift()?.trim() !== "" || sections.length !== stats.paths.length) {
      throw new RepositoryError(ErrorCode.PATCH_INVALID, "A standard Git text diff is required for every affected file.");
    }
    for (const [index, section] of sections.entries()) {
      const file = stats.paths[index];
      if (file === undefined || section.split("\n")[0]?.replace(/\r$/u, "") !== `a/${file} b/${file}`) {
        throw new RepositoryError(ErrorCode.PATCH_INVALID, "Patch headers disagree with affected paths; quoted paths and renames are unsupported.");
      }
      const headers = section.split(/^@@ /mu)[0]?.split("\n").map((line) => line.replace(/\r$/u, "").replace(/\t$/u, "")) ?? [];
      for (const header of headers.slice(1)) {
        if (!header) continue;
        if (header.startsWith("--- ")) {
          if (header !== `--- a/${file}` && header !== "--- /dev/null") {
            throw new RepositoryError(ErrorCode.PATCH_INVALID, "Invalid old-file header.");
          }
        } else if (header.startsWith("+++ ")) {
          if (header !== `+++ b/${file}` && header !== "+++ /dev/null") {
            throw new RepositoryError(ErrorCode.PATCH_INVALID, "Invalid new-file header.");
          }
        } else if (!/^index [a-f0-9]+\.\.[a-f0-9]+(?: 100(?:644|755))?$/u.test(header) &&
                   !/^(?:new file mode|deleted file mode) 100(?:644|755)$/u.test(header)) {
          throw new RepositoryError(ErrorCode.PATCH_INVALID, "Binary patches, copies, renames and special file modes are forbidden.");
        }
      }
    }
    return stats;
  }

  private async assertOwnedState(attempt: AttemptState, forbidForeign: boolean): Promise<void> {
    const status = await this.repository.assertSession(this.repository.session(attempt.sessionId), attempt.checkpoint.commit);
    const owned = new Set(attempt.files.keys());
    if (forbidForeign && [...status.staged, ...status.modified, ...status.untracked].some((file) => !owned.has(file))) {
      throw new RepositoryError(ErrorCode.WORKTREE_DIRTY, "Unrelated working tree changes must be preserved.");
    }
    const stagedOwned = await this.repository.command([
      "diff", "--cached", "--name-only", "-z", attempt.checkpoint.commit, "--", ...owned
    ]);
    if (owned.size > 0 && stagedOwned.length > 0) {
      throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Managed files were staged outside this attempt.");
    }
    for (const checkpoint of attempt.files.values()) {
      const current = await this.repository.readSnapshot(checkpoint.path);
      if (!matches(current, checkpoint.after)) {
        throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Managed file changed outside this attempt.",
          { details: { path: checkpoint.path } });
      }
    }
  }

  private async populateIndex(attempt: AttemptState, index: TemporaryIndex): Promise<void> {
    for (const checkpoint of attempt.files.values()) {
      const snapshot = await this.repository.readSnapshot(checkpoint.path);
      if (snapshot.content === null) {
        await this.repository.command(["update-index", "--force-remove", "--", checkpoint.path], index.indexPath);
      } else {
        const blob = (await this.repository.command(["hash-object", "-w", "--no-filters", "--stdin"],
          index.indexPath, snapshot.content)).trim();
        const mode = process.platform === "win32" ? checkpoint.after.mode : snapshot.mode;
        await this.repository.command(["update-index", "--add", "--cacheinfo", mode ?? "100644", blob, checkpoint.path], index.indexPath);
      }
    }
  }

  private async indexDiff(attempt: AttemptState, index: TemporaryIndex): Promise<GitDiffOutput> {
    const diff = await this.repository.command(["diff", "--cached", ...DIFF_OPTIONS, attempt.checkpoint.commit, "--"], index.indexPath);
    if (diff.length > Limits.maxPatchCharacters) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Attempt diff exceeds its size limit.");
    const stats = this.statistics(await this.repository.command([
      "diff", "--cached", "--numstat", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", attempt.checkpoint.commit, "--"
    ], index.indexPath));
    return parseContract(GitDiffOutputSchema, {
      diff, diffHash: sha256(diff), changedFiles: stats.paths, insertions: stats.insertions, deletions: stats.deletions
    });
  }

  private async treeSnapshot(tree: string, file: string): Promise<FileSnapshot> {
    const entry = await this.repository.command(["ls-tree", "-z", tree, "--", file]);
    if (!entry) return { content: null, hash: null, mode: null };
    const match = /^(100644|100755) blob [a-f0-9]+\t[^\0]+\0$/u.exec(entry);
    if (!match) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Only regular tracked files can be repaired.");
    const content = await this.repository.blob(tree, file);
    if (content.length > (this.repository.options.maxFileBytes ?? 5_000_000)) {
      throw new RepositoryError(ErrorCode.PATCH_INVALID, "Patch creates an oversized file.");
    }
    if (content.includes(0)) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Binary file content is forbidden.");
    const mode = match[1] === "100755" ? "100755" : "100644";
    return { content, hash: sha256(content), mode };
  }

  public async applyPatch(input: GitApplyPatchInput): Promise<GitApplyPatchOutput> {
    const parsed = parseContract(GitApplyPatchInputSchema, input);
    return this.repository.serialized(async () => {
      const attempt = await this.repository.attempt(parsed.sessionId, parsed.attemptId);
      const stats = await this.inspectPatch(parsed.unifiedDiff);
      await this.repository.options.hookManager?.assertAllowed("pre:apply_patch", {
        files: stats.paths, unifiedDiff: parsed.unifiedDiff,
        workspaceStateHash: await this.repository.workspaceStateHashUnlocked()
      });
      const expected = new Map<string, string | null>();
      for (const [file, hash] of Object.entries(parsed.expectedFileHashes)) {
        const normalized = validateWorkspaceRelativePath(file);
        if (file !== normalized || expected.has(normalized)) throw new RepositoryError(ErrorCode.PATCH_INVALID, "Noncanonical expected hash path.");
        expected.set(normalized, hash);
      }
      if (expected.size !== stats.paths.length || stats.paths.some((file) => !expected.has(file))) {
        throw new RepositoryError(ErrorCode.PATCH_INVALID, "Expected hashes must match exactly the affected files.");
      }
      const before = new Map<string, FileFingerprint>();
      for (const file of stats.paths) {
        const snapshot = await this.repository.readSnapshot(file);
        if (snapshot.hash !== expected.get(file)) {
          throw new RepositoryError(ErrorCode.PATCH_CONFLICT, "Expected file hash does not match.", { details: { path: file } });
        }
        before.set(file, fingerprint(snapshot));
        if (!attempt.files.has(file)) {
          const checkpoint = await this.treeSnapshot(attempt.checkpoint.commit, file);
          if (!matches(checkpoint, snapshot)) {
            throw new RepositoryError(ErrorCode.STATE_CONFLICT, "File does not match the checkpoint; automatic line-ending conversion is unsupported.");
          }
        }
      }
      if (new Set([...attempt.files.keys(), ...stats.paths]).size > Limits.maxPaths) {
        throw new RepositoryError(ErrorCode.PATCH_INVALID, "Attempt affects too many files.");
      }
      // Resolve all patch paths before reporting unrelated workspace changes. This makes a
      // newly-created symlink fail closed even when Git also reports it as untracked.
      await this.assertOwnedState(attempt, true);
      return this.repository.withIndex(attempt.checkpoint.commit, async (index) => {
        await this.populateIndex(attempt, index);
        try {
          await this.repository.command(["apply", "--cached", "--check", "--whitespace=nowarn", "-"], index.indexPath, parsed.unifiedDiff);
          await this.repository.command(["apply", "--cached", "--whitespace=nowarn", "-"], index.indexPath, parsed.unifiedDiff);
          await this.repository.command(["apply", "--check", "--whitespace=nowarn", "-"], undefined, parsed.unifiedDiff);
        } catch (error: unknown) {
          throw new RepositoryError(ErrorCode.PATCH_CONFLICT, "Patch is not applicable to the index and working tree.", { cause: error });
        }
        const diff = await this.indexDiff(attempt, index);
        const tree = (await this.repository.command(["write-tree"], index.indexPath)).trim();
        const pending = new Map<string, FileCheckpoint>();
        for (const file of stats.paths) {
          const original = before.get(file);
          if (!original) throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Missing pre-apply snapshot.");
          pending.set(file, { path: file, before: attempt.files.get(file)?.before ?? original,
            after: fingerprint(await this.treeSnapshot(tree, file)) });
          // Revalidate paths and bytes immediately before the atomic Git application.
          const current = await this.repository.readSnapshot(file);
          if (!matches(current, original)) {
            throw new RepositoryError(ErrorCode.STATE_CONFLICT, "File changed during patch validation.");
          }
        }
        await this.assertOwnedState(attempt, true);
        for (const checkpoint of pending.values()) {
          if (checkpoint.after.hash !== null) await this.repository.prepareParentDirectories(checkpoint.path);
        }
        try {
          // No --reject or --3way: Git either applies the entire patch or refuses it.
          await this.repository.command(["apply", "--whitespace=nowarn", "-"], undefined, parsed.unifiedDiff);
        } catch (error: unknown) {
          // A disk error can interrupt Git after some files have been written.
          // Record only known resulting states; unknown bytes fail closed below.
          for (const [file, checkpoint] of pending) {
            const current = await this.repository.readSnapshot(file);
            const original = before.get(file);
            if (original && matches(current, original)) continue;
            attempt.files.set(file, checkpoint);
            attempt.state = "applied";
          }
          throw new RepositoryError(ErrorCode.PATCH_CONFLICT, "Patch application failed.", { cause: error });
        }
        for (const [file, checkpoint] of pending) attempt.files.set(file, checkpoint);
        attempt.state = "applied";
        attempt.lastPatchedAt = new Date().toISOString();
        await this.assertOwnedState(attempt, true);
        return parseContract(GitApplyPatchOutputSchema, { applied: true, changedFiles: stats.paths, diffHash: diff.diffHash });
      });
    });
  }

  public async diff(input: GitDiffInput): Promise<GitDiffOutput> {
    const parsed = parseContract(GitDiffInputSchema, input);
    return this.repository.serialized(async () => {
      const attempt = await this.repository.attempt(parsed.sessionId, parsed.attemptId);
      await this.assertOwnedState(attempt, false);
      return this.repository.withIndex(attempt.checkpoint.commit, async (index) => {
        await this.populateIndex(attempt, index);
        return this.indexDiff(attempt, index);
      });
    });
  }

  private async validateEvidence(attempt: AttemptState, runId: string): Promise<void> {
    let evidence: VerificationEvidence;
    try {
      evidence = await this.repository.options.verificationStore.getEvidence(runId);
      parseContract(RunTestsOutputSchema, evidence.baseline);
      parseContract(RunTestsOutputSchema, evidence.candidate);
      parseContract(CompareTestRunsOutputSchema, evidence.comparison);
    } catch (error: unknown) {
      throw new RepositoryError(ErrorCode.VERIFICATION_FAILED, "Verification evidence is missing or invalid.", { cause: error });
    }
    const { baseline, candidate, comparison } = evidence;
    const candidateCases = new Map(candidate.cases.map((test) => [test.id, test]));
    const resolved = baseline.cases.filter((test) => test.status === "failed" && candidateCases.get(test.id)?.status === "passed");
    const preservesTests = baseline.cases.every((test) => {
      const current = candidateCases.get(test.id);
      return current?.status === (test.status === "failed" ? "passed" : test.status) &&
        current.path === test.path && current.name === test.name;
    });
    if (baseline.status !== "failed" || !baseline.complete || baseline.summary.failed === 0 ||
        candidate.runId !== runId || baseline.runId === candidate.runId || candidate.status !== "passed" ||
        !candidate.complete || candidate.summary.failed !== 0 ||
        baseline.runner !== candidate.runner || baseline.configurationHash !== candidate.configurationHash ||
        baseline.workspaceStateHash !== attempt.checkpoint.workspaceStateHash ||
        candidate.workspaceStateHash !== await this.repository.workspaceStateHashUnlocked() ||
        attempt.lastPatchedAt === null || Date.parse(candidate.startedAt) < Date.parse(attempt.lastPatchedAt) ||
        !preservesTests || resolved.length === 0 || !comparison.comparable || comparison.verdict !== "success" ||
        comparison.newFailures.length > 0 || comparison.missingTests.length > 0 ||
        comparison.resolvedFailures.length !== resolved.length ||
        resolved.some((test) => !comparison.resolvedFailures.includes(test.id))) {
      throw new RepositoryError(ErrorCode.VERIFICATION_FAILED, "Evidence does not prove this patch resolves failures without regressions.");
    }
  }

  public async commitFix(input: GitCommitFixInput): Promise<GitCommitFixOutput> {
    const parsed = parseContract(GitCommitFixInputSchema, input);
    return this.repository.serialized(async () => {
      const attempt = await this.repository.attempt(parsed.sessionId, parsed.attemptId);
      if (attempt.state !== "applied") throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Commit requires an applied patch.");
      await this.assertOwnedState(attempt, true);
      return this.repository.withIndex(attempt.checkpoint.commit, async (index) => {
        await this.populateIndex(attempt, index);
        const diff = await this.indexDiff(attempt, index);
        if (diff.diffHash !== parsed.expectedDiffHash || diff.changedFiles.length === 0) {
          throw new RepositoryError(ErrorCode.PATCH_CONFLICT, "Diff hash mismatch or empty patch.");
        }
        if (this.repository.options.hookManager) {
          let evidence: VerificationEvidence | undefined;
          try { evidence = await this.repository.options.verificationStore.getEvidence(parsed.verificationRunId); } catch { /* Hook records missing evidence. */ }
          await this.repository.options.hookManager.assertAllowed("pre:git_commit", {
            files: diff.changedFiles, unifiedDiff: diff.diff,
            branch: this.repository.session(attempt.sessionId).branch,
            workspaceStateHash: await this.repository.workspaceStateHashUnlocked(),
            ...(evidence ? { evidence } : {})
          });
        }
        await this.validateEvidence(attempt, parsed.verificationRunId);
        await this.assertOwnedState(attempt, true);
        const tree = (await this.repository.command(["write-tree"], index.indexPath)).trim();
        const commit = (await this.repository.command([
          "commit-tree", tree, "-p", attempt.checkpoint.commit, "-F", "-"
        ], index.indexPath, `${parsed.message}\n`)).trim();
        const indexLock = path.join(this.repository.gitDirectory, "index.lock");
        let handle: Awaited<ReturnType<typeof open>>;
        try {
          handle = await open(indexLock, "wx", 0o600);
        } catch (error: unknown) {
          throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Git index is locked by another operation.", { cause: error, retryable: true });
        }
        let referenceUpdated = false;
        let indexLockOwned = true;
        try {
          // Preserve the real index until both state and verification have been checked.
          if (await this.repository.command(["ls-files", "--stage", "-z"]) !== attempt.checkpoint.indexEntries) {
            throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Git index changed since the checkpoint.");
          }
          await this.assertOwnedState(attempt, true);
          await this.validateEvidence(attempt, parsed.verificationRunId);
          const session = this.repository.session(attempt.sessionId);
          const { readFile } = await import("node:fs/promises");
          await handle.writeFile(await readFile(index.indexPath));
          await handle.sync();
          await handle.close();
          // Compare-and-swap prevents overwriting a branch advanced by another writer.
          await this.repository.command(["update-ref", "-m", "DevGuardian verified repair",
            `refs/heads/${session.branch}`, commit, attempt.checkpoint.commit]);
          referenceUpdated = true;
          try {
            await rename(indexLock, path.join(this.repository.gitDirectory, "index"));
            indexLockOwned = false;
          } catch (error: unknown) {
            // Compensation is also compare-and-swap; never rewind a newer foreign commit.
            await this.repository.command(["update-ref", `refs/heads/${session.branch}`, attempt.checkpoint.commit, commit]);
            referenceUpdated = false;
            throw error;
          }
          attempt.state = "committed";
          session.activeAttemptId = null;
          await this.repository.options.hookManager?.notify("post:commit", {
            files: diff.changedFiles, branch: session.branch, timestamp: new Date().toISOString()
          });
          return parseContract(GitCommitFixOutputSchema, { commit, branch: session.branch, files: diff.changedFiles });
        } catch (error: unknown) {
          if (error instanceof DevGuardianError) throw error;
          throw new RepositoryError(ErrorCode.REPOSITORY_ERROR,
            referenceUpdated ? "Commit reference updated but index recovery requires attention." : "Commit transaction failed.", { cause: error });
        } finally {
          await handle.close().catch(() => {});
          // Keep our prepared index for recovery if reference compensation failed.
          // Once renamed, a newly created index.lock belongs to another Git writer.
          if (indexLockOwned && !referenceUpdated) await rm(indexLock, { force: true });
        }
      });
    });
  }

  public async rollbackAttempt(input: GitRollbackAttemptInput): Promise<GitRollbackAttemptOutput> {
    const parsed = parseContract(GitRollbackAttemptInputSchema, input);
    return this.repository.serialized(async () => {
      const attempt = await this.repository.attempt(parsed.sessionId, parsed.attemptId);
      await this.assertOwnedState(attempt, false);
      return this.repository.withIndex(attempt.checkpoint.commit, async (index) => {
        await this.populateIndex(attempt, index);
        const diff = await this.indexDiff(attempt, index);
        if (diff.diff.length > 0) {
          try {
            await this.repository.command(["apply", "--reverse", "--check", "--whitespace=nowarn", "-"], undefined, diff.diff);
            await this.assertOwnedState(attempt, false);
            for (const checkpoint of attempt.files.values()) {
              if (checkpoint.before.hash !== null) await this.repository.prepareParentDirectories(checkpoint.path);
            }
            await this.repository.command(["apply", "--reverse", "--whitespace=nowarn", "-"], undefined, diff.diff);
          } catch (error: unknown) {
            if (error instanceof DevGuardianError && error.code === ErrorCode.STATE_CONFLICT) throw error;
            throw new RepositoryError(ErrorCode.PATCH_CONFLICT, "Rollback cannot safely restore the attempt files.", { cause: error });
          }
        }
        for (const checkpoint of attempt.files.values()) {
          const restored = await this.repository.readSnapshot(checkpoint.path);
          if (!matches(restored, checkpoint.before)) {
            throw new RepositoryError(ErrorCode.STATE_CONFLICT, "Rollback did not restore the original file state.");
          }
        }
        attempt.state = "rolled_back";
        this.repository.session(attempt.sessionId).activeAttemptId = null;
        const status = await this.repository.statusUnlocked();
        return parseContract(GitRollbackAttemptOutputSchema, {
          restoredCommit: attempt.checkpoint.commit, revertedFiles: diff.changedFiles,
          branch: this.repository.session(attempt.sessionId).branch, clean: status.clean
        });
      });
    });
  }
}
