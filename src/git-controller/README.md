# Git Controller

`createGitController(options)` returns `Result<GitController>`. The public `tools`
object exposes the seven Git MCP handlers with the exact shared schemas and
`Result<T>` responses. Domain methods implement `shared/contracts.ts` and throw
typed domain errors. Repository identity and the verification store come from
trusted server startup configuration, never from tool arguments.

```typescript
import { createGitController } from "./git-controller/index.js";
import type { VerificationStore } from "./shared/contracts.js";

export async function initializeGitTools(
  workspaceRoot: string,
  verificationStore: VerificationStore
) {
  const initialized = await createGitController({ workspaceRoot, verificationStore });
  if (!initialized.ok) return initialized;
  return initialized.data.tools;
}
```

## Execution and ownership

All operations, including reads used for verification, use a FIFO queue shared
by controller instances addressing the same canonical checkout. An exclusive
`devguardian.lock` in Git's common directory coordinates cooperating processes
and linked worktrees. Git commands have a fixed timeout and bounded output.
Repository hooks and fsmonitor are disabled for controller commands. No shell,
custom diff driver, textconv or clean/smudge filter is used by the patch workflow.

One attempt can be active per session. Its checkpoint is an existing commit and
a fingerprint of the clean working tree and index. Applying a patch changes the
working tree only; temporary Git indexes prepare/check the patch and compute
the complete attempt diff, including additions and deletions. The real staging
area remains unchanged until a verified commit succeeds.

Patches must be standard Git unified text diffs with canonical, forward-slash,
unquoted paths. Text modifications, additions with validated parent directories and
deletions are supported. Binary files, symlinks, submodules, renames, copies and
standalone permission changes are rejected. Automatic line-ending conversion
between a tracked blob and its working-tree file is rejected rather than
silently changing unrelated bytes. `null` in `expectedFileHashes` means the file
must not exist. The expected hash map must name exactly the patch's files.

Rollback applies only the inverse of the attempt diff, on the original `fix/`
branch and unchanged checkpoint HEAD. It first verifies all managed file hashes,
modes and index entries. Unrelated files and staging are preserved. External
changes to a managed file cause refusal; committed attempts are never reset.

## Verification and commits

The injected `VerificationStore` must supply trusted baseline, candidate and
comparison results for the requested `verificationRunId`. The controller checks
the schemas, exact candidate run identity, test identities, resolved failures,
configuration equality, complete results, checkpoint fingerprint and current
workspace fingerprint. The candidate must have started after the latest patch.
An unknown run or stale, incomplete, failed or incomparable result cannot commit.

`workspaceStateHash()` exposes the hashing algorithm needed by the Test Runner:
SHA-256 of JSON containing HEAD, raw NUL-separated index entries, and sorted
tracked/nonignored-untracked file paths with raw-content SHA-256 and normalized
regular-file modes. Ignored test artifacts are excluded. The Test Runner must
compare this fingerprint before and after execution; the fingerprint does not
replace trust in the evidence producer.

Commits use a private index and `commit-tree`, a native exclusive index lock and
`update-ref` with the expected old commit. This creates one commit containing
only the attempt's final changes. The new index is installed by atomic rename.
An index-install failure triggers a compare-and-swap reference compensation;
if compensation fails, the prepared index lock is retained for manual recovery.

## Operational limits

The queue and lock protect cooperating writers. Arbitrary editors or processes
that ignore the lock cannot be made race-free by a Node.js path check; autonomous
execution should use a checkout dedicated to the repair session. Revalidation
and reference/index locks detect conflicts, and the controller refuses to erase
foreign work.

Session/checkpoint ownership is currently kept in memory. After a server restart,
old IDs are rejected and existing working-tree changes are preserved. A process
crash can leave `devguardian.lock` or `index.lock`; locks are never stolen or
automatically deleted on startup. An operator must verify the previous process
has stopped and inspect HEAD, index and working-tree state before recovery.
Git references and the index cannot be updated as one filesystem transaction;
the lock and compensation cover handled failures, not abrupt process termination.

The test suite commits exclusively inside temporary fixture repositories. It
does not create commits in DevGuardian's own repository.
