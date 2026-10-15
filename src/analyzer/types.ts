import type ts from "typescript";
import type { Linter } from "eslint";
import type { AnalyzeCodeOutput, CodeSymbol, Dependency, Diagnostic } from "../shared/contracts.js";

export interface AnalyzerOptions {
  readonly workspaceRoot: string;
  readonly tsconfigPath?: string;
  readonly compilerOptions?: ts.CompilerOptions;
  readonly eslintConfig?: Linter.Config[];
  readonly useWorkspaceEslintConfig?: boolean;
  readonly maxFileBytes?: number;
  readonly maxProgramBytes?: number;
  readonly maxProgramFiles?: number;
  readonly maxAstNodes?: number;
  readonly maxContextCharacters?: number;
  readonly maxDiagnostics?: number;
  readonly maxReferences?: number;
  readonly maxStoredAnalyses?: number;
  readonly maxStoredBytes?: number;
  readonly analysisTtlMs?: number;
}

export interface AnalyzerLimits {
  readonly maxFileBytes: number;
  readonly maxProgramBytes: number;
  readonly maxProgramFiles: number;
  readonly maxAstNodes: number;
  readonly maxContextCharacters: number;
  readonly maxDiagnostics: number;
  readonly maxReferences: number;
  readonly maxStoredAnalyses: number;
  readonly maxStoredBytes: number;
  readonly analysisTtlMs: number;
}

export interface SourceSnapshot {
  readonly path: string;
  readonly absolutePath: string;
  readonly text: string;
  readonly fileHash: string;
  readonly lineStarts: readonly number[];
}

export interface AstSymbolEntry {
  readonly node: ts.Node;
  readonly nameNodes: readonly ts.Node[];
  readonly start: number;
  readonly end: number;
  readonly symbol: CodeSymbol;
}

export interface AstFile {
  readonly snapshot: SourceSnapshot;
  readonly sourceFile: ts.SourceFile;
  readonly symbols: readonly AstSymbolEntry[];
  readonly dependencies: readonly Dependency[];
}

export interface AstAnalysis {
  readonly files: ReadonlyMap<string, AstFile>;
  readonly diagnostics: readonly Diagnostic[];
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly truncated: boolean;
}

export interface StoredAnalysis {
  readonly result: AnalyzeCodeOutput;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly bytes: number;
  readonly fileHashes: Readonly<Record<string, string>>;
}

export interface AnalysisMetadata {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly fileHashes: Readonly<Record<string, string>>;
}
