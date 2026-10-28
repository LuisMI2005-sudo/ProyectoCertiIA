import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { CodeAnalyzer } from "../analyzer/index.js";
import { AuditPersistenceService, DatabaseDelegationPersistenceAdapter, DatabaseHookPersistenceAdapter, PostgresDatabaseAdapter, toJson } from "../db/index.js";
import type { AuditSessionRecord, DevGuardianRepository, ProjectRecord } from "../db/types.js";
import { GitController } from "../git-controller/index.js";
import { createHookManager, HookManager } from "../hooks/index.js";
import type { HookConfig, HookEvent, HookPayload } from "../hooks/types.js";
import { IdentifierSchema, parseContract } from "../shared/contracts.js";
import type { RunnerConfiguration } from "../shared/contracts.js";
import { captureResult, ErrorCode, ValidationError } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { DevGuardianCoordinator } from "../subagents/coordinator.js";
import { TestRunner } from "../test-runner/index.js";
import type { TestSandbox } from "../test-runner/types.js";
import { EvaluateHookSchema, HttpError, RegisterProjectSchema, RunAuditSchema } from "./contracts.js";
import type { HookLogQuery, ListQuery } from "./contracts.js";
import { createCloudDemo } from "./cloud-demo.js";
import { listProjectFiles } from "./project-files.js";

