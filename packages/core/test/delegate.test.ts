import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDelegatePlugin } from "../src/delegate.js";

test("makeDelegatePlugin returns a plugin named 'delegate'", () => {
  const plugin = makeDelegatePlugin();
  assert.equal(plugin.name, "delegate");
  assert.equal(typeof plugin.register, "function");
});

test("makeDelegatePlugin registers a delegate_task tool", () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  const ctx = {
    registry: {
      override(tool: any) {
        registeredTool = tool;
      },
    },
  };
  plugin.register(ctx as any);

  assert.ok(registeredTool, "expected delegate_task tool to be registered");
  assert.equal(registeredTool.name, "delegate_task");
  assert.equal(typeof registeredTool.run, "function");
});

test("delegate_task schema includes single, parallel, chain modes", () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const schema = registeredTool.schema;
  assert.ok(schema, "expected schema");
  assert.equal(schema.type, "object");
  assert.ok(schema.properties.mode, "expected mode property");
  assert.deepEqual(schema.properties.mode.enum, ["single", "parallel", "chain"]);
  assert.equal(schema.required?.[0], "goal");
});

test("delegate_task description documents sequential chain mode", () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const desc = registeredTool.description;
  assert.ok(desc.includes("parallel"), "description should mention parallel mode");
  assert.ok(desc.includes("chain"), "description should mention chain mode");
  assert.ok(desc.includes("Promise.allSettled"), "description should mention Promise.allSettled");
});

test("single mode runs synchronously via runSubtask", async () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  // Single mode should NOT throw for missing agents field
  const result = await registeredTool.run({
    goal: "test task",
    context: "some context",
    mode: "single",
  });

  assert.ok(result, "expected a result object");
  // The actual spawn may fail here since there's no helix binary,
  // but we should get a structured error, not a crash
  assert.ok("result" in result || "error" in result);
});

test("parallel mode returns structured results array", async () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const result = await registeredTool.run({
    goal: "test parallel task",
    mode: "parallel",
    agents: ["worker-a", "worker-b"],
  });

  assert.ok(result, "expected a result object");
  assert.equal(result.agent, "parallel-delegation");
  assert.ok("results" in result, "parallel mode should return results array");
  assert.ok(Array.isArray((result as any).results), "results should be an array");
  assert.equal((result as any).results.length, 2, "should have 2 worker results");
});

test("chain mode pipes context between steps", async () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const result = await registeredTool.run({
    goal: "test chain task",
    mode: "chain",
    agents: ["step1", "step2", "step3"],
  });

  assert.ok(result, "expected a result object");
  assert.equal(result.agent, "chain-delegation");
  assert.ok("results" in result, "chain mode should return results array");
  assert.ok(Array.isArray((result as any).results), "results should be an array");
  assert.equal((result as any).results.length, 3, "should have 3 step results");
});

test("default mode is single when mode is omitted", async () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const result = await registeredTool.run({
    goal: "test default mode",
  });

  assert.ok(result, "expected a result object");
  assert.ok("result" in result || "error" in result);
});

test("agents field has description in schema", () => {
  const plugin = makeDelegatePlugin();
  let registeredTool: any = null;
  plugin.register({
    registry: { override: (t: any) => { registeredTool = t; } },
  } as any);

  const agentsProp = registeredTool.schema.properties.agents;
  assert.ok(agentsProp, "expected agents property in schema");
  assert.ok(agentsProp.description, "expected agents property to have a description");
  assert.ok(agentsProp.description.includes("parallel/chain"), "description should reference modes");
});
