import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-mcp public API smoke test", () => {
  const api = require("../src/index.js");
  assert.ok(typeof api.makeMcpPlugin === "function", "makeMcpPlugin");
});
