// Multi-agent workflow: a researcher gathers information, then a summarizer
// produces a final report. Both use scripted LLMs for reproducibility.
//
// Run: bun run examples/multi-agent.ts

import { Agent, defineTool, scriptedLLM, TOOL_MARKER } from "../src/index.js";

// --- Agent 1: Researcher ---
// Simulates a researcher that searches for information.
const researchTool = defineTool(
  "web_search",
  "Search the web for information",
  async (input: { query: string }) => {
    // Simulated search results
    const results: Record<string, string[]> = {
      "typescript 5.8": [
        "TypeScript 5.8 introduces isolated declarations",
        "New satisfies operator improvements",
        "Performance optimizations for large codebases",
      ],
      default: ["General information found", "Relevant data collected"],
    };
    return results[input.query] ?? results.default;
  }
);

const researcher = new Agent({
  name: "Researcher",
  system: "You are a research assistant. Use web_search to find information, then summarize your findings.",
  llm: scriptedLLM((turn) => {
    if (turn === 0) return `${TOOL_MARKER} web_search {"query":"typescript 5.8"}`;
    return "TypeScript 5.8 features: isolated declarations, satisfies improvements, and performance optimizations.";
  }),
  tools: [researchTool],
});

// --- Agent 2: Summarizer ---
const summarizer = new Agent({
  name: "Summarizer",
  system: "You are a technical writer. Condense research into a clear summary.",
  llm: scriptedLLM(() => {
    return "TypeScript 5.8 brings three key improvements: isolated declarations for faster builds, enhanced satisfies operator, and significant performance gains for large projects.";
  }),
});

// --- Workflow ---
async function runWorkflow(topic: string) {
  console.log(`Researching: ${topic}\n`);

  // Step 1: Research
  const findings = await researcher.run(`Research: ${topic}`);
  console.log("Research findings:", findings, "\n");

  // Step 2: Summarize
  const summary = await summarizer.run(`Summarize this research:\n${findings}`);
  console.log("Final summary:", summary);
}

await runWorkflow("TypeScript 5.8");
