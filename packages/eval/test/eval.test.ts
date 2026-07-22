import { test } from "node:test";
import * as assert from "node:assert";
import { runEval } from "../src/index.js";

test("runEval scores a passing batch case", async () => {
  const report = await runEval(
    [{ id: "greeting", input: "Say hello", expected: "hello" }],
    async () => "hello",
  );
  assert.equal(report.totalCases, 1);
  assert.equal(report.passed, 1);
  assert.ok(report.avgScore >= 0.5);
});

test("runEval measures cost and latency", async () => {
  const report = await runEval(
    [
      {
        id: "c1",
        input: "go",
        costPer1kPrompt: 0.01,
        costPer1kCompletion: 0.03,
      },
    ],
    async () => {
      await new Promise((r) => setTimeout(r, 5));
      return "done";
    },
  );
  assert.ok(report.avgLatencyMs >= 5);
  assert.ok(report.totalCostUsd >= 0);
});
