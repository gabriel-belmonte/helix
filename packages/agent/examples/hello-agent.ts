import { Agent, defineTool, TOOL_MARKER } from "../src/index.js";
import { scriptedLLM } from "../src/providers.js";

// Demo: a scripted LLM that (1) asks for weather, (2) answers once it has it.
// Proves the tool-loop + multi-turn work without any API key.
let turn = 0;
const demoLLM = scriptedLLM((t) => {
  turn = t;
  if (t === 0) return `${TOOL_MARKER} get_weather {"city":"Madrid"}`;
  return "It's 21°C in Madrid. Enjoy! ☀️";
});

const weather = defineTool(
  "get_weather",
  "Returns the weather for a city",
  async (input: { city: string }) => ({ city: input.city, tempC: 21 })
);

const agent = new Agent({
  name: "Helper",
  system: "You are a helpful assistant.",
  llm: demoLLM,
  tools: [weather],
});

const reply = await agent.run("What's the weather in Madrid?");
console.log("Agent:", reply);
