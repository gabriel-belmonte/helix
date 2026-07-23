import { test } from "node:test";
import * as assert from "node:assert";
import { runEval, compareEval, makeLlmJudge } from "../src/index.js";

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

test("compareEval picks the higher-quality agent as winner", async () => {
  const cases = [
    { id: "a", input: "Say hi", expected: "hi" },
    { id: "b", input: "Say bye", expected: "bye" },
  ];
  // Agent A echoes the expected word (matches both); Agent B never does.
  const agentA = async (input: string) => (input.includes("hi") ? "hi" : "bye");
  const report = await compareEval(
    cases,
    agentA,
    async () => "nope",
  );
  assert.equal(report.reportA.passed, 2);
  assert.equal(report.reportB.passed, 0);
  assert.equal(report.winner, "A");
  assert.ok(report.delta.deltaScore < 0); // B - A < 0
  assert.equal(report.perCase.length, 2);
});

test("compareEval reports cost and latency deltas", async () => {
  const cases = [{ id: "x", input: "ping", costPer1kPrompt: 0.01, costPer1kCompletion: 0.02 }];
  const report = await compareEval(
    cases,
    async () => {
      await new Promise((r) => setTimeout(r, 20));
      return "slow";
    },
    async () => {
      await new Promise((r) => setTimeout(r, 2));
      return "fast";
    },
  );
  assert.ok(report.delta.deltaLatency < 0, "B should be faster than A");
  assert.ok(report.delta.costA > 0);
});

test("makeLlmJudge parses a 0..1 score from the judge reply", async () => {
  // Fake judge that echoes a score format.
  const judge = async (prompt: string): Promise<string> => {
    if (prompt.includes("hi")) return "0.9";
    return "0.3";
  };
  const scorer = makeLlmJudge(judge);
  const high = await scorer({ input: "hi", output: "hi there" });
  const low = await scorer({ input: "bye", output: "wrong" });
  assert.ok(Math.abs(high - 0.9) < 0.001);
  assert.ok(Math.abs(low - 0.3) < 0.001);
});
