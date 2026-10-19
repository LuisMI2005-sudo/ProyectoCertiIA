import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodeAnalyzer, createCodeAnalyzer } from '../../dist/analyzer/index.js';
import { ToolSchemas, resultSchema } from '../../dist/shared/contracts.js';

jest.setTimeout(60000);
const sha = (text) => createHash('sha256').update(text).digest('hex');
const unwrap = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
let root, analyzer;
beforeEach(async () => {
  root = await mkdtemp(path.join(process.cwd(), '.phase3-test-'));
  await cp(path.join(process.cwd(), 'fixtures', 'typescript'), root, { recursive: true });
  analyzer = await CodeAnalyzer.create({ workspaceRoot: root });
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
const lineOf = async (file, text) => (await readFile(path.join(root, file), 'utf8')).split('\n')
  .findIndex((line) => line.includes(text)) + 1;
const analyze = (paths, checks = ['syntax', 'semantic']) => analyzer.tools.analyze_code({ paths, checks });
const context = async (file, text) => analyzer.tools.get_symbol_context({ path: file, line: await lineOf(file, text) });

describe('bounded source reading', () => {
  test('returns exact source bytes and full-file SHA-256', async () => {
    const text = await readFile(path.join(root, 'domain.ts'), 'utf8');
    const result = await analyzer.tools.read_file_context({ path: 'domain.ts' });
    expect(resultSchema(ToolSchemas.read_file_context.output).safeParse(result).success).toBe(true);
    expect(unwrap(result)).toMatchObject({ content: text, fileHash: sha(text), truncated: false, startLine: 1 });
  });
  test('selects inclusive lines and preserves CRLF and a UTF-8 BOM', async () => {
    const text = '\ufefffirst\r\nsecond\r\nthird\r\n';
    await writeFile(path.join(root, 'lines.txt'), text);
    const selected = unwrap(await analyzer.tools.read_file_context({ path: 'lines.txt', startLine: 2, endLine: 2 }));
    expect(selected).toMatchObject({ content: 'second\r\n', startLine: 2, endLine: 2, fileHash: sha(text), truncated: false });
    const full = unwrap(await analyzer.tools.read_file_context({ path: 'lines.txt' }));
    expect(full.content).toBe(text);
  });
  test('clips output without hashing only the clipped portion', async () => {
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxContextCharacters: 8 });
    const text = '12345678\nmore data\n';
    await writeFile(path.join(root, 'large.txt'), text);
    expect(unwrap(await limited.tools.read_file_context({ path: 'large.txt' })))
      .toMatchObject({ content: '12345678', endLine: 1, truncated: true, fileHash: sha(text) });
  });
  test('does not split a Unicode surrogate pair at the output limit', async () => {
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxContextCharacters: 2 });
    await writeFile(path.join(root, 'unicode.txt'), 'a😀b');
    expect(unwrap(await limited.tools.read_file_context({ path: 'unicode.txt' }))).toMatchObject({ content: 'a', truncated: true });
  });
  test('reads deeply malformed source as text without invoking the AST parser', async () => {
    const text = '('.repeat(10000);
    await writeFile(path.join(root, 'deep.ts'), text);
    expect(unwrap(await analyzer.tools.read_file_context({ path: 'deep.ts' })))
      .toMatchObject({ content: text, fileHash: sha(text), truncated: false });
    await writeFile(path.join(root, 'separators.txt'), 'first\rsecond\u2028third\u2029last');
    expect(unwrap(await analyzer.tools.read_file_context({ path: 'separators.txt', startLine: 2, endLine: 3 })))
      .toMatchObject({ content: 'second\u2028third\u2029', startLine: 2, endLine: 3 });
  });
  test('handles empty files and rejects out-of-range or reversed lines', async () => {
    await writeFile(path.join(root, 'empty.ts'), '');
    expect(unwrap(await analyzer.tools.read_file_context({ path: 'empty.ts' })))
      .toMatchObject({ content: '', startLine: 1, endLine: 0, fileHash: sha(''), truncated: false });
    expect(await analyzer.tools.read_file_context({ path: 'domain.ts', startLine: 100 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await analyzer.tools.read_file_context({ path: 'domain.ts', startLine: 3, endLine: 1 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
  test('rejects oversized, binary and invalid UTF-8 files', async () => {
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxFileBytes: 8 });
    expect(await limited.tools.read_file_context({ path: 'domain.ts' })).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    await writeFile(path.join(root, 'binary.ts'), Buffer.from([0, 1, 2]));
    await writeFile(path.join(root, 'invalid.ts'), Buffer.from([0xff, 0xfe]));
    for (const file of ['binary.ts', 'invalid.ts']) {
      expect(await analyzer.tools.read_file_context({ path: file })).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    }
  });
});

describe('AST symbol context', () => {
  test('selects a named function and extracts exact source and its signature', async () => {
    const result = await context('symbols.ts', 'return left + right');
    expect(resultSchema(ToolSchemas.get_symbol_context.output).safeParse(result).success).toBe(true);
    const data = unwrap(result);
    const newline = (await readFile(path.join(root, 'symbols.ts'), 'utf8')).includes('\r\n') ? '\r\n' : '\n';
    expect(data.symbol).toMatchObject({ name: 'add', kind: 'function', path: 'symbols.ts' });
    expect(data.source).toBe(`export function add(left: number, right: number): number {${newline}  return left + right;${newline}}`);
    expect(data.signature).toContain('left: number');
    expect(data.signature).toContain('right: number');
    expect(data.fileHash).toBe(sha(await readFile(path.join(root, 'symbols.ts'))));
    expect(data.truncated).toBe(false);
  });
  test('finds methods instead of the enclosing class', async () => {
    const data = unwrap(await context('symbols.ts', 'return `Hello'));
    expect(data.symbol).toMatchObject({ name: 'greet', kind: 'method' });
    expect(data.source).toContain('greet(user: User): string');
    expect(data.source).not.toContain('export class');
  });
  test.each([
    ['export class Greeter', 'Greeter', 'class'],
    ['export interface Named', 'Named', 'interface'],
    ['export const label:', 'label', 'variable'],
    ['return value * 2', 'doubled', 'function']
  ])('finds the most specific symbol at %s', async (line, name, kind) => {
    expect(unwrap(await context('symbols.ts', line)).symbol).toMatchObject({ name, kind });
  });
  test('uses checker symbol identity and excludes shadowed local references', async () => {
    const data = unwrap(await context('symbols.ts', 'return left + right'));
    const positions = data.references.map((reference) => reference.range.start.line);
    expect(positions).toContain(await lineOf('symbols.ts', 'export const result = add'));
    expect(positions).toContain(await lineOf('symbols.ts', 'export const callback = { add }'));
    expect(positions).not.toContain(await lineOf('symbols.ts', 'return add(3)'));
    expect(positions).not.toContain(await lineOf('symbols.ts', 'export function add'));
  });
  test('finds an inner variable and bounds reference collection', async () => {
    const data = unwrap(await context('semantic-error.ts', 'const value:'));
    expect(data.symbol).toMatchObject({ name: 'value', kind: 'variable' });
    expect(data.references).toHaveLength(1);
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxReferences: 1 });
    const result = unwrap(await limited.tools.get_symbol_context({ path: 'symbols.ts', line: await lineOf('symbols.ts', 'return left + right') }));
    expect(result.references).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });
  test('returns relevant file imports, including type-only bindings', async () => {
    const data = unwrap(await context('symbols.ts', 'return left + right'));
    expect(data.imports).toEqual(expect.arrayContaining([
      { from: 'symbols.ts', specifier: './domain.js', resolvedPath: 'domain.ts', external: false, typeOnly: false },
      { from: 'symbols.ts', specifier: './domain.js', resolvedPath: 'domain.ts', external: false, typeOnly: true }
    ]));
  });
  test('bounds symbol source and reports truncation', async () => {
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxContextCharacters: 20 });
    const data = unwrap(await limited.tools.get_symbol_context({ path: 'symbols.ts', line: await lineOf('symbols.ts', 'return left + right') }));
    expect(data.source.length).toBeLessThanOrEqual(20);
    expect(data.signature.length).toBeLessThanOrEqual(20);
    expect(data.truncated).toBe(true);
  });
  test('rejects missing symbols and invalid line numbers', async () => {
    expect(await context('symbols.ts', 'import { increment }')).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    expect(await analyzer.tools.get_symbol_context({ path: 'symbols.ts', line: 1000 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
  test('supports TSX, JavaScript, constructors, accessors and type aliases', async () => {
    await writeFile(path.join(root, 'view.tsx'), 'export const View = () => <span>Hello</span>;\n');
    await writeFile(path.join(root, 'plain.js'), 'export function double(value) {\n return value * 2;\n}\n');
    await writeFile(path.join(root, 'extra.ts'), 'export type Name = string;\nexport class Box {\n constructor() {}\n get size(): number { return 1; }\n}\n');
    expect(unwrap(await analyzer.tools.get_symbol_context({ path: 'view.tsx', line: 1 })).symbol.kind).toBe('function');
    expect(unwrap(await analyzer.tools.get_symbol_context({ path: 'plain.js', line: 2 })).symbol.name).toBe('double');
    expect(unwrap(await analyzer.tools.get_symbol_context({ path: 'extra.ts', line: 1 })).symbol.kind).toBe('type');
    expect(unwrap(await analyzer.tools.get_symbol_context({ path: 'extra.ts', line: 3 })).symbol.name).toBe('constructor');
    expect(unwrap(await analyzer.tools.get_symbol_context({ path: 'extra.ts', line: 4 })).symbol.name).toBe('size');
  });
});

describe('syntax, semantics, lint and dependencies', () => {
  test('reports syntax diagnostics with normalized locations', async () => {
    const result = await analyze(['syntax-error.ts'], ['syntax']);
    expect(resultSchema(ToolSchemas.analyze_code.output).safeParse(result).success).toBe(true);
    const data = unwrap(result);
    expect(data.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'typescript', severity: 'error', code: expect.stringMatching(/^TS\d+$/),
        range: expect.objectContaining({ start: expect.objectContaining({ line: 2 }) }) })
    ]));
    expect(data.affectedSymbols.some((symbol) => symbol.name === 'broken')).toBe(true);
  });
  test('separates semantic errors from syntax checks', async () => {
    expect(unwrap(await analyze(['semantic-error.ts'], ['syntax'])).diagnostics).toEqual([]);
    const data = unwrap(await analyze(['semantic-error.ts'], ['semantic']));
    expect(data.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TS2322', path: 'semantic-error.ts', severity: 'error', source: 'typescript' })
    ]));
    expect(data.affectedSymbols.some((symbol) => symbol.name === 'value')).toBe(true);
  });
  test('normalizes ESLint error and warning severities and rule IDs', async () => {
    const data = unwrap(await analyze(['lint-error.ts'], ['lint']));
    expect(data.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'eslint', code: '@typescript-eslint/no-explicit-any', severity: 'error' }),
      expect.objectContaining({ source: 'eslint', code: '@typescript-eslint/no-unused-vars', severity: 'warning' }),
      expect.objectContaining({ source: 'eslint', code: 'eqeqeq', severity: 'error' })
    ]));
    expect(data.diagnostics.every((diagnostic) => diagnostic.range?.start.line > 0 && diagnostic.range.start.column > 0)).toBe(true);
    expect(data.diagnostics.some((diagnostic) => diagnostic.source === 'typescript')).toBe(false);
  });
  test('returns fatal ESLint parse errors as diagnostics', async () => {
    expect(unwrap(await analyze(['syntax-error.ts'], ['lint'])).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'parse-error', source: 'eslint', severity: 'error' })]));
  });
  test('combines checks and builds a deduplicated import graph', async () => {
    const data = unwrap(await analyze(['imports.ts', 'domain.ts'], ['syntax', 'semantic', 'lint']));
    expect(data.analyzedFiles).toEqual(['imports.ts', 'domain.ts']);
    expect(data.dependencies).toEqual(expect.arrayContaining([
      { from: 'imports.ts', specifier: './domain.js', resolvedPath: 'domain.ts', external: false, typeOnly: false },
      { from: 'imports.ts', specifier: './domain.js', resolvedPath: 'domain.ts', external: false, typeOnly: true }
    ]));
    expect(data.dependencies).toHaveLength(2);
  });
  test('resolves tsconfig aliases and inherits local compiler configuration', async () => {
    await writeFile(path.join(root, 'base.json'), JSON.stringify({ compilerOptions: { strict: true, paths: { '@domain': ['./domain.ts'] } } }));
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }));
    await writeFile(path.join(root, 'aliases.ts'), 'import { increment } from "@domain";\nexport const value = increment("wrong");\n');
    const data = unwrap(await analyze(['aliases.ts'], ['semantic']));
    expect(data.dependencies).toContainEqual({ from: 'aliases.ts', specifier: '@domain', resolvedPath: 'domain.ts', external: false, typeOnly: false });
    expect(data.diagnostics.some((diagnostic) => diagnostic.code === 'TS2345')).toBe(true);
  });
  test('classifies unresolved external packages without reading outside the workspace', async () => {
    await writeFile(path.join(root, 'external.ts'), 'import missing from "missing-package";\nexport const value = missing;\n');
    const data = unwrap(await analyze(['external.ts'], ['semantic']));
    expect(data.dependencies).toContainEqual({ from: 'external.ts', specifier: 'missing-package', resolvedPath: null, external: true, typeOnly: false });
    expect(data.diagnostics.some((diagnostic) => diagnostic.code === 'TS2307')).toBe(true);
  });
  test('resolves package exports using ESM and CommonJS import conditions', async () => {
    const dependency = path.join(root, 'node_modules', 'dual');
    await mkdir(dependency, { recursive: true });
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'dual', type: 'module',
      exports: { '.': { import: { types: './esm.d.mts' }, require: { types: './cjs.d.cts' } } } }));
    await writeFile(path.join(dependency, 'esm.d.mts'), 'export const value: "esm";\n');
    await writeFile(path.join(dependency, 'cjs.d.cts'), 'export const value: "cjs";\n');
    await writeFile(path.join(root, 'esm.mts'), 'import { value } from "dual";\nexport const result = value;\n');
    await writeFile(path.join(root, 'cjs.cts'), 'import { value } from "dual";\nexport const result = value;\n');
    const data = unwrap(await analyze(['esm.mts', 'cjs.cts'], ['semantic']));
    expect(data.dependencies).toEqual(expect.arrayContaining([
      { from: 'esm.mts', specifier: 'dual', resolvedPath: 'node_modules/dual/esm.d.mts', external: true, typeOnly: false },
      { from: 'cjs.cts', specifier: 'dual', resolvedPath: 'node_modules/dual/cjs.d.cts', external: true, typeOnly: false }
    ]));
    expect(data.diagnostics).toEqual([]);
  });
  test('reports global compiler errors instead of a false clean semantic result', async () => {
    const noLibrary = await CodeAnalyzer.create({ workspaceRoot: root, compilerOptions: { noLib: true, lib: [] } });
    const data = unwrap(await noLibrary.tools.analyze_code({ paths: ['domain.ts'], checks: ['semantic'] }));
    expect(data.diagnostics.some((diagnostic) => diagnostic.range === null && diagnostic.source === 'typescript')).toBe(true);
  });
  test('flags dependency text truncation and recognizes inline type-only exports', async () => {
    await writeFile(path.join(root, 'long-import.ts'), `import "${'x'.repeat(5000)}";\n`);
    const clipped = unwrap(await analyze(['long-import.ts'], ['syntax']));
    expect(clipped.dependencies[0].specifier.length).toBeLessThanOrEqual(4096);
    expect(clipped.truncated).toBe(true);
    await writeFile(path.join(root, 'inline.ts'), 'export { type User } from "./domain.js";\n');
    expect(unwrap(await analyze(['inline.ts'], ['syntax'])).dependencies[0].typeOnly).toBe(true);
  });
  test('does not execute a workspace ESLint JavaScript config by default', async () => {
    await writeFile(path.join(root, 'eslint.config.mjs'), 'throw new Error("Workspace config executed");\n');
    expect(unwrap(await analyze(['lint-error.ts'], ['lint'])).diagnostics.length).toBeGreaterThan(0);
  });
  test('accepts trusted Flat Config overrides and never applies fixes', async () => {
    const configured = await CodeAnalyzer.create({ workspaceRoot: root, eslintConfig: [{ rules: { eqeqeq: 'off' } }] });
    const before = await readFile(path.join(root, 'lint-error.ts'), 'utf8');
    const data = unwrap(await configured.tools.analyze_code({ paths: ['lint-error.ts'], checks: ['lint'] }));
    expect(data.diagnostics.some((diagnostic) => diagnostic.code === 'eqeqeq')).toBe(false);
    expect(await readFile(path.join(root, 'lint-error.ts'), 'utf8')).toBe(before);
  });
  test('bounds diagnostics and marks incomplete output', async () => {
    await writeFile(path.join(root, 'many.ts'), 'const a: number = "x";\nconst b: number = "x";\nconst c: number = "x";\n');
    const limited = await CodeAnalyzer.create({ workspaceRoot: root, maxDiagnostics: 2 });
    const data = unwrap(await limited.tools.analyze_code({ paths: ['many.ts'], checks: ['semantic'] }));
    expect(data.diagnostics).toHaveLength(2);
    expect(data.truncated).toBe(true);
  });
  test('invalidates analysis context naturally when imported source changes', async () => {
    await writeFile(path.join(root, 'consumer.ts'), 'import { increment } from "./domain.js";\nexport const value = increment(1);\n');
    expect(unwrap(await analyze(['consumer.ts'], ['semantic'])).diagnostics).toEqual([]);
    await writeFile(path.join(root, 'domain.ts'), 'export function increment(value: string): string { return value; }\n');
    expect(unwrap(await analyze(['consumer.ts'], ['semantic'])).diagnostics.some((diagnostic) => diagnostic.code === 'TS2345')).toBe(true);
  });
});

