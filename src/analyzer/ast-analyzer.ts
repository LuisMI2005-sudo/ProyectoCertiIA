import { createHash } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { closeSync, fstatSync, openSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  GetSymbolContextInputSchema, GetSymbolContextOutputSchema, Limits,
  ReadFileContextInputSchema, ReadFileContextOutputSchema, parseContract
} from "../shared/contracts.js";
import type {
  CodeSymbol, Dependency, Diagnostic, GetSymbolContextInput, GetSymbolContextOutput,
  ReadFileContextInput, ReadFileContextOutput, SourceRange
} from "../shared/contracts.js";
import { AnalysisError, DevGuardianError, ValidationError } from "../shared/errors.js";
import { WorkspacePathGuard, validateWorkspaceRelativePath } from "../shared/path-security.js";
import type {
  AnalyzerLimits, AnalyzerOptions, AstAnalysis, AstFile, AstSymbolEntry, SourceSnapshot
} from "./types.js";

const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const hash = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

function lineStartsOf(text: string): number[] {

  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    const character = text.charCodeAt(index);
    if (character === 13 && text.charCodeAt(index + 1) === 10) index++;
    if (character === 10 || character === 13 || character === 0x2028 || character === 0x2029) starts.push(index + 1);
  }
  return starts;
}

function lineAtOffset(starts: readonly number[], offset: number): number {
  let low = 0, high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if ((starts[middle] ?? 0) <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

export function boundedText(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  const end = text.charCodeAt(maximum - 1);
  return text.slice(0, end >= 0xd800 && end <= 0xdbff ? maximum - 1 : maximum);
}

export function rangeOf(source: ts.SourceFile, start: number, end: number): SourceRange {
  const beginning = source.getLineAndCharacterOfPosition(Math.max(0, Math.min(start, source.text.length)));
  const ending = source.getLineAndCharacterOfPosition(Math.max(start, Math.min(end, source.text.length)));
  return {
    start: { line: beginning.line + 1, column: beginning.character + 1 },
    end: { line: ending.line + 1, column: ending.character + 1 }
  };
}

/** Compiler callbacks are synchronous: every access has canonical boundary checks. */
class CompilerFileSystem {
  private readonly contents = new Map<string, string>();
  private bytes = 0;
  private readonly libraryRoot: string;

  public constructor(private readonly guard: WorkspacePathGuard, private readonly limits: AnalyzerLimits) {
    this.libraryRoot = realpathSync(path.dirname(ts.getDefaultLibFilePath({})));
  }

  private permitted(candidate: string): string | undefined {
    try {
      const absolute = path.resolve(this.guard.root, candidate);
      const relative = path.relative(this.guard.root, absolute);
      const library = path.dirname(absolute) === this.libraryRoot && /^lib(?:\.[\w.-]+)?\.d\.ts$/u.test(path.basename(absolute));
      if (!library) {
        if (relative === "") return realpathSync(absolute) === this.guard.root ? this.guard.root : undefined;
        validateWorkspaceRelativePath(relative);
      }
      const canonical = realpathSync(absolute);
      if (library) return path.dirname(canonical) === this.libraryRoot ? canonical : undefined;
      validateWorkspaceRelativePath(path.relative(this.guard.root, canonical));
      return canonical;
    } catch {
      return undefined;
    }
  }

  public fileExists = (candidate: string): boolean => {
    const safe = this.permitted(candidate);
    return safe !== undefined && statSync(safe).isFile();
  };
  public directoryExists = (candidate: string): boolean => {
    const safe = this.permitted(candidate);
    return safe !== undefined && statSync(safe).isDirectory();
  };
  public realpath = (candidate: string): string => this.permitted(candidate) ?? candidate;
  public getDirectories = (candidate: string): string[] => {
    const safe = this.permitted(candidate);
    if (!safe || !statSync(safe).isDirectory()) return [];
    return readdirSync(safe, { withFileTypes: true })
      .filter((entry) => this.directoryExists(path.join(safe, entry.name))).map((entry) => entry.name);
  };
  public readFile = (candidate: string): string | undefined => {
    const safe = this.permitted(candidate);
    if (!safe || !statSync(safe).isFile()) return undefined;
    const cached = this.contents.get(safe);
    if (cached !== undefined) return cached;
    if (this.contents.size >= this.limits.maxProgramFiles || statSync(safe).size > this.limits.maxFileBytes) {
      throw new AnalysisError("Compiler input exceeds configured file limits.");
    }
    const descriptor = openSync(safe, "r");
    let buffer: Buffer;
    try {
      const metadata = fstatSync(descriptor);
      if (metadata.size > this.limits.maxFileBytes) throw new AnalysisError("Compiler file grew beyond its size limit.");
      const allocation = Buffer.alloc(Math.min(metadata.size + 1, this.limits.maxFileBytes + 1));
      let length = 0;
      while (length < allocation.length) {
        const count = readSync(descriptor, allocation, length, allocation.length - length, length);
        if (count === 0) break;
        length += count;
      }
      const after = fstatSync(descriptor);
      if (length !== metadata.size || after.size !== metadata.size || after.mtimeMs !== metadata.mtimeMs ||
        after.ctimeMs !== metadata.ctimeMs || this.permitted(candidate) !== safe) {
        throw new AnalysisError("Compiler file changed during analysis.", { retryable: true });
      }
      buffer = allocation.subarray(0, length);
    } finally { closeSync(descriptor); }
    if (buffer.length > this.limits.maxFileBytes || this.bytes + buffer.length > this.limits.maxProgramBytes) {
      throw new AnalysisError("Compiler input exceeds configured byte limits.");
    }
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer); }
    catch (error: unknown) { throw new AnalysisError("Compiler input must be valid UTF-8.", { cause: error }); }
    this.bytes += buffer.length;
    this.contents.set(safe, text);
    return text;
  };
  public seed(snapshot: SourceSnapshot): void {
    if (!this.contents.has(snapshot.absolutePath)) {
      if (this.contents.size >= this.limits.maxProgramFiles) throw new AnalysisError("Requested files exceed the program file limit.");
      this.bytes += Buffer.byteLength(snapshot.text);
      if (this.bytes > this.limits.maxProgramBytes) throw new AnalysisError("Requested files exceed the program byte limit.");
      this.contents.set(snapshot.absolutePath, snapshot.text);
    }
  }
}

