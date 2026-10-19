import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const prefix = "--outputFile=";
const outputFile = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const mode = process.env.FAKE_MODE ?? "pass";
const cwd = process.cwd();

if (mode === "crash") {
  process.stderr.write("fake-jest crashed before reporting\n");
  process.exit(2);
}
if (mode === "timeout") {
  setTimeout(() => {}, 60_000);
} else {
  const testFile = path.join(cwd, "tests", "sample.test.mjs");
  const statusFor = (title) => {
    if (mode === "mixed") return title === "adds numbers" ? "pending" : "todo";
    if (mode === "fail" && title === "adds numbers") return "failed";
    if (mode === "execerror") return "failed";
    return "passed";
  };
  const titles = mode === "subset" ? ["keeps existing behavior"] : ["adds numbers", "keeps existing behavior"];
  const assertionResults = mode === "execerror" ? [] : titles.map((title) => {
    const status = statusFor(title);
    return {
      title, fullName: title, status,
      failureMessages: status === "failed" ? ["Expected sum to be 3"] : [],
      duration: 1
    };
  });
  const report = {
    numTotalTests: assertionResults.length,
    numPassedTests: assertionResults.filter((test) => test.status === "passed").length,
    numFailedTests: assertionResults.filter((test) => test.status === "failed").length,
    success: !assertionResults.some((test) => test.status === "failed"),
    testResults: [{
      name: testFile, status: mode === "execerror" ? "failed" : "passed",
      message: "", assertionResults
    }]
  };
  if (mode === "execerror") report.testExecError = { message: "Cannot find module" };
  if (mode === "verbose") process.stdout.write("log ".repeat(40_000));
  if (mode !== "noreport" && outputFile) {
    mkdirSync(path.dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, JSON.stringify(report));
  }
  process.stdout.write("fake jest finished\n");
  process.exit(mode === "fail" || mode === "execerror" ? 1 : 0);
}
