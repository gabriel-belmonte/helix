# 🧬 helix

**A coding agent you can actually read.**

Minimal TypeScript SDK + CLI for AI agents. ~300 LOC engine, no npm needed for the CLI. Bring your own LLM.

## Packages

| Package | What it is | Install |
|---|---|---|
| [`helix-agent`](packages/agent) | The engine — Agent loop, tool dispatch, multi-turn memory | `npm i helix-agent` |
| [`helix-agent-cli`](packages/cli) | Coding agent CLI — `curl` install, no npm needed | `curl \| sh` |
| [`helix-agent-eval`](packages/eval) | Quality / cost / latency regression detection | `npm i helix-agent-eval` |
| [`helix-site`](packages/site) | Landing page ([live](https://gabriel-belmonte.github.io/helix-agent/)) | — |

## Quick start

```bash
# Install the CLI (no npm needed)
curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh

# Or use the SDK
npm i helix-agent
```

```ts
import { Agent, defineTool } from "helix-agent";

const agent = new Agent({
  name: "Helper",
  system: "You are a helpful assistant.",
  llm: yourLLMProvider, // any { complete(messages) => string }
  tools: [],
});

const reply = await agent.run("Hello!");
```

## Development

This is a monorepo managed with npm workspaces + Turborepo.

```bash
npm install            # install all deps
npm run build          # build all packages
npm run test           # test all packages
npm run build:agent    # build just the engine
npm run build:cli      # build just the CLI
```

### Project structure

```
helix/
├── packages/
│   ├── agent/          → npm i helix-agent
│   ├── cli/            → curl | sh (native binary)
│   ├── eval/           → npm i helix-agent-eval
│   └── site/           → GitHub Pages
├── turbo.json          → task orchestration
└── package.json        → workspace root
```

## Why

- **LangChain** is heavy, opaque, hard to debug.
- **Most frameworks** lock you into their LLM client.
- **helix-agent** is ~300 LOC. You read it in one sitting, extend it in an afternoon.

## License

MIT © gabriel-belmonte
