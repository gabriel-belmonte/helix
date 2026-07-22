// Real end-to-end test against OpenRouter (OpenAI-compatible) using a FREE model.
// Loads OPENROUTER_API_KEY from ~/.hermes/.env (or the real env).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Agent, defineTool, TOOL_MARKER } from "../src/index.js";
import { openAIProvider } from "../src/providers.js";

function loadKey(): string {
  // 1) already in env?
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // 2) parse ~/.hermes/.env
  try {
    const txt = readFileSync(join(homedir(), ".hermes/.env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^OPENROUTER_API_KEY=(.*)$/);
      if (m) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  throw new Error("OPENROUTER_API_KEY not found in env or ~/.hermes/.env");
}

const key = loadKey();

// Free model on OpenRouter (OpenAI-compatible chat completions).
const MODEL = "tencent/hy3:free";

const llm = openAIProvider({
  apiKey: key,
  model: MODEL,
  baseUrl: "https://openrouter.ai/api/v1",
  tools: [
    {
      name: "get_weather",
      description: "Returns the current temperature (C) for a city",
    },
  ],
});

const weather = defineTool(
  "get_weather",
  "Returns the weather for a city",
  async (input: { city: string }) => ({ city: input.city, tempC: 21 })
);

const agent = new Agent({
  name: "Helper",
  system:
    "You are a helpful assistant. To get weather, call the get_weather tool, then answer the user using its result.",
  llm,
  tools: [weather],
});

const reply = await agent.run("What is the weather in Madrid? Reply with the temperature.");
console.log("Agent:", reply);
