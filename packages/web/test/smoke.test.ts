import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-web public API smoke test", () => {
  const api = require("../server/index.ts");
  assert.ok(typeof api.app === "object", "Hono app");
  assert.ok(typeof api.startDashboard === "function", "startDashboard");
});
