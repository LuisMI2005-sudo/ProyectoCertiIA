import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const prefix = "--json-report-file=";
const reportFile = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const mode = process.env.FAKE_MODE ?? "pass";

if (mode === "crash") {
  process.stderr.write("fake-pytest crashed before reporting\n");
  process.exit(3);
}
if (mode === "timeout") {
  setTimeout(() => {}, 60_000);
} else {
  const outcomeFor = (nodeId) => {
    if (mode === "mixed") return nodeId.endsWith("test_adds") ? "skipped" : "xfailed";
    if (mode === "fail" && nodeId.endsWith("test_adds")) return "failed";
    if (mode === "execerror") return "error";
    return "passed";
  };
  const nodeIds = ["tests/test_sample.py::test_adds", "tests/test_sample.py::test_existing"];
  const tests = nodeIds.map((nodeId) => {
    const outcome = outcomeFor(nodeId);
    return {
      nodeid: nodeId, outcome,
      setup: { duration: 0.001 },
      call: outcome === "failed" || outcome === "error"
        ? { duration: 0.002, longrepr: "AssertionError: Expected sum to be 3", crash: { message: "broken" } }
        : { duration: 0.002 },
      teardown: { duration: 0.001 }
    };
  });
  const report = {
    summary: { passed: tests.filter((t) => t.outcome === "passed").length, failed: tests.filter((t) => t.outcome === "failed").length },
    collectors: mode === "collecterror" ? [{ nodeid: "", result: "error" }] : [],
    tests
  };
  if (mode !== "noreport" && reportFile) {
    mkdirSync(path.dirname(reportFile), { recursive: true });
    writeFileSync(reportFile, JSON.stringify(report));
  }
  process.stdout.write("fake pytest finished\n");
  process.exit(mode === "fail" || mode === "execerror" ? 1 : 0);
}
