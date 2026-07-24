// Streaming responses: receive tokens as they arrive from the LLM.
// Demonstrates the onChunk callback for real-time output.
//
// Run: bun run examples/streaming.ts

import { Agent, defineTool, scriptedLLM, TOOL_MARKER } from "../src/index.js";

// A scripted LLM that returns a multi-word response.
// In production, use vercelStreamingProvider or a provider with stream().
const streamingLLM = scriptedLLM(() => {
  return "The capital of France is Paris. It is known for the Eiffel Tower and world-class cuisine.";
});

const agent = new Agent({
  name: "StreamAgent",
  system: "You are a helpful assistant.",
  llm: streamingLLM,
});

// Collect chunks and display them as they arrive.
// Note: scriptedLLM doesn't actually stream (it returns the full response at once).
// For real streaming, use vercelStreamingProvider from "helix-agent/vercel".
const chunks: string[] = [];
const reply = await agent.run("What is the capital of France?", (chunk) => {
  chunks.push(chunk);
  process.stdout.write(chunk);
});

console.log("\n");
console.log(`Received ${chunks.length} chunk(s)`);
console.log(`Full reply: ${reply}`);

// --- Real streaming example (requires a streaming provider) ---
//
// import { vercelStreamingProvider } from "helix-agent/vercel";
// import { openai } from "@ai-sdk/openai";
//
// const agent = new Agent({
//   name: "RealStreamAgent",
//   system: "You are helpful.",
//   llm: vercelStreamingProvider({ model: openai("gpt-4o-mini") }),
// });
//
// const reply = await agent.run("Tell me a story", (chunk) => {
//   process.stdout.write(chunk); // tokens appear in real-time
// });
