import { test } from "node:test";
import assert from "node:assert";
import { resolveTools, defaultConfig } from "../src/index.js";

test("web tool is excluded by default", async () => {
  const tools = await resolveTools(defaultConfig);
  const names = tools.map((t) => t.name);
  assert.ok(!names.includes("web"), "web should not be present when disabled");
  assert.ok(names.includes("read_file"));
  assert.ok(names.includes("run_bash"));
});

test("web tool is included when config.web === true", async () => {
  const tools = await resolveTools({ ...defaultConfig, web: true });
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("web"), "web should be present when enabled");
});

test("plugins can register additional tools", async () => {
  const plugin = {
    name: "extra",
    register: (ctx: any) => {
      ctx.registry.register({
        name: "ping",
        description: "returns pong",
        run: async () => ({ pong: true }),
      });
    },
  };
  const tools = await resolveTools(defaultConfig, [plugin]);
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("ping"), "plugin tool should be registered");
});
