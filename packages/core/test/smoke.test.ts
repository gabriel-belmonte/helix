import { test } from "bun:test";
import assert from "node:assert/strict";

test("helix-core public API smoke test", () => {
  const api = require("../src/index.js");
  // Config
  assert.ok(typeof api.loadConfig === "function", "loadConfig");
  assert.ok(typeof api.saveConfig === "function", "saveConfig");
  assert.ok(typeof api.defaultConfig === "object", "defaultConfig");
  // Agent
  assert.ok(typeof api.buildAgent === "function", "buildAgent");
  assert.ok(typeof api.defaultSkillDirs === "function", "defaultSkillDirs");
  const dirs = api.defaultSkillDirs();
  assert.ok(Array.isArray(dirs), "defaultSkillDirs returns array");
  assert.ok(dirs.length > 0);
  // Provider
  assert.ok(typeof api.loadProvider === "function", "loadProvider");
  // Registry
  assert.ok(typeof api.resolveTools === "function", "resolveTools");
  assert.ok(typeof api.ToolRegistry === "function", "ToolRegistry");
  // Auth
  assert.ok(typeof api.resolveKey === "function", "resolveKey");
  assert.ok(typeof api.listCredentials === "function", "listCredentials");
  assert.ok(typeof api.setKey === "function", "setKey");
  assert.ok(typeof api.removeKey === "function", "removeKey");
  // Zen
  assert.ok(typeof api.fetchZenModels === "function", "fetchZenModels");
  assert.ok(typeof api.isFreeModel === "function", "isFreeModel");
  assert.ok(Array.isArray(api.ZEN_MODELS), "ZEN_MODELS");
  // Skills
  assert.ok(typeof api.discoverSkills === "function", "discoverSkills");
  assert.ok(typeof api.makeSkillTool === "function", "makeSkillTool");
  // Built-in tools
  assert.ok(Array.isArray(api.builtinTools), "builtinTools");
  // Plugins
  assert.ok(typeof api.ToolRegistry === "function", "ToolRegistry");
  assert.ok(typeof api.ensureWebInfra === "function", "ensureWebInfra");
});
