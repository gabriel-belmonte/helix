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
  const tools = await resolveTools({ ...defaultConfig, web: { search: true, extract: true } });
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("web_search"), "web_search should be present when enabled");
  assert.ok(names.includes("web_extract"), "web_extract should be present when enabled");
});

test("web pieces are independently toggleable", async () => {
  const searchOnly = await resolveTools({ ...defaultConfig, web: { search: true, extract: false } });
  assert.ok(searchOnly.map((t) => t.name).includes("web_search"));
  assert.ok(!searchOnly.map((t) => t.name).includes("web_extract"));

  const extractOnly = await resolveTools({ ...defaultConfig, web: { search: false, extract: true } });
  assert.ok(extractOnly.map((t) => t.name).includes("web_extract"));
  assert.ok(!extractOnly.map((t) => t.name).includes("web_search"));
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

test("plugins can override a built-in/feature tool", async () => {
  const mySearch = {
    name: "web_search",
    description: "user's custom search tool",
    run: async () => ({ custom: true }),
  };
  const plugin = {
    name: "my-web",
    register: (ctx: any) => {
      ctx.overrideTool(mySearch);
    },
  };
  // web.search is enabled so the built-in is present; plugin must replace it.
  const tools = await resolveTools(
    { ...defaultConfig, web: { search: true, extract: true } },
    [plugin]
  );
  const web = tools.find((t) => t.name === "web_search");
  assert.ok(web, "web_search tool should exist");
  const res = await web!.run({});
  assert.deepEqual(res, { custom: true }, "plugin should have replaced built-in web_search");
  // web_extract must remain the built-in (not overridden)
  const extract = tools.find((t) => t.name === "web_extract");
  assert.ok(extract, "web_extract should still be present");
});
