import { randomUUID } from "node:crypto";
import {
  AnalyzeCodeInputSchema, AnalyzeCodeOutputSchema, IdentifierSchema, Limits, parseContract
} from "../shared/contracts.js";
import type {
  AnalyzeCodeInput, AnalyzeCodeOutput, CodeAnalyzer as CodeAnalyzerContract, CodeSymbol, ToolHandler
} from "../shared/contracts.js";
import { AnalysisError, ValidationError, captureResult, failure } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import { WorkspacePathGuard } from "../shared/path-security.js";
import { AstAnalyzer } from "./ast-analyzer.js";
import { EslintAnalyzer } from "./eslint-analyzer.js";
import type { AnalysisMetadata, AnalyzerLimits, AnalyzerOptions, StoredAnalysis } from "./types.js";

export interface AnalyzerTools {
  readonly read_file_context: ToolHandler<"read_file_context">;
  readonly analyze_code: ToolHandler<"analyze_code">;
  readonly get_symbol_context: ToolHandler<"get_symbol_context">;
}

function limitsFor(options: AnalyzerOptions): AnalyzerLimits {
  const limits: AnalyzerLimits = {
    maxFileBytes: options.maxFileBytes ?? 5_000_000,
    maxProgramBytes: options.maxProgramBytes ?? 32_000_000,
    maxProgramFiles: options.maxProgramFiles ?? 2000,
    maxAstNodes: options.maxAstNodes ?? 200_000,
    maxContextCharacters: options.maxContextCharacters ?? Limits.maxFileContextCharacters,
    maxDiagnostics: options.maxDiagnostics ?? 1000,
    maxReferences: options.maxReferences ?? 1000,
    maxStoredAnalyses: options.maxStoredAnalyses ?? 100,
    maxStoredBytes: options.maxStoredBytes ?? 10_000_000,
    analysisTtlMs: options.analysisTtlMs ?? 300_000
  };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new ValidationError("Analyzer limits must be positive safe integers.");
  }
  if (limits.maxFileBytes > 10_000_000 || limits.maxProgramBytes > 100_000_000 ||
      limits.maxContextCharacters > Limits.maxFileContextCharacters || limits.maxDiagnostics > 10_000 ||
      limits.maxReferences > 10_000 || limits.maxStoredBytes > 100_000_000 || limits.maxStoredAnalyses > 1000 ||
      limits.maxProgramFiles > 10_000 || limits.maxAstNodes > 1_000_000 || limits.analysisTtlMs > 86_400_000) {
    throw new ValidationError("Analyzer limits exceed supported maximums.");
  }
  return limits;
}

export class CodeAnalyzer implements CodeAnalyzerContract {
  public readonly readFileContext: CodeAnalyzerContract["readFileContext"];
  public readonly getSymbolContext: CodeAnalyzerContract["getSymbolContext"];
  public readonly tools: AnalyzerTools;
  private readonly analyses = new Map<string, StoredAnalysis>();
  private storedBytes = 0;
  private tail: Promise<void> = Promise.resolve();

  private constructor(private readonly ast: AstAnalyzer, private readonly eslint: EslintAnalyzer,
    private readonly limits: AnalyzerLimits) {
    this.readFileContext = (input) => this.serialized(() => ast.readFileContext(input));
    this.getSymbolContext = (input) => this.serialized(() => ast.getSymbolContext(input));
    this.tools = {
      read_file_context: (input) => captureResult(() => this.readFileContext(input)),
      analyze_code: (input) => captureResult(() => this.analyzeCode(input)),
      get_symbol_context: (input) => captureResult(() => this.getSymbolContext(input))
    };
  }

