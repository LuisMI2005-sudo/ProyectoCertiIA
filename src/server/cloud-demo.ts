import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { simpleGit } from "simple-git";
import { WorkspacePathGuard } from "../shared/path-security.js";

const require = createRequire(import.meta.url);
/** Creates only new, server-owned repositories; never resets or deletes an existing checkout. */
export async function createCloudDemo(workspaceRoot: string) {
  const parent = await WorkspacePathGuard.create(workspaceRoot);
  const folder = await parent.resolve(".devguardian-demo", { operation: "write", kind: "directory", mustExist: false });
  if (!folder.exists) await mkdir(folder.absolutePath);
  await parent.resolve(".devguardian-demo", { operation: "write", kind: "directory" });
  const repositoryPath = await mkdtemp(`${folder.absolutePath}/session-`);
  const guard = await WorkspacePathGuard.create(repositoryPath);
  for (const name of ["src", "tests"]) {
    const directory = await guard.resolve(name, { operation: "write", kind: "directory", mustExist: false });
    await mkdir(directory.absolutePath);
  }
  const before = (await readFile(new URL("../../fixtures/cloud-demo/src/target-bug.ts", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const after = "export const add = (a: number, b: number): number => a + b;\n";
  const tests = (await readFile(new URL("../../fixtures/cloud-demo/tests/target-bug.test.cjs", import.meta.url), "utf8"))
    .replace("require('typescript')", `require(${JSON.stringify(require.resolve("typescript"))})`);
  const files: Readonly<Record<string, string>> = {
    "src/target-bug.ts": before, "tests/target-bug.test.cjs": tests,
    "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["src/**/*.ts"] }),
    "package.json": JSON.stringify({ name: "devguardian-cloud-demo", private: true, jest: {
      testEnvironment: "node", testMatch: ["**/target-bug.test.cjs"], transform: {}, cache: false
    } })
  };
  for (const [name, content] of Object.entries(files)) {
    const target = await guard.resolve(name, { operation: "write", mustExist: false });
    await writeFile(target.absolutePath, content, { encoding: "utf8", flag: "wx" });
  }
  const git = simpleGit({ baseDir: guard.root, timeout: { block: 15000 },
    // Both settings are server constants: empty template and a non-existent hook directory.
    unsafe: { allowUnsafeHooksPath: true, allowUnsafeTemplateDir: true },
    config: ["core.hooksPath=.disabled-hooks", "commit.gpgsign=false", "core.autocrlf=false"] });
  await git.raw(["init", "--template=", "-b", "Dev"]);
  await git.addConfig("user.name", "DevGuardian Demo", false, "local");
  await git.addConfig("user.email", "demo@devguardian.local", false, "local");
  await git.addConfig("commit.gpgsign", "false", false, "local");
  await git.addConfig("core.autocrlf", "false", false, "local");
  await git.addConfig("core.hooksPath", ".disabled-hooks", false, "local");
  await git.add("."); await git.commit("demo: baseline controlado con fallo real");
  return { repoPath: guard.root, repair: {
    path: "src/target-bug.ts", slug: `cloud-demo-${randomUUID()}`, message: "fix: corregir suma verificada en demo aislada",
    runner: "jest" as const, targets: ["tests/target-bug.test.cjs"],
    expectedFileHashes: { "src/target-bug.ts": createHash("sha256").update(before).digest("hex") },
    unifiedDiff: `diff --git a/src/target-bug.ts b/src/target-bug.ts\n--- a/src/target-bug.ts\n+++ b/src/target-bug.ts\n@@ -1 +1 @@\n-${before}+${after}`
  } };
}