const execute = promisify(execFile);
const SYSTEM_NAME = "__devguardian_system__";
const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
class RoutedHookManager extends HookManager {
  public target: HookManager | null = null;
  public override trigger(event: HookEvent, payload: HookPayload) {
    if (!this.target) return Promise.resolve<Result<never>>({ ok: false,
      error: { code: ErrorCode.VERIFICATION_FAILED, message: "No active tool audit.", retryable: false } });
    return this.target.trigger(event, payload);
  }
}
export interface DomainRuntime {
  readonly analyzer: CodeAnalyzer; readonly git: GitController; readonly runner: TestRunner; readonly router: RoutedHookManager;
}
export interface ToolContext {
  readonly project: ProjectRecord; readonly audit: AuditSessionRecord; readonly hooks: HookManager;
  readonly runtime: () => Promise<DomainRuntime>;
}
export interface BackendOptions {
  readonly sandbox?: TestSandbox;
  readonly requireSandbox?: boolean;
  readonly repository: DevGuardianRepository;
  readonly workspaceRoots?: readonly string[];
  readonly runners?: readonly RunnerConfiguration[];
  readonly hookConfig?: Partial<HookConfig>;
  readonly maxRuntimes?: number;
  readonly demoEnabled?: boolean;
}
export class DevGuardianBackend {
  public get importWorkspaceRoot(): string { return this.roots[0] ?? process.cwd(); }
  private imported(project: ProjectRecord): boolean {
    return this.roots.some((root) => path.relative(root, project.repoPath).split(path.sep)[0] === ".devguardian-imports");
  }
  public readonly persistence: AuditPersistenceService;
  public readonly version: string;
  public readonly runners: readonly RunnerConfiguration[];
  private readonly queues = new Map<string, Promise<void>>();
  private readonly runtimes = new Map<string, DomainRuntime>();
  private readonly availability: Promise<{ runner: string; available: boolean }[]>;
  private closed = false;
  private demoCount = 0;
  private constructor(public readonly repository: DevGuardianRepository, private readonly roots: readonly string[],
    runners: readonly RunnerConfiguration[], private readonly hookConfig: Partial<HookConfig>, version: string, private readonly maxRuntimes: number,
    private readonly demoEnabled: boolean, private readonly sandbox?: TestSandbox, private readonly requireSandbox = false) {
    this.persistence = new AuditPersistenceService(repository); this.runners = structuredClone(runners); this.version = version;
    this.availability = Promise.all(runners.map(async (runner) => {
      try { await execute(runner.executable, [...runner.args, "--version"], { timeout: 5000, maxBuffer: 100000, windowsHide: true });
        return { runner: runner.runner, available: true }; }
      catch { return { runner: runner.runner, available: false }; }
    }));
  }
  public static async create(options: BackendOptions): Promise<DevGuardianBackend> {
    const roots = await Promise.all((options.workspaceRoots ?? [process.cwd()]).map(async (root) => (await WorkspacePathGuard.create(path.resolve(root))).root));
    if (!roots.length) throw new ValidationError("At least one trusted workspace root is required.");
    if (options.maxRuntimes !== undefined && (!Number.isSafeInteger(options.maxRuntimes) || options.maxRuntimes < 1 || options.maxRuntimes > 64)) throw new ValidationError("Invalid MCP runtime capacity.");
    const defaults: RunnerConfiguration[] = [
      { runner: "jest", executable: process.execPath, args: [fileURLToPath(new URL("../../node_modules/jest/bin/jest.js", import.meta.url)), "--runInBand"], timeoutMs: 30000, maxOutputBytes: 100000 },
      { runner: "pytest", executable: "pytest", args: ["-q"], timeoutMs: 30000, maxOutputBytes: 100000 }
    ];
    const metadata: unknown = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
    const version = typeof metadata === "object" && metadata !== null && "version" in metadata && typeof metadata.version === "string" ? metadata.version : "0.1.0";
    return new DevGuardianBackend(options.repository, roots, options.runners ?? defaults, structuredClone(options.hookConfig ?? {}), version, options.maxRuntimes ?? 16,
      options.demoEnabled ?? (process.env["RENDER"] === "true" || process.env["DEVGUARDIAN_ENABLE_DEMO"] === "1"), options.sandbox, options.requireSandbox === true);
  }
  public async health() {
    let connected = true;
    try { await this.repository.listProjects(); } catch { connected = false; }
    const isolatedTests = this.sandbox ? await this.sandbox.ready() : false;
    return { status: connected ? "ok" : "degraded", database: { connected, mode: this.repository instanceof PostgresDatabaseAdapter ? "postgres" : "local", tables: 5 },
      version: this.version, uptimeSeconds: process.uptime(), runners: (await this.availability).map(item => ({ ...item, available: item.available || isolatedTests })),
      capabilities: { isolatedTests, requiresIsolation: this.requireSandbox } };
  }
  private allowed(candidate: string): boolean {
    return this.roots.some((root) => inside(root, candidate)) && !candidate.split(/[\\/]/u).some((part) => part.toLowerCase() === ".git");
  }
  public async projects(): Promise<ProjectRecord[]> {
    return (await this.repository.listProjects()).filter((project) => project.name !== SYSTEM_NAME && this.allowed(project.repoPath));
  }
  public async projectFiles(id: string) { return listProjectFiles((await this.project(id)).repoPath); }
  public async project(id: string): Promise<ProjectRecord> {
    const project = await this.repository.getProject(parseContract(IdentifierSchema, id));
    if (!project || !this.allowed(project.repoPath)) throw new HttpError(404, "Project not found.");
    return project;
  }
  public async registerProject(raw: unknown): Promise<ProjectRecord> {
    const input = parseContract(RegisterProjectSchema, raw);
    const root = (await WorkspacePathGuard.create(input.repoPath)).root;
    if (!this.allowed(root) || input.name === SYSTEM_NAME) throw new HttpError(403, "Workspace is outside the configured roots.");
    try {
      const git = simpleGit({ baseDir: root, timeout: { block: 10000 } });
      const top = await git.revparse(["--show-toplevel"]);
      if ((await WorkspacePathGuard.create(top.trim())).root !== root) throw new Error("Not a repository root.");
    } catch { throw new HttpError(422, "Project must identify the root of an existing Git repository."); }
    return this.persistence.registerProject({ ...input, repoPath: root });
  }
  public async prepareDemo(raw: unknown) {
    if (!this.demoEnabled) throw new HttpError(404, "Cloud demo is disabled on this server.");
    if (typeof raw !== "object" || raw === null || Array.isArray(raw) || Object.keys(raw).length !== 0)
      throw new HttpError(422, "Demo preparation accepts only an empty object.");
    const root = this.roots[0]; if (!root) throw new HttpError(503, "No demo workspace is configured.");
    return this.serialize(root, async () => {
      if (this.demoCount >= 20) throw new HttpError(429, "Demo capacity reached (20 sessions per server process).");
      this.demoCount += 1;
      const demo = await createCloudDemo(root);
      const project = await this.registerProject({ name: `Demo Render ${new Date().toISOString()}`, repoPath: demo.repoPath,
        defaultBranch: "Dev", runnerType: "jest" });
      return { project, repair: demo.repair };
    });
  }
  public async audits(projectId?: string) {
    const projects = projectId ? [await this.project(projectId)] : (await this.repository.listProjects()).filter((project) => this.allowed(project.repoPath));
    return (await Promise.all(projects.map((project) => this.repository.listAuditSessions(project.id)))).flat()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  public async audit(id: string, projectId?: string) {
    const audit = await this.repository.getAuditSession(parseContract(IdentifierSchema, id));
    if (!audit || (projectId !== undefined && audit.projectId !== projectId)) throw new HttpError(404, "Audit not found.");
    await this.project(audit.projectId);
    return this.persistence.getAuditDetails(id);
  }
  public async auditDetails(query: ListQuery) {
    if (query.auditId) return [await this.audit(query.auditId, query.projectId)];
    const audits = (await this.audits(query.projectId)).slice(query.offset, query.offset + query.limit);
    return Promise.all(audits.map((audit) => this.persistence.getAuditDetails(audit.id)));
  }
  public async hookLogs(query: HookLogQuery) {
    const filtered = <T extends { decision: string }>(logs: T[]): T[] => query.decision ? logs.filter((log) => log.decision === query.decision) : logs;
    if (query.auditId) return filtered((await this.audit(query.auditId, query.projectId)).hookLogs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(query.offset, query.offset + query.limit);
    const audits = await this.audits(query.projectId);
    const logs = (await Promise.all(audits.map((audit) => this.repository.listHookLogs(audit.id)))).flat();
    return filtered(logs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(query.offset, query.offset + query.limit);
  }
  public async delegations(query: ListQuery) {
    const audits = query.auditId ? [(await this.audit(query.auditId, query.projectId)).audit] : await this.audits(query.projectId);
    return (await Promise.all(audits.map((audit) => this.repository.listDelegations(audit.id)))).flat().slice(query.offset, query.offset + query.limit);
  }
  public hookConfiguration(): HookConfig { return createHookManager(this.hookConfig).getConfig(); }
  private async serialize<T>(root: string, operation: () => Promise<T>): Promise<T> {
    if (this.closed) throw new HttpError(503, "Backend is shutting down.");
    const previous = this.queues.get(root) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => { release = resolve; }); this.queues.set(root, current);
    await previous;
    try { return await operation(); } finally { release(); if (this.queues.get(root) === current) this.queues.delete(root); }
  }
  public async runAudit(raw: unknown) {
    const input = parseContract(RunAuditSchema, raw); const project = await this.project(input.projectId);
    if (input.mode === "repair" && (this.imported(project) || this.requireSandbox) && !(this.sandbox && await this.sandbox.ready())) throw new HttpError(403, "La reparación requiere un sandbox de ejecución operativo; por ahora solo está disponible el análisis estático.");
    try { await this.assertWorkspace(project); }
    catch (error: unknown) {
      // This preflight runs before any audit/patch: a missing workspace is a
      // definitive rejection, not an ambiguous failure after a Git mutation.
      if (error instanceof Error && "code" in error && error.code === ErrorCode.FILE_SYSTEM_ERROR)
        throw new HttpError(409, error.message, ErrorCode.FILE_SYSTEM_ERROR);
      throw error;
    }
    return this.serialize(project.repoPath, async () => {
      if (input.mode === "repair") {
        const result = await this.persistence.repairProject(project.id, input.repair, { runners: this.runners, hookConfig: this.hookConfig, ...(this.sandbox ? { sandbox: this.sandbox } : {}) });
        const details = await this.persistence.getAuditDetails(result.audit.id);
        const blocked = details.hookLogs.some((log) => log.decision === "block");
        return { ...details, mode: input.mode, status: blocked ? "blocked" : result.audit.status, result: result.result };
      }
      const audit = await this.persistence.beginAudit(project.id, input.path);
      const hooks = createHookManager(this.hookConfig, new DatabaseHookPersistenceAdapter(this.repository, audit.id));
      try {
        const coordinator = await DevGuardianCoordinator.create({ workspaceRoot: project.repoPath, runners: this.runners, hookManager: hooks,
          delegationAdapter: new DatabaseDelegationPersistenceAdapter(this.repository) });
        const diagnostic = await coordinator.diagnose(input.path, audit.id, undefined, input.checks);
        await coordinator.delegationStore.consume(diagnostic.taskId, "diagnosis_only", "No patch was requested.");
        await this.repository.saveAuditSession({ ...audit, status: diagnostic.status === "completed" ? "blocked" : "failed", finishedAt: new Date().toISOString(),
          summaryJson: { mode: "diagnose", outcome: diagnostic.status === "completed" ? "diagnosed" : "failed", diagnostic: toJson(diagnostic),
            findings: toJson(diagnostic.output?.findings ?? []), reason: "Diagnostic mode does not authorize a patch or commit." } });
        return { ...await this.persistence.getAuditDetails(audit.id), mode: input.mode, status: diagnostic.status === "completed" ? "blocked" : "failed", diagnostic };
      } catch (error: unknown) { await this.failAudit(audit); throw error; }
    });
  }
  public async evaluateHook(raw: unknown) {
    const input = parseContract(EvaluateHookSchema, raw); const project = await this.project(input.projectId);
    return this.serialize(project.repoPath, async () => {
      const audit = await this.persistence.beginAudit(project.id, input.files[0] ?? "src/guardrail.ts");
      const hooks = createHookManager(this.hookConfig, new DatabaseHookPersistenceAdapter(this.repository, audit.id));
      try {
        const result = await hooks.trigger("pre:apply_patch", { files: input.files, unifiedDiff: input.unifiedDiff });
        await this.repository.saveAuditSession({ ...audit, status: "blocked", finishedAt: new Date().toISOString(),
          summaryJson: { mode: "hook_evaluation", decision: result.ok ? "allow" : "block", mutatedFiles: false } });
        return { auditId: audit.id, decision: result.ok ? "allow" : "block", ...await this.persistence.getAuditDetails(audit.id) };
      } catch (error: unknown) { await this.failAudit(audit); throw error; }
    });
  }
  private async failAudit(audit: AuditSessionRecord): Promise<void> {
    const current = await this.repository.getAuditSession(audit.id);
    if (current && (current.status === "pending" || current.status === "running")) {
      await this.repository.saveAuditSession({ ...current, status: "failed", finishedAt: new Date().toISOString(),
        summaryJson: { ...current.summaryJson, reason: "Operation failed; inspect persisted state before retrying." } });
    }
  }
  private async assertWorkspace(project: ProjectRecord): Promise<void> {
    const canonical = (await WorkspacePathGuard.create(project.repoPath)).root;
    if (canonical !== project.repoPath || !this.allowed(canonical)) throw new HttpError(403, "Registered workspace changed.");
  }
  private async systemProject(): Promise<ProjectRecord> {
    const first = this.roots[0]; if (!first) throw new ValidationError("No system workspace.");
    const existing = (await this.repository.listProjects()).find((project) => project.name === SYSTEM_NAME && project.repoPath === first);
    return existing ?? this.persistence.registerProject({ name: SYSTEM_NAME, repoPath: first, defaultBranch: "devguardian/system", runnerType: "jest" });
  }
  /** All MCP tool calls, including rejected arguments/unknown names, enter a durable hook audit. */
  public async withToolAudit(name: string, raw: unknown, executeTool: (context: ToolContext) => Promise<unknown>,
    onAudit?: (auditId: string) => void): Promise<Result<unknown>> {
    return captureResult(async () => {
      const projectId = typeof raw === "object" && raw !== null && "projectId" in raw ? raw.projectId : undefined;
      const resolved = typeof projectId === "string" ? await captureResult(() => this.project(projectId)) : null;
      const project = resolved?.ok ? resolved.data : await this.systemProject();
      return this.serialize(project.repoPath, async () => {
        const audit = await this.persistence.beginAudit(project.id, "src/mcp/server.ts");
        onAudit?.(audit.id);
        const loggedName = name.slice(0, 128);
        const hooks = createHookManager(this.hookConfig, new DatabaseHookPersistenceAdapter(this.repository, audit.id));
        hooks.register({ id: "mcp-context-policy", name: "MCP context policy", events: ["pre:tool_call"], execute: async () => {
          if (projectId !== undefined && !resolved?.ok) return { decision: "block", reason: "Project is unavailable or outside the allowed roots." };
          if (this.requireSandbox && ["run_tests", "git_create_fix_branch", "git_begin_attempt", "git_apply_patch", "git_commit_fix"].includes(name) && !(this.sandbox && await this.sandbox.ready())) return { decision: "block", reason: "El servidor público requiere aislamiento operativo antes de iniciar una reparación o ejecutar código." };
          if (this.imported(project) && name === "run_tests" && !(this.sandbox && await this.sandbox.ready())) return { decision: "block", reason: "Las pruebas de repositorios importados requieren un sandbox de ejecución; solo está habilitado el análisis estático." };
          const args = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
          const paths = [args["path"], ...(Array.isArray(args["paths"]) ? args["paths"] : [])];
          if (paths.some((value) => typeof value === "string" && /^\.env(?:\.|$)/iu.test(path.basename(value.replaceAll("\\", "/"))))) {
            return { decision: "block", reason: "Secret configuration files cannot be read through MCP." };
          }
          return { decision: "allow", reason: "Tool invocation entered the configured project scope." };
        } });
        let runtime: DomainRuntime | undefined;
        try {
          await hooks.assertAllowed("pre:tool_call", { toolCall: { name: loggedName } });
          const result = await executeTool({ project, audit, hooks, runtime: async () => {
            if (!runtime) { runtime = await this.runtime(project); runtime.router.target = hooks; }
            return runtime;
          } });
          await hooks.assertAllowed("post:tool_call", { toolCall: { name: loggedName } });
          const current = await this.repository.getAuditSession(audit.id);
          if (!current) throw new ValidationError("Tool audit disappeared.");
          await this.repository.saveAuditSession({ ...current, status: "blocked", finishedAt: new Date().toISOString(),
            summaryJson: { ...current.summaryJson, mode: "mcp_tool", tool: loggedName, outcome: "completed", resultReferences: references(result), reason: "Individual tool call; no full repair outcome asserted." } });
          return result;
        } catch (error: unknown) {
          await hooks.notify("post:tool_call", { toolCall: { name: loggedName } });
          const current = await this.repository.getAuditSession(audit.id);
          if (current && (current.status === "running" || current.status === "pending")) await this.repository.saveAuditSession({ ...current,
            status: "blocked", finishedAt: new Date().toISOString(), summaryJson: { ...current.summaryJson, mode: "mcp_tool", tool: loggedName, outcome: "rejected" } });
          throw error;
        } finally { if (runtime) runtime.router.target = null; }
      });
    });
  }
  private async runtime(project: ProjectRecord): Promise<DomainRuntime> {
    await this.assertWorkspace(project);
    const existing = this.runtimes.get(project.id); if (existing) return existing;
    if (this.runtimes.size >= this.maxRuntimes) throw new HttpError(503, "MCP runtime capacity reached; existing sessions are retained.");
    const router = new RoutedHookManager(this.hookConfig); let git: GitController;
    const runner = await TestRunner.create({ workspaceRoot: project.repoPath, runners: this.runners, workspaceStateHash: () => git.workspaceStateHash(), ...(this.sandbox ? { sandbox: this.sandbox } : {}) });
    git = await GitController.create({ workspaceRoot: project.repoPath, verificationStore: runner, hookManager: router });
    const runtime = { router, runner, git, analyzer: await CodeAnalyzer.create({ workspaceRoot: project.repoPath }) };
    this.runtimes.set(project.id, runtime); return runtime;
  }
  public async close(): Promise<void> {
    this.closed = true; await Promise.allSettled([...this.queues.values()]);
    await this.availability;
    for (const runtime of this.runtimes.values()) runtime.runner.cancel();
    this.runtimes.clear(); await this.repository.close();
  }
}
function references(result: unknown) {
  if (typeof result !== "object" || result === null || Array.isArray(result)) return {};
  const keys = ["commit", "branch", "sessionId", "attemptId", "checkpointCommit", "runId", "analysisId", "diffHash"];
  return Object.fromEntries(keys.flatMap((key) => key in result ? [[key, toJson((result as Record<string, unknown>)[key])]] : []));
}
