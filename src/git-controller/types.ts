import type { RepairSession, VerificationStore } from "../shared/contracts.js";

export interface RepositoryOptions {
  readonly workspaceRoot: string;
  readonly verificationStore: VerificationStore;
  readonly gitTimeoutMs?: number;
  readonly lockTimeoutMs?: number;
  readonly maxFileBytes?: number;
}

export interface FileFingerprint {
  readonly hash: string | null;
  readonly mode: "100644" | "100755" | null;
}

export interface FileSnapshot extends FileFingerprint {
  readonly content: Buffer | null;
}

export interface FileCheckpoint {
  readonly path: string;
  readonly before: FileFingerprint;
  after: FileFingerprint;
}

export interface AttemptCheckpoint {
  readonly commit: string;
  readonly workspaceStateHash: string;
  readonly indexEntries: string;
  readonly createdAt: string;
}

export interface AttemptState {
  readonly attemptId: string;
  readonly sessionId: string;
  readonly checkpoint: AttemptCheckpoint;
  readonly files: Map<string, FileCheckpoint>;
  state: "open" | "applied" | "committed" | "rolled_back";
  lastPatchedAt: string | null;
}

export interface SessionState extends RepairSession {
  readonly attempts: Map<string, AttemptState>;
  activeAttemptId: string | null;
}

export interface SerializationQueue {
  tail: Promise<void>;
}

export interface RepositoryState {
  readonly queue: SerializationQueue;
  readonly sessions: Map<string, SessionState>;
}

export interface TemporaryIndex {
  readonly directory: string;
  readonly indexPath: string;
}

export interface PatchStatistics {
  readonly paths: string[];
  readonly insertions: number;
  readonly deletions: number;
}