export class AstAnalyzer {
  public constructor(
    public readonly guard: WorkspacePathGuard,
    public readonly limits: AnalyzerLimits,
    private readonly options: AnalyzerOptions
  ) { }

  public async snapshot(input: string): Promise<SourceSnapshot> {
    const resolved = await this.guard.resolve(input);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(resolved.absolutePath, "r");
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size > this.limits.maxFileBytes) {
        throw new AnalysisError("Requested file exceeds its size limit or is not a regular file.");
      }
      // The extra byte detects growth after stat without an unbounded readFile().
      const buffer = Buffer.alloc(this.limits.maxFileBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > this.limits.maxFileBytes) throw new AnalysisError("Requested file grew beyond its size limit.");
      const after = await handle.stat();
      const verified = await this.guard.resolve(input);
      const identity = await stat(verified.absolutePath);
      if (verified.absolutePath !== resolved.absolutePath || after.size !== length ||
        after.mtimeMs !== metadata.mtimeMs || after.ctimeMs !== metadata.ctimeMs ||
        identity.ino !== after.ino || identity.dev !== after.dev) {
        throw new AnalysisError("Requested file changed during the read.", { retryable: true });
      }
      const content = buffer.subarray(0, length);
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(content);
      if (text.includes("\0")) throw new AnalysisError("Binary files cannot be analyzed as source text.");
      return {
        path: resolved.relativePath, absolutePath: resolved.absolutePath, text,
        fileHash: hash(content), lineStarts: lineStartsOf(text)
      };
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new AnalysisError("Cannot read source text; UTF-8 is required.", { cause: error });
    } finally { await handle?.close(); }
  }

  public async readFileContext(input: ReadFileContextInput): Promise<ReadFileContextOutput> {
    const parsed = parseContract(ReadFileContextInputSchema, input);
    const snapshot = await this.snapshot(parsed.path);
    const startLine = parsed.startLine ?? 1;
    if (startLine > snapshot.lineStarts.length) throw new ValidationError("Requested start line is beyond the file.");
    const lastLine = Math.min(parsed.endLine ?? snapshot.lineStarts.length, snapshot.lineStarts.length);
    const start = snapshot.lineStarts[startLine - 1] ?? 0;
    const end = snapshot.lineStarts[lastLine] ?? snapshot.text.length;
    const selected = snapshot.text.slice(start, end);
    const content = boundedText(selected, this.limits.maxContextCharacters);
    const endLine = snapshot.text.length === 0 ? 0 : content.length === 0 ? startLine :
      lineAtOffset(snapshot.lineStarts, start + content.length - 1);
    return parseContract(ReadFileContextOutputSchema, {
      path: snapshot.path, content, startLine, endLine, fileHash: snapshot.fileHash,
      truncated: content.length < selected.length
    });
  }

  private compilerOptions(files: readonly SourceSnapshot[], fs: CompilerFileSystem): ts.CompilerOptions {
    const defaults: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true, allowJs: true, checkJs: true, types: [], lib: ["lib.es2023.d.ts"], skipLibCheck: true
    };
    const configPath = path.join(this.guard.root, this.options.tsconfigPath ?? "tsconfig.json");
    let configured: ts.CompilerOptions = {};
    if (this.options.tsconfigPath !== undefined) validateWorkspaceRelativePath(this.options.tsconfigPath);
    if (fs.fileExists(configPath)) {
      const config = ts.readConfigFile(configPath, fs.readFile);
      if (config.error) throw new AnalysisError("Invalid TypeScript configuration.");
      const parsed = ts.parseJsonConfigFileContent(config.config, {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        fileExists: fs.fileExists, readFile: fs.readFile,
        readDirectory: () => files.map((file) => file.absolutePath)
      }, path.dirname(configPath));
      if (parsed.errors.some((error) => error.code !== 18003 && error.code !== 18002)) {
        throw new AnalysisError("TypeScript configuration contains invalid or inaccessible options.");
      }
      configured = parsed.options;
    } else if (this.options.tsconfigPath !== undefined) {
      throw new AnalysisError("Configured tsconfig is missing or outside the workspace.");
    }
    const effective = {
      ...defaults, ...configured, ...this.options.compilerOptions,
      noEmit: true, incremental: false, composite: false, rootDir: this.guard.root
    };
    delete effective.tsBuildInfoFile;
    return effective;
  }

  private nameNodes(node: ts.Node): ts.Node[] {
    const collect = (name: ts.Node): ts.Node[] => {
      if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return [name];
      if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        return name.elements.flatMap((element) => ts.isBindingElement(element) ? collect(element.name) : []);
      }
      return [];
    };
    if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isModuleDeclaration(node) ||
      ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      return node.name ? collect(node.name) : [];
    }
    return [];
  }

  private table(source: ts.SourceFile, checker: ts.TypeChecker, file: string): { entries: AstSymbolEntry[]; truncated: boolean } {
    const entries: AstSymbolEntry[] = [];
    const work: ts.Node[] = [source];
    let count = 0, truncated = false;
    while (work.length > 0) {
      const node = work.pop();
      if (!node) continue;
      if (++count > this.limits.maxAstNodes) throw new AnalysisError("AST exceeds its configured node limit.");
      const children: ts.Node[] = [];
      node.forEachChild((child) => { children.push(child); });
      work.push(...children.reverse());
      let kind: CodeSymbol["kind"] | undefined;
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) kind = "function";
      else if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) kind = "method";
      else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) kind = "class";
      else if (ts.isInterfaceDeclaration(node)) kind = "interface";
      else if (ts.isTypeAliasDeclaration(node)) kind = "type";
      else if (ts.isModuleDeclaration(node)) kind = "module";
      else if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) kind = "variable";
      if (!kind) continue;
      const start = node.getStart(source), end = node.end;
      const names = this.nameNodes(node);
      const parent = node.parent;
      const inferredName = (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
        (ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent)) ? parent.name.getText(source) : undefined;
      const name = names.map((nameNode) => nameNode.getText(source)).join(", ") || inferredName ||
        (ts.isConstructorDeclaration(node) ? "constructor" : `<anonymous@${source.getLineAndCharacterOfPosition(start).line + 1}>`);
      let signature: string;
      if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
        const type = checker.typeToString(checker.getTypeAtLocation(node), node, ts.TypeFormatFlags.NoTruncation);
        const prefix = ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(parent) ?
          (parent.flags & ts.NodeFlags.Const) !== 0 ? "const " : (parent.flags & ts.NodeFlags.Let) !== 0 ? "let " : "var " : "";
        signature = `${prefix}${node.name.getText(source)}: ${type}`;
      } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isInterfaceDeclaration(node)) {
        signature = source.text.slice(start, Math.max(start, node.members.pos - 1)).trim();
      } else if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
        const typed = checker.getSignatureFromDeclaration(node);
        signature = typed ? `${name}${checker.signatureToString(typed, node, ts.TypeFormatFlags.NoTruncation)}` :
          source.text.slice(start, node.body?.getStart(source) ?? end).trim();
      } else signature = node.getText(source);
      if (signature.length > this.limits.maxContextCharacters || name.length > 1024) truncated = true;
      entries.push({
        node, nameNodes: names.length > 0 ? names :
          ((ts.isVariableDeclaration(parent) || ts.isPropertyDeclaration(parent)) ? this.nameNodes(parent) : []),
        start, end, symbol: {
          path: file, name: boundedText(name, 1024), kind,
          signature: boundedText(signature, this.limits.maxContextCharacters), range: rangeOf(source, start, end)
        }
      });
      if (entries.length > 10_000) throw new AnalysisError("File exceeds the symbol table limit.");
    }
    return { entries, truncated };
  }

  private imports(source: ts.SourceFile, file: string, options: ts.CompilerOptions, fs: CompilerFileSystem): { dependencies: Dependency[]; truncated: boolean } {
    const imports: Dependency[] = [];
    let truncated = false;
    const add = (literal: ts.StringLiteralLike, typeOnly: boolean, mode?: ts.ResolutionMode): void => {
      const specifier = literal.text;
      truncated ||= specifier.length > 4096;
      const resolved = ts.resolveModuleName(specifier, source.fileName, options, fs, undefined, undefined,
        mode ?? ts.getModeForUsageLocation(source, literal, options)).resolvedModule;
      let resolvedPath: string | null = null;
      if (resolved) {
        try { resolvedPath = validateWorkspaceRelativePath(path.relative(this.guard.root, fs.realpath(resolved.resolvedFileName))); }
        catch { resolvedPath = null; }
      }
      const dependency: Dependency = {
        from: file, specifier: boundedText(specifier, 4096), resolvedPath,
        external: !specifier.startsWith(".") && !path.isAbsolute(specifier) &&
          (resolvedPath === null || resolvedPath.split("/").includes("node_modules")), typeOnly
      };
      if (!imports.some((entry) => entry.specifier === dependency.specifier && entry.typeOnly === dependency.typeOnly)) imports.push(dependency);
      if (imports.length > 10_000) throw new AnalysisError("File exceeds the dependency limit.");
    };
    const work: ts.Node[] = [source];
    while (work.length > 0) {
      const node = work.pop();
      if (!node) continue;
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        add(node.moduleSpecifier, clause?.isTypeOnly === true ||
          (clause?.name === undefined && named !== undefined && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((entry) => entry.isTypeOnly)));
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        add(node.moduleSpecifier, node.isTypeOnly || (node.exportClause !== undefined &&
          ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 &&
          node.exportClause.elements.every((entry) => entry.isTypeOnly)));
      }
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) add(node.moduleReference.expression, node.isTypeOnly, ts.ModuleKind.CommonJS);
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) add(node.argument.literal, true);
      else if (ts.isCallExpression(node) && node.arguments.length === 1 &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) add(argument, false,
          node.expression.kind === ts.SyntaxKind.ImportKeyword ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS);
      }
      node.forEachChild((child) => { work.push(child); });
    }
    return { dependencies: imports, truncated };
  }

  public async analyze(paths: readonly string[], checks: readonly ("syntax" | "semantic" | "lint")[]): Promise<AstAnalysis> {
    try {
      const snapshots: SourceSnapshot[] = [];
      for (const file of paths) {
        if (!EXTENSIONS.has(path.extname(file).toLowerCase())) throw new AnalysisError("AST analysis requires a supported TypeScript or JavaScript extension.");
        snapshots.push(await this.snapshot(file));
      }
      if (new Set(snapshots.map((snapshot) => snapshot.absolutePath)).size !== snapshots.length) {
        throw new ValidationError("Requested paths resolve to duplicate source files.");
      }
      const fs = new CompilerFileSystem(this.guard, this.limits);
      snapshots.forEach((snapshot) => fs.seed(snapshot));
      const options = this.compilerOptions(snapshots, fs);
      const host = ts.createCompilerHost(options, true);
      host.getCurrentDirectory = () => this.guard.root;
      host.readFile = fs.readFile; host.fileExists = fs.fileExists;
      host.directoryExists = fs.directoryExists; host.getDirectories = fs.getDirectories; host.realpath = fs.realpath;
      host.getSourceFile = (fileName, languageVersion) => {
        const text = fs.readFile(fileName);
        return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
      };
      host.writeFile = () => { throw new AnalysisError("Analyzer cannot emit files."); };
      const program = ts.createProgram({ rootNames: snapshots.map((file) => file.absolutePath), options, host });
      const checker = program.getTypeChecker();
      const files = new Map<string, AstFile>();
      const diagnostics: Diagnostic[] = [];
      let truncated = false;
      for (const snapshot of snapshots) {
        const sourceFile = program.getSourceFile(snapshot.absolutePath);
        if (!sourceFile) throw new AnalysisError("Compiler could not parse the requested file.");
        const table = this.table(sourceFile, checker, snapshot.path);
        const imports = this.imports(sourceFile, snapshot.path, options, fs);
        truncated ||= table.truncated || imports.truncated;
        files.set(snapshot.path, {
          snapshot, sourceFile, symbols: table.entries,
          dependencies: imports.dependencies
        });
        const sourceDiagnostics = [
          ...(checks.includes("syntax") ? program.getSyntacticDiagnostics(sourceFile) : []),
          ...(checks.includes("semantic") ? program.getSemanticDiagnostics(sourceFile) : [])
        ];
        for (const diagnostic of sourceDiagnostics) {
          if (diagnostics.length >= this.limits.maxDiagnostics) { truncated = true; break; }
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
          truncated ||= message.length > Limits.maxFileContextCharacters;
          diagnostics.push({
            path: snapshot.path, source: "typescript", code: `TS${diagnostic.code}`,
            severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" :
              diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "info",
            message: boundedText(message, Limits.maxFileContextCharacters),
            range: diagnostic.start === undefined ? null : rangeOf(sourceFile, diagnostic.start, diagnostic.start + (diagnostic.length ?? 0))
          });
        }
      }
      if (checks.includes("semantic")) {
        const first = snapshots[0];
        if (first) {
          for (const diagnostic of [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]) {
            if (diagnostics.length >= this.limits.maxDiagnostics) { truncated = true; break; }
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            truncated ||= message.length > Limits.maxFileContextCharacters;
            diagnostics.push({
              path: first.path, source: "typescript", code: `TS${diagnostic.code}`,
              severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" :
                diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "info",
              message: boundedText(message, Limits.maxFileContextCharacters), range: null
            });
          }
        }
      }
      return { files, diagnostics, program, checker, truncated };
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new AnalysisError("TypeScript analysis failed.", { cause: error });
    }
  }

  public enclosingSymbol(file: AstFile, line: number, column?: number): AstSymbolEntry | undefined {
    const offset = column === undefined ? undefined : (file.snapshot.lineStarts[line - 1] ?? 0) + column - 1;
    return file.symbols.filter((entry) => offset === undefined ?
      entry.symbol.range.start.line <= line && entry.symbol.range.end.line >= line :
      entry.start <= offset && entry.end >= offset).sort((left, right) => left.end - left.start - (right.end - right.start))[0];
  }

  public async getSymbolContext(input: GetSymbolContextInput): Promise<GetSymbolContextOutput> {
    const parsed = parseContract(GetSymbolContextInputSchema, input);
    const analysis = await this.analyze([parsed.path], []);
    const file = [...analysis.files.values()][0];
    if (!file || parsed.line > file.snapshot.lineStarts.length) throw new ValidationError("Requested line is beyond the source file.");
    const entry = this.enclosingSymbol(file, parsed.line);
    if (!entry) throw new AnalysisError("No supported enclosing symbol exists on the requested line.");
    const symbols = new Set(entry.nameNodes.map((node) => analysis.checker.getSymbolAtLocation(node)).filter((symbol) => symbol !== undefined));
    const references: GetSymbolContextOutput["references"] = [];
    const work: ts.Node[] = [file.sourceFile];
    let truncated = analysis.truncated;
    while (work.length > 0) {
      const node = work.pop();
      if (!node) continue;
      if (ts.isIdentifier(node) && !entry.nameNodes.includes(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent) ?
          analysis.checker.getShorthandAssignmentValueSymbol(node.parent) : analysis.checker.getSymbolAtLocation(node);
        const declarationName = symbol?.declarations?.some((declaration) => this.nameNodes(declaration).includes(node));
        if (symbol && symbols.has(symbol) && !declarationName) {
          if (references.length >= this.limits.maxReferences) { truncated = true; break; }
          references.push({ path: file.snapshot.path, range: rangeOf(file.sourceFile, node.getStart(file.sourceFile), node.end) });
        }
      }
      const children: ts.Node[] = [];
      node.forEachChild((child) => { children.push(child); });
      work.push(...children.reverse());
    }
    const exact = file.snapshot.text.slice(entry.start, entry.end);
    const source = boundedText(exact, this.limits.maxContextCharacters);
    truncated ||= source.length < exact.length;
    return parseContract(GetSymbolContextOutputSchema, {
      symbol: entry.symbol, signature: entry.symbol.signature, range: entry.symbol.range, source,
      imports: file.dependencies, references, fileHash: file.snapshot.fileHash, truncated
    });
  }
}
