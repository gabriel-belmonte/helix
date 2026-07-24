// Error handling patterns: graceful degradation, retries, and error recovery.
//
// Run: bun run examples/error-handling.ts

import { Agent, defineTool, scriptedLLM, TOOL_MARKER } from "../src/index.js";

// --- 1. Tool that can fail ---
const unreliableTool = defineTool(
  "fetch_data",
  "Fetches data from an external API (may fail)",
  async (input: { url: string }) => {
    // Simulate intermittent failures
    if (Math.random() < 0.5) {
      throw new Error("Network timeout: service unavailable");
    }
    return { status: 200, data: "Success!" };
  }
);

// --- 2. Tool that always fails (for demo) ---
const failingTool = defineTool(
  "always_fail",
  "This tool always fails",
  async () => { throw new Error("Intentional failure"); }
);

// --- 3. Safe agent wrapper with error boundaries ---
async function safeRun(
  agent: Agent,
  message: string
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  try {
    const reply = await agent.run(message);
    return { ok: true, reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Agent error: ${msg}`);
    return { ok: false, error: msg };
  }
}

// --- 4. Provider with timeout ---
function withTimeout(provider: { complete: Function }, ms: number) {
  return {
    async complete(...args: any[]) {
      return Promise.race([
        provider.complete(...args),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms)
        ),
      ]);
    },
  };
}

// --- Demo 1: Agent handles tool failure gracefully ---
console.log("=== Demo 1: Tool Failure Recovery ===\n");

const errorAgent = new Agent({
  name: "ErrorDemo",
  system: "When a tool fails, explain what went wrong.",
  llm: scriptedLLM((turn, lastResult) => {
    if (turn === 0) return `${TOOL_MARKER} always_fail {}`;
    return `Tool result was: ${lastResult}. The operation failed.`;
  }),
  tools: [failingTool],
});

const result1 = await safeRun(errorAgent, "Try the tool");
console.log("Result:", result1, "\n");

// --- Demo 2: Agent with unreliable network tool ---
console.log("=== Demo 2: Unreliable Tool ===\n");

const networkAgent = new Agent({
  name: "NetworkDemo",
  system: "Fetch data and report success or failure.",
  llm: scriptedLLM((turn, lastResult) => {
    if (turn === 0) return `${TOOL_MARKER} fetch_data {"url":"https://api.example.com"}`;
    if (lastResult?.includes("Error:")) {
      return `The fetch failed: ${lastResult}. This is a transient error.`;
    }
    return `Data received: ${lastResult}`;
  }),
  tools: [unreliableTool],
  onToolCall: (name, input) => {
    console.log(`  [tool] ${name}(${JSON.stringify(input)})`);
  },
});

for (let i = 0; i < 3; i++) {
  const result = await safeRun(networkAgent, "Fetch data");
  console.log(`Attempt ${i + 1}:`, result.ok ? "OK" : `Failed: ${result.error}`);
  networkAgent.reset();
}

// --- Demo 3: LLM timeout ---
console.log("\n=== Demo 3: LLM Timeout ===\n");

const slowProvider = {
  async complete() {
    await new Promise((r) => setTimeout(r, 5000)); // 5 second delay
    return "Slow response";
  },
};

const timedProvider = withTimeout(slowProvider, 100); // 100ms timeout

const timeoutAgent = new Agent({
  name: "TimeoutDemo",
  system: "You are helpful.",
  llm: timedProvider as any,
});

const result3 = await safeRun(timeoutAgent, "Hello");
console.log("Timeout result:", result3);
