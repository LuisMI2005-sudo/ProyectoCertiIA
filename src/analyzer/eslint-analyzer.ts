import { ESLint } from "eslint";
import * as parser from "@typescript-eslint/parser";
import plugin from "@typescript-eslint/eslint-plugin";
import type { Diagnostic } from "../shared/contracts.js";
import { AnalysisError, DevGuardianError } from "../shared/errors.js";
import { boundedText } from "./ast-analyzer.js";
import type { AnalyzerLimits, AnalyzerOptions, SourceSnapshot } from "./types.js";

export class EslintAnalyzer {
  private readonly eslint: ESLint;

  public constructor(options: AnalyzerOptions, private readonly limits: AnalyzerLimits) {
    // ESLint 10 widened its rule-context generics; the plugin's declarations
    // still expose the legacy context. Adapt only this verified API boundary.
    const rules = plugin.rules as unknown as NonNullable<ESLint.Plugin["rules"]>;
    this.eslint = new ESLint({
      cwd: options.workspaceRoot,
      overrideConfigFile: options.useWorkspaceEslintConfig === true ? null : true,
      ignore: false,
      allowInlineConfig: false,
      fix: false,
      cache: false,
      overrideConfig: [{
        files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
        languageOptions: { parser, ecmaVersion: "latest", sourceType: "module",
          parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@typescript-eslint": { rules } },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
          eqeqeq: "error"
        }
      }, ...(options.eslintConfig ?? [])]
    });
  }

  public async analyze(files: readonly SourceSnapshot[]): Promise<{ diagnostics: Diagnostic[]; truncated: boolean }> {
    const diagnostics: Diagnostic[] = [];
    let truncated = false;
    try {
      for (const file of files) {
        const results = await this.eslint.lintText(file.text, { filePath: file.absolutePath, warnIgnored: false });
        for (const result of results) {
          for (const message of result.messages) {
            if (diagnostics.length >= this.limits.maxDiagnostics) { truncated = true; break; }
            const start = message.line && message.column ? { line: message.line, column: message.column } : null;
            const finish = start ? { line: message.endLine ?? start.line, column: message.endColumn ?? start.column } : null;
            const validFinish = start && finish && (finish.line > start.line ||
              (finish.line === start.line && finish.column >= start.column)) ? finish : start;
            const code = message.ruleId ?? (message.fatal ? "parse-error" : "eslint");
            truncated ||= code.length > 256 || message.message.length > this.limits.maxContextCharacters;
            diagnostics.push({ path: file.path, source: "eslint", code: boundedText(code, 256),
              severity: message.severity === 2 ? "error" : message.severity === 1 ? "warning" : "info",
              message: boundedText(message.message, this.limits.maxContextCharacters),
              range: start && validFinish ? { start, end: validFinish } : null });
          }
        }
      }
      return { diagnostics, truncated };
    } catch (error: unknown) {
      if (error instanceof DevGuardianError) throw error;
      throw new AnalysisError("ESLint analysis failed.", { cause: error });
    }
  }
}