describe('memory resources and security boundaries', () => {
  test('stores analyses by UUID with independent result and metadata copies', async () => {
    const data = unwrap(await analyze(['semantic-error.ts']));
    const metadata = unwrap(analyzer.getAnalysisMetadata(data.analysisId));
    expect(metadata.fileHashes['semantic-error.ts']).toBe(sha(await readFile(path.join(root, 'semantic-error.ts'))));
    data.diagnostics.length = 0;
    const saved = unwrap(analyzer.getAnalysis(data.analysisId));
    expect(saved.diagnostics.length).toBeGreaterThan(0);
    saved.diagnostics.length = 0;
    expect(unwrap(analyzer.getAnalysis(data.analysisId)).diagnostics.length).toBeGreaterThan(0);
    metadata.fileHashes['semantic-error.ts'] = 'changed';
    expect(unwrap(analyzer.getAnalysisMetadata(data.analysisId)).fileHashes['semantic-error.ts']).not.toBe('changed');
  });
  test('evicts by capacity and expires by TTL without refreshing on reads', async () => {
    const small = await CodeAnalyzer.create({ workspaceRoot: root, maxStoredAnalyses: 1 });
    const first = unwrap(await small.tools.analyze_code({ paths: ['domain.ts'], checks: ['syntax'] }));
    const second = unwrap(await small.tools.analyze_code({ paths: ['domain.ts'], checks: ['syntax'] }));
    expect(small.getAnalysis(first.analysisId)).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    expect(small.getAnalysis(second.analysisId).ok).toBe(true);
    const expires = await CodeAnalyzer.create({ workspaceRoot: root, analysisTtlMs: 20 });
    const entry = unwrap(await expires.tools.analyze_code({ paths: ['domain.ts'], checks: ['syntax'] }));
    expect(expires.getAnalysis(entry.analysisId).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(expires.getAnalysis(entry.analysisId)).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
  });
  test('rejects invalid and unknown resource IDs and supports clearing', async () => {
    expect(analyzer.getAnalysis('invalid')).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(analyzer.getAnalysis(randomUUID())).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    const data = unwrap(await analyze(['domain.ts'], ['syntax']));
    analyzer.clearAnalyses();
    expect(analyzer.getAnalysis(data.analysisId).ok).toBe(false);
  });
  test('enforces storage and compiler budgets', async () => {
    const small = await CodeAnalyzer.create({ workspaceRoot: root, maxStoredBytes: 1 });
    expect(await small.tools.analyze_code({ paths: ['domain.ts'], checks: ['syntax'] }))
      .toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    for (const option of [{ maxProgramBytes: 10 }, { maxProgramFiles: 1 }, { maxAstNodes: 1 }]) {
      const limited = await CodeAnalyzer.create({ workspaceRoot: root, ...option });
      expect(await limited.tools.analyze_code({ paths: ['domain.ts'], checks: ['semantic'] }))
        .toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    }
    expect(await createCodeAnalyzer({ workspaceRoot: root, maxContextCharacters: 100001 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    const rootLimit = await CodeAnalyzer.create({ workspaceRoot: root, maxProgramFiles: 1,
      compilerOptions: { noLib: true } });
    expect(await rootLimit.tools.analyze_code({ paths: ['domain.ts', 'symbols.ts'], checks: ['syntax'] }))
      .toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
  });
  test.each(['../outside.ts', '.git/config', 'C:\\outside.ts', '/outside.ts'])('rejects unsafe tool paths %s', async (file) => {
    expect(await analyzer.tools.read_file_context({ path: file })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await analyze([file])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
  test('rejects missing files, directories, unsupported extensions and duplicate identities', async () => {
    expect(await analyzer.tools.read_file_context({ path: 'missing.ts' })).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
    await mkdir(path.join(root, 'directory'));
    expect(await analyzer.tools.read_file_context({ path: 'directory' })).toMatchObject({ ok: false, error: { code: 'FILE_TYPE_INVALID' } });
    await writeFile(path.join(root, 'file.py'), 'print(1)');
    expect(await analyze(['file.py'])).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    expect(await analyze(['domain.ts', 'domain.ts'])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
  test('permits internal directory links but blocks external links in targets and imports', async () => {
    const outside = await mkdtemp(path.join(process.cwd(), '.phase3-test-'));
    const junction = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      await writeFile(path.join(outside, 'secret.ts'), 'export const secret = "outside";\n');
      await mkdir(path.join(root, 'inside'));
      await writeFile(path.join(root, 'inside', 'safe.ts'), 'export const safe = 1;\n');
      await symlink(path.join(root, 'inside'), path.join(root, 'internal-link'), junction);
      await symlink(outside, path.join(root, 'external-link'), junction);
      expect(unwrap(await analyzer.tools.read_file_context({ path: 'internal-link/safe.ts' })).content).toContain('safe');
      expect(await analyzer.tools.read_file_context({ path: 'external-link/secret.ts' }))
        .toMatchObject({ ok: false, error: { code: 'PATH_OUTSIDE_WORKSPACE' } });
      await writeFile(path.join(root, 'escape.ts'), 'import { secret } from "./external-link/secret.js";\nexport const value = secret;\n');
      const result = unwrap(await analyze(['escape.ts'], ['semantic']));
      expect(result.dependencies[0].resolvedPath).toBeNull();
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'TS2307')).toBe(true);
    } finally {
      await rm(path.join(root, 'external-link'), { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
  test('rejects inaccessible tsconfig inheritance and recovers after failed requests', async () => {
    await writeFile(path.join(root, 'tsconfig.json'), '{"extends":"../../outside.json"}');
    expect(await analyze(['domain.ts'])).toMatchObject({ ok: false, error: { code: 'ANALYSIS_ERROR' } });
    await rm(path.join(root, 'tsconfig.json'));
    const results = await Promise.all([analyze(['missing.ts']), analyze(['domain.ts'], ['syntax'])]);
    expect(results[0].ok).toBe(false);
    expect(unwrap(results[1]).diagnostics).toEqual([]);
  });
});
