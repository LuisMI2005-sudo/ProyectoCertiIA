# Code Analyzer

`createCodeAnalyzer(options)` returns `Result<CodeAnalyzer>`. The `tools` facade
implements `read_file_context`, `analyze_code` and `get_symbol_context` with the
exact shared input/output schemas and `Result<T>` envelopes. Domain methods
implement `CodeAnalyzer` from `shared/contracts.ts` and throw typed domain errors.
There are no emitted files, automatic fixes or source-code execution.

## Source and AST

Reads accept workspace-relative regular UTF-8 files, preserve BOM/newlines and
hash all original bytes with SHA-256. Requested line intervals are inclusive.
Ranges use one-based lines/columns and exclusive end positions; columns count
UTF-16 code units, following TypeScript. Text limits also count UTF-16 units and
never split a surrogate pair. A clipped last line is identified by `endLine` and
`truncated`. Oversized files and invalid encodings fail with a typed error.
Empty files report `content: ""`, `startLine: 1`, `endLine: 0`.

AST tools accept `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`.
Each request creates a fresh TypeScript Program; dependencies changing between
requests cannot leave a reused checker stale. The CompilerHost reads only
canonical paths inside the workspace and trusted bundled TypeScript standard
library declarations. External symlinks, Git metadata and paths outside the
workspace are unavailable to module/config resolution. Native Node APIs and
third-party modules are represented through declarations inside the workspace;
dependencies are never imported as executable JavaScript.

The analyzer loads root `tsconfig.json`, or an explicitly configured relative
`tsconfigPath`, including safe local inheritance. Trusted `compilerOptions` can
override compiler settings. Explicitly requested files are the program roots;
the analyzer forces `noEmit`, disables build metadata and sets `rootDir` to the
workspace. Semantic diagnostics include global/options errors with a null
range, attributed to the first requested path. File diagnostics are reported
for requested roots, not every transitive dependency or standard-library file.

The most specific symbol covering a requested line is selected. Its source is
an exact substring of the chosen AST node, excluding leading trivia. Signatures
use the checker or declaration headers. Variables, functions, methods, classes,
interfaces, type aliases and namespaces are supported. Local references use
checker identity, exclude declarations and distinguish shadowed names. Anonymous
functions have a stable source-location label. A line-only request cannot
disambiguate two declarations sharing the same line; the smallest span wins.

Dependency edges describe direct imports/exports for requested files, including
type imports, dynamic imports and literal CommonJS require calls. NodeNext
resolution distinguishes ESM and CommonJS export conditions. Aliases resolved
to workspace source are local; package imports into `node_modules` are external.
Unresolved imports have `resolvedPath: null`. The symbol context returns the
file's dependency edges and references within that file.

## ESLint

ESLint uses `lintText` against the same captured source as the AST checker.
Default Flat Config uses the installed TypeScript parser/plugin, checks explicit
`any`, unused variables and loose equality, and disables inline configuration.
`fix` and the ESLint disk cache are disabled. Fatal parser errors become ordinary
normalized diagnostics. No workspace JavaScript configuration is loaded by
default. `eslintConfig` is a trusted startup override; enabling
`useWorkspaceEslintConfig` explicitly authorizes loading the workspace's ESLint
configuration and plugins. Neither option is an MCP tool parameter.

## Analysis resources

`getAnalysis(analysisId)` and `getAnalysisMetadata(analysisId)` return `Result<T>`
and defensive copies for a future `devguardian://analysis/{analysisId}` resource.
Metadata records creation/expiration time and root-file hashes. Results describe
the captured version of each file; they are not automatically updated after an
edit. Storage is in memory, bounded by entries and serialized bytes, with LRU
eviction and a fixed TTL. Reads do not extend expiration. `clearAnalyses()` clears
stored results, and a restart invalidates old resource IDs.

All facade requests are serialized per analyzer instance. File, program, AST,
output, diagnostic, reference and storage limits are configurable and bounded.
Truncated lists/text set `truncated`; incomplete reads/budget overruns fail
instead of returning a clean partial analysis. TypeScript and ESLint execute
in-process: these resource limits are not a hard CPU timeout or OS sandbox.
Concurrent external writers can still change dependencies between separate
reads; an isolated repair checkout and later Git/Test Runner verification remain
necessary for the autonomous workflow.

Implementation follows the official [TypeScript Compiler API documentation](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
and [ESLint Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api).
