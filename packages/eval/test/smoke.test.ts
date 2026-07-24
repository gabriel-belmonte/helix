import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-agent-eval public API smoke test", () => {
  const api = require("../src/index.js");
  assert.ok(typeof api.runEval === "function", "runEval");
  assert.ok(typeof api.compareEval === "function", "compareEval");
  assert.ok(typeof api.makeLlmJudge === "function", "makeLlmJudge");
});
