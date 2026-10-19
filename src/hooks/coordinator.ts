import type { CodeAnalyzer, TestRunner, AnalyzeCodeInput, RunTestsInput, AnalyzeCodeOutput, RunTestsOutput } from "../shared/contracts.js";
import { captureResult } from "../shared/errors.js";
import type { Result } from "../shared/errors.js";
import type { HookPayload } from "./types.js";
import type { HookManager } from "./registry.js";

/** Backend entry point; dependencies are trusted services, never callbacks supplied by API clients. */
export class HookExecutionCoordinator {
  public constructor(private readonly hooks: HookManager) {}
  public analyze(analyzer: CodeAnalyzer, input: AnalyzeCodeInput): Promise<Result<AnalyzeCodeOutput>> {
    return captureResult(async () => {
      await this.hooks.assertAllowed("pre:analyze", { files: input.paths });
      return analyzer.analyzeCode(input);
    });
  }
  public runTests(runner: TestRunner, input: RunTestsInput): Promise<Result<RunTestsOutput>> {
    return captureResult(async () => {
      await this.hooks.assertAllowed("pre:run_tests", { files: input.targets ?? [] });
      const result = await runner.runTests(input);
      await this.hooks.notify("post:test_run", { workspaceStateHash: result.workspaceStateHash, timestamp: result.finishedAt });
      return result;
    });
  }
  public saveRun<T extends HookPayload>(entity: T, save: (entity: T) => Promise<void>): Promise<Result<T>> {
    const snapshot = structuredClone(entity);
    return captureResult(async () => {
      await this.hooks.assertAllowed("db:before_save_run", snapshot);
      await save(structuredClone(snapshot));
      await this.hooks.notify("db:after_save_run", snapshot);
      return snapshot;
    });
  }
}