  public static async create(options: AnalyzerOptions): Promise<CodeAnalyzer> {
    const limits = limitsFor(options);
    const guard = await WorkspacePathGuard.create(options.workspaceRoot);
    return new CodeAnalyzer(new AstAnalyzer(guard, limits, options),
      new EslintAnalyzer({ ...options, workspaceRoot: guard.root }, limits), limits);
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); }
    finally { release(); }
  }

  private remove(id: string): void {
    const analysis = this.analyses.get(id);
    if (analysis) { this.storedBytes -= analysis.bytes; this.analyses.delete(id); }
  }

  private expire(): void {
    const now = Date.now();
    for (const [id, analysis] of this.analyses) if (analysis.expiresAt <= now) this.remove(id);
  }

  public async analyzeCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
    const parsed = parseContract(AnalyzeCodeInputSchema, input);
    return this.serialized(async () => {
      const ast = await this.ast.analyze(parsed.paths, parsed.checks);
      const lint = parsed.checks.includes("lint") ? await this.eslint.analyze([...ast.files.values()].map((file) => file.snapshot)) :
        { diagnostics: [], truncated: false };
      const allDiagnostics = [...ast.diagnostics, ...lint.diagnostics];
      const diagnostics = allDiagnostics.slice(0, this.limits.maxDiagnostics);
      const affected = new Map<string, CodeSymbol>();
      for (const diagnostic of diagnostics) {
        const file = ast.files.get(diagnostic.path);
        if (!file || !diagnostic.range) continue;
        const entry = this.ast.enclosingSymbol(file, diagnostic.range.start.line, diagnostic.range.start.column);
        if (entry) affected.set(`${entry.symbol.path}:${entry.start}:${entry.end}`, entry.symbol);
      }
      const dependencies = [...ast.files.values()].flatMap((file) => [...file.dependencies]);
      const result = parseContract(AnalyzeCodeOutputSchema, {
        analysisId: randomUUID(), diagnostics, affectedSymbols: [...affected.values()].slice(0, 10_000),
        dependencies: dependencies.slice(0, 10_000), analyzedFiles: [...ast.files.keys()],
        truncated: ast.truncated || lint.truncated || allDiagnostics.length > diagnostics.length ||
          dependencies.length > 10_000 || affected.size > 10_000
      });
      const storedResult = structuredClone(result);
      const bytes = Buffer.byteLength(JSON.stringify(storedResult));
      if (bytes > this.limits.maxStoredBytes) throw new AnalysisError("Analysis result exceeds the configured storage budget.");
      this.expire();
      while (this.analyses.size >= this.limits.maxStoredAnalyses || this.storedBytes + bytes > this.limits.maxStoredBytes) {
        const oldest = this.analyses.keys().next().value;
        if (oldest === undefined) break;
        this.remove(oldest);
      }
      const now = Date.now();
      this.analyses.set(result.analysisId, { result: storedResult, bytes, createdAt: now,
        expiresAt: now + this.limits.analysisTtlMs,
        fileHashes: Object.fromEntries([...ast.files].map(([file, data]) => [file, data.snapshot.fileHash])) });
      this.storedBytes += bytes;
      return result;
    });
  }

  private stored(analysisId: string): StoredAnalysis {
    parseContract(IdentifierSchema, analysisId);
    this.expire();
    const stored = this.analyses.get(analysisId);
    if (!stored) throw new AnalysisError("Analysis ID is unknown, expired or evicted.");
    this.analyses.delete(analysisId);
    this.analyses.set(analysisId, stored);
    return stored;
  }

  public getAnalysis(analysisId: string): Result<AnalyzeCodeOutput> {
    try { return { ok: true, data: structuredClone(this.stored(analysisId).result) }; }
    catch (error: unknown) {
      // Resource reads use the same error envelope as tool handlers.
      return failure(error);
    }
  }

  public getAnalysisMetadata(analysisId: string): Result<AnalysisMetadata> {
    try {
      const stored = this.stored(analysisId);
      return { ok: true, data: { analysisId, createdAt: new Date(stored.createdAt).toISOString(),
        expiresAt: new Date(stored.expiresAt).toISOString(), fileHashes: structuredClone(stored.fileHashes) } };
    } catch (error: unknown) { return failure(error); }
  }

  public clearAnalyses(): void { this.analyses.clear(); this.storedBytes = 0; }
}

export function createCodeAnalyzer(options: AnalyzerOptions): Promise<Result<CodeAnalyzer>> {
  return captureResult(() => CodeAnalyzer.create(options));
}

export { AstAnalyzer } from "./ast-analyzer.js";
export { EslintAnalyzer } from "./eslint-analyzer.js";
export type { AnalyzerOptions, AnalysisMetadata } from "./types.js";
