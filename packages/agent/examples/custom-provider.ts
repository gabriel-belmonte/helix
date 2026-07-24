// Custom provider: build your own LLMProvider from scratch.
// Shows how to implement the LLMProvider interface for any API.
//
// Run: bun run examples/custom-provider.ts

import { Agent, defineTool, type LLMProvider, type ChatMessage } from "../src/index.js";

// --- 1. Simple echo provider (for testing) ---
const echoProvider: LLMProvider = {
  async complete(messages: ChatMessage[]): Promise<string> {
    const lastUser = messages.filter((m) => m.role === "user").at(-1);
    return `Echo: ${lastUser?.content ?? "(no message)"}`;
  },
};

// --- 2. Echo provider with tool support ---
const echoWithTools: LLMProvider = {
  async complete(messages: ChatMessage[]): Promise<string> {
    const lastUser = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

    // Check if the user mentions a tool
    if (lastUser.toLowerCase().includes("weather")) {
      return '@@TOOL@@ get_weather {"city":"Madrid"}';
    }
    return `Echo: ${lastUser}`;
  },
};

// --- 3. Provider with retry logic ---
function createRetryProvider(
  inner: LLMProvider,
  maxRetries = 3
): LLMProvider {
  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      let lastError: Error | null = null;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await inner.complete(messages);
        } catch (e) {
          lastError = e as Error;
          if (i < maxRetries) {
            const delay = 1000 * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      throw lastError;
    },
  };
}

// --- Demo: echo provider with tools ---
const weatherTool = defineTool(
  "get_weather",
  "Returns weather for a city",
  async (input: { city: string }) => ({ city: input.city, tempC: 21 })
);

const agent = new Agent({
  name: "EchoAgent",
  system: "You echo user messages. Use get_weather if asked about weather.",
  llm: echoWithTools,
  tools: [weatherTool],
});

// Test: echo without tool
const reply1 = await agent.run("Hello world!");
console.log("Echo:", reply1);

agent.reset();

// Test: triggers tool call
const reply2 = await agent.run("What's the weather?");
console.log("Weather:", reply2);
