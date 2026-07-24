import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-agent public API smoke test", () => {
  const api = require("../src/index.js");
  assert.ok(typeof api.Agent === "function", "Agent class");
  assert.ok(typeof api.defineTool === "function", "defineTool");
  assert.ok(typeof api.scriptedLLM === "function", "scriptedLLM");
  assert.ok(typeof api.openAIProvider === "function", "openAIProvider");
  assert.ok(typeof api.TOOL_MARKER === "string", "TOOL_MARKER");
  assert.ok(api.TOOL_MARKER.length > 0);
});
