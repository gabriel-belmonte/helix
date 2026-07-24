// Tool chaining: multiple tools executed in sequence within a single agent run.
// Demonstrates how the agent loop chains tool calls.
//
// Run: bun run examples/tool-chaining.ts

import { Agent, defineTool, scriptedLLM, TOOL_MARKER } from "../src/index.js";

// --- Tools that form a pipeline ---
const readFile = defineTool(
  "read_file",
  "Read a file's contents",
  async (input: { path: string }) => {
    const files: Record<string, string> = {
      "data.csv": "name,age\nAlice,30\nBob,25\nCharlie,35",
      "config.json": '{"theme":"dark","lang":"en"}',
    };
    return files[input.path] ?? `File not found: ${input.path}`;
  }
);

const parseCSV = defineTool(
  "parse_csv",
  "Parse CSV data into structured records",
  async (input: { data: string }) => {
    const lines = input.data.trim().split("\n");
    const headers = lines[0].split(",");
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });
    return { headers, rows, count: rows.length };
  }
);

const analyze = defineTool(
  "analyze",
  "Compute statistics on structured data",
  async (input: { data: any[] }) => {
    const ages = input.data.map((r: any) => parseInt(r.age)).filter(Boolean);
    const avg = ages.reduce((a: number, b: number) => a + b, 0) / ages.length;
    return {
      count: ages.length,
      avgAge: Math.round(avg * 10) / 10,
      minAge: Math.min(...ages),
      maxAge: Math.max(...ages),
    };
  }
);

// --- Agent that chains tools ---
// The scripted LLM simulates a model that:
// 1. Reads a file
// 2. Parses the CSV
// 3. Analyzes the data
// 4. Returns the final answer

let callCount = 0;
const chainLLM = scriptedLLM((turn, lastResult) => {
  callCount++;
  switch (turn) {
    case 0:
      // Step 1: Read the file
      return `${TOOL_MARKER} read_file {"path":"data.csv"}`;
    case 1:
      // Step 2: Parse the CSV (result from step 1 is in lastResult)
      return `${TOOL_MARKER} parse_csv {"data":"name,age\\nAlice,30\\nBob,25\\nCharlie,35"}`;
    case 2:
      // Step 3: Analyze the data
      return `${TOOL_MARKER} analyze {"data":[{"name":"Alice","age":"30"},{"name":"Bob","age":"25"},{"name":"Charlie","age":"35"}]}`;
    default:
      // Step 4: Final answer
      return "Analysis complete: 3 records, average age 30, range 25-35.";
  }
});

const agent = new Agent({
  name: "DataPipeline",
  system: "You are a data analyst. Use tools in sequence: read, parse, analyze.",
  llm: chainLLM,
  tools: [readFile, parseCSV, analyze],
  maxSteps: 5,
  onToolCall: (name, input) => {
    console.log(`  [step ${callCount}] ${name}(${JSON.stringify(input).slice(0, 80)}...)`);
  },
});

console.log("=== Tool Chaining Demo ===\n");
console.log("Pipeline: read_file → parse_csv → analyze\n");

const result = await agent.run("Analyze the data in data.csv");
console.log("\nFinal result:", result);
console.log(`Total LLM calls: ${callCount}`);
