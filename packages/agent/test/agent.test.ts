import { test } from "node:test";
import assert from "node:assert/strict";
import { Agent, defineTool, TOOL_MARKER } from "../src/index.js";
import { scriptedLLM } from "../src/providers.js";

test("agent executes a tool and continues the loop", async () => {
  const llm = scriptedLLM((t) => {
    if (t === 0) return `${TOOL_MARKER} add {"a":2,"b":3}`;
    return "The sum is 5.";
  });

  const add = defineTool("add", "Adds two numbers", async (i: { a: number; b: number }) => i.a + i.b);

  const agent = new Agent({ name: "Calc", system: "calc", llm, tools: [add] });
  const out = await agent.run("add 2 and 3");

  assert.equal(out, "The sum is 5.");
});

test("unknown tool returns an error result, no crash", async () => {
  const llm = scriptedLLM(() => `${TOOL_MARKER} nope {}`);
  const agent = new Agent({ name: "X", system: "x", llm, tools: [] });
  const out = await agent.run("hi");
  assert.match(out, /unknown tool/);
});

test("maxSteps prevents infinite tool loops", async () => {
  const llm = scriptedLLM(() => `${TOOL_MARKER} ping {}`);
  const ping = defineTool("ping", "ping", async () => "pong");
  const agent = new Agent({ name: "P", system: "p", llm, tools: [ping], maxSteps: 3 });
  const out = await agent.run("go");
  assert.ok(out.includes("pong"));
});

test("multi-tool-call: two tools in one turn", async () => {
  // LLM emits two tool calls in a single reply
  const llm = scriptedLLM((t) => {
    if (t === 0) {
      return `${TOOL_MARKER} add {"a":1,"b":2}\n${TOOL_MARKER} add {"a":3,"b":4}`;
    }
    return "Results: 3 and 7.";
  });

  const add = defineTool("add", "Adds two numbers", async (i: { a: number; b: number }) => i.a + i.b);
  const agent = new Agent({ name: "Calc", system: "calc", llm, tools: [add] });
  const out = await agent.run("add pairs");

  assert.ok(out.includes("3"));
  assert.ok(out.includes("7"));
});

test("onToolCall callback is invoked", async () => {
  const calls: string[] = [];
  const llm = scriptedLLM((t) => {
    if (t === 0) return `${TOOL_MARKER} ping {}`;
    return "done";
  });
  const ping = defineTool("ping", "ping", async () => "pong");
  const agent = new Agent({
    name: "P",
    system: "p",
    llm,
    tools: [ping],
    onToolCall: (name) => calls.push(name),
  });
  await agent.run("go");
  assert.deepEqual(calls, ["ping"]);
});

test("streaming: onChunk receives text chunks", async () => {
  const chunks: string[] = [];
  const llm = scriptedLLM(() => "Hello world");
  // Add stream method to the scripted provider
  (llm as any).stream = async (_msgs: any, onChunk: (t: string) => void) => {
    onChunk("Hello ");
    onChunk("world");
    return "Hello world";
  };

  const agent = new Agent({ name: "S", system: "s", llm });
  const reply = await agent.run("hi", (chunk) => chunks.push(chunk));

  assert.equal(reply, "Hello world");
  assert.deepEqual(chunks, ["Hello ", "world"]);
});

test("streaming: falls back to complete() when no onChunk", async () => {
  const llm = scriptedLLM(() => "Hello world");
  (llm as any).stream = async (_msgs: any, onChunk: (t: string) => void) => {
    onChunk("Hello ");
    onChunk("world");
    return "Hello world";
  };

  const agent = new Agent({ name: "S", system: "s", llm });
  const reply = await agent.run("hi"); // no onChunk

  assert.equal(reply, "Hello world");
});
