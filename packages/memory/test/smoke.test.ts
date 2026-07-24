import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-memory public API smoke test", () => {
  const api = require("../src/index.js");
  assert.ok(typeof api.JsonlMemoryStore === "function", "JsonlMemoryStore");
  assert.ok(typeof api.makeMemoryTools === "function", "makeMemoryTools");
  assert.ok(typeof api.readSoul === "function", "readSoul");
  const store = new api.JsonlMemoryStore();
  assert.ok(typeof store.remember === "function", "store.remember");
  assert.ok(typeof store.recall === "function", "store.recall");
  assert.ok(typeof store.reflect === "function", "store.reflect");
  assert.ok(typeof store.list === "function", "store.list");
});
