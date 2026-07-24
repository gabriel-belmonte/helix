# helix-agent

Minimal TypeScript SDK to orchestrate AI agents and tools — a lightweight, transparent alternative to LangChain.

## Installation

```bash
npm install helix-agent
```

## Quick Start

```ts
import { Agent, defineTool, scriptedLLM } from "helix-agent";

const weather = defineTool(
  "get_weather",
  "Returns the weather for a city",
  async (input: { city: string }) => ({ city: input.city, tempC: 21 })
);

const agent = new Agent({
  name: "Helper",
  system: "You are a helpful assistant.",
  llm: scriptedLLM((turn) => {
    if (turn === 0) return '@@TOOL@@ get_weather {"city":"Madrid"}';
    return "It's 21°C in Madrid. Enjoy!";
  }),
  tools: [weather],
});

const reply = await agent.run("What's the weather in Madrid?");
console.log(reply);
```

## API

### `Agent`

The core agent class. Manages conversation history, tool dispatch, and the multi-turn loop.

```ts
new Agent(opts: AgentOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | — | Agent identifier |
| `system` | `string` | — | System prompt |
| `llm` | `LLMProvider` | — | LLM backend (OpenAI, Vercel, scripted, etc.) |
| `tools` | `Tool[]` | `[]` | Available tools |
| `maxSteps` | `number` | `5` | Max tool-call iterations per run |
| `onToolCall` | `(name, input) => void` | — | Callback for tool invocations |
| `initialHistory` | `ChatMessage[]` | `[]` | Seed conversation history |

**Methods:**
- `run(userMessage, onChunk?)` — Execute one user turn. Returns the final reply string.
- `reset()` — Clear conversation history.

### `defineTool(name, description, run)`

Helper to create a typed `Tool` object.

```ts
const tool = defineTool<string, object>(
  "get_weather",
  "Returns the weather for a city",
  async (input: string) => ({ temp: 21 })
);
```

### `scriptedLLM(script)`

A deterministic LLM provider for demos and tests. The `script` callback receives the turn number and returns the response text (including `@@TOOL@@` markers for tool calls).

### `openAIProvider(opts)`

OpenAI-compatible provider. Works with OpenAI, OpenRouter, Ollama, LM Studio, and any OpenAI-compatible endpoint.

```ts
import { openAIProvider } from "helix-agent";

const llm = openAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  tools: [{ name: "get_weather", description: "Get weather" }],
});
```

### Vercel AI SDK Adapter

Use any Vercel AI SDK provider (OpenAI, Anthropic, Google, etc.) with helix-agent:

```ts
import { Agent } from "helix-agent";
import { vercelProvider } from "helix-agent/vercel";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "my-agent",
  system: "You are helpful.",
  llm: vercelProvider({ model: openai("gpt-4o") }),
  tools: [...],
});
```

Available adapters: `vercelProvider`, `vercelToolProvider`, `vercelStreamingProvider`.

## How It Works

The LLM emits tool calls via the `@@TOOL@@` marker format:

```
@@TOOL@@ get_weather {"city":"Madrid"}
```

Providers convert native function_calls into this marker format so the core Agent stays provider-agnostic. The agent loop:

1. Send messages to the LLM
2. Parse `@@TOOL@@` markers from the response
3. Execute tools and feed results back
4. Repeat until no more tool calls or `maxSteps` reached

## License

MIT
