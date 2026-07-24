# 🧬 helix

[![CI](https://github.com/gabriel-belmonte/helix/actions/workflows/ci.yml/badge.svg)](https://github.com/gabriel-belmonte/helix/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/gabriel-belmonte/helix)](https://github.com/gabriel-belmonte/helix/releases)
[![npm](https://img.shields.io/npm/v/helix-agent?label=npm)](https://www.npmjs.com/package/helix-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/written%20in-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-ready-00b894.svg)](https://modelcontextprotocol.io/)
[![skills.sh](https://img.shields.io/badge/skills.sh-compatible-ff4785.svg)](https://skills.sh/)
[![Bun](https://img.shields.io/badge/toolchain-Bun-000000.svg)](https://bun.sh/)
![Platform](https://img.shields.io/badge/platform-Linux%20|%20macOS%20|%20Windows-6f42c1)
[![Sponsor](https://img.shields.io/badge/sponsor-Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=000)](https://buymeacoffee.com/gabrielbelmonte)

**A coding agent you can actually read.** Minimal, transparent TypeScript agent framework — CLI, TUI, and web Dashboard, all in one binary.

## Quick start

```bash
# Install the unified binary (CLI + TUI + Dashboard, 1 file)
curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh

# Configure
export OPENCODE_ZEN_API_KEY="sk-..."
helix config set provider zen

# Use it
helix -p "refactor utils.ts to async/await"
helix tui                          # Terminal UI (Ink)
helix dashboard                    # Web Dashboard
```

## Features

| Feature | CLI | TUI | Dashboard | SDK |
|---------|:---:|:---:|:---------:|:---:|
| **Agent loop** (multi-turn + tools) | ✅ | ✅ | ✅ | ✅ |
| **Tool dispatch** (read, write, bash, search) | ✅ | ✅ | ✅ | ✅ |
| **Web search + extract** (SearXNG) | ✅ | ✅ | — | ✅ |
| **MCP servers** (Model Context Protocol) | ✅ | ✅ | — | ✅ |
| **Skills** (skills.sh / OpenCode / Claude) | ✅ | ✅ | — | ✅ |
| **Eval** (A/B comparison + LLM judge) | ✅ | — | — | ✅ |
| **Sub-agents** (process isolation, Pi-style) | ✅ | — | — | ✅ |
| **Provider fallback** (router chain) | ✅ | ✅ | — | ✅ |
| **Model selector** (58 Zen models, free highlighted) | ✅ | ✅ | ✅ | — |
| **Compression plugins** (RTK + Caveman) | ✅ | — | — | ✅ |
| **Docker sandbox** (`--sandbox`) | ✅ | — | — | — |
| **Memory** (persistent + soul persona) | ✅ | ✅ | ✅ | ✅ |

## One binary, three surfaces

```
$ helix -p "prompt"       → CLI mode (scripting / pipes / CI)
$ helix tui                → TUI (Ink terminal chat, Ctrl+M for model picker)
$ helix dashboard          → Web Dashboard on :8799
```

All three share the same `buildAgent()` engine. Behavior never diverges.

## Install

### Binary (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh
```

Downloads a single compiled binary for your OS (Linux x64/ARM64, macOS Intel/Silicon, Windows x64).

### npm (SDK only)

```bash
npm i helix-agent
```

```ts
import { Agent, scriptedLLM } from "helix-agent";

const agent = new Agent({
  name: "my-agent",
  system: "You are helpful.",
  llm: scriptedLLM(),
  tools: [
    { name: "greet", description: "Say hi", run: async () => "hello!" },
  ],
});

const reply = await agent.run("say hi");
```

### Docker

```bash
docker run --rm -it -v "$PWD:/workspace" ghcr.io/gabriel-belmonte/helix/helix-sandbox:latest -p "review this code"
```

## Packages

| Package | What it is | Status |
|---------|-----------|--------|
| [`helix-agent`](packages/agent) | Agent engine — loop, tool dispatch, providers | 📦 **npm** |
| [`helix-core`](packages/core) | Tool registry, plugin system, web module, auth, skills | 🔒 internal |
| [`helix-cli`](packages/cli) | Unified binary (CLI + TUI + Dashboard) | 🏗️ Bun binary |
| [`helix-tui`](packages/tui) | Ink terminal UI | 🏗️ bundled in CLI |
| [`helix-web`](packages/web) | Dashboard server (Hono) | 🏗️ bundled in CLI |
| [`helix-mcp`](packages/mcp) | MCP client plugin | 🔒 internal |
| [`helix-eval`](packages/eval) | A/B eval + LLM judge | 🔒 internal |
| [`helix-memory`](packages/memory) | Modular memory (JSONL) | 🔒 internal |
| [`helix-site`](packages/site) | Docs + landing (Astro) | 🌐 [live](https://gabriel-belmonte.github.io/helix/) |

## CLI commands

```
  helix -p "prompt"              run a single prompt and exit
  helix                           interactive REPL
  helix -v                        verbose: show tool calls
  helix -V, --version            show version
  helix status                   show provider, model, API keys, web infra
  helix tui                      launch Terminal UI (Ink)
  helix dashboard                launch web Dashboard on :8799
  helix config set <k> <v>       save config value
  helix config list              show full config
  helix auth login <provider>    store API key
  helix auth list                show configured keys (masked)
  helix models                   list Zen models (free highlighted)
  helix models select            interactive model picker
  helix eval --suite <f>         evaluate a model
  helix eval --suite <f> --compare <slug>   A/B two models
  helix eval --suite <f> --judge <slug>     LLM judge grading
  helix submit-task <file>       run as isolated sub-agent
  helix --sandbox -p "..."       run inside Docker sandbox (docker required)
  helix history clear            clear conversation history
  helix update                   update to latest release
```

## Skills & MCP — verified example

Wire up real MCP servers with `helix.mcp.json`:

```json
{
  "servers": {
    "fs": { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] },
    "context7": { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  }
}
```

Install skills from [skills.sh](https://skills.sh) with zero changes:

```bash
git clone --depth 1 https://github.com/vercel-labs/agent-skills.git /tmp/as
cp -r /tmp/as/skills/react-best-practices ~/.helix/skills/
```

## Providers

Configure via `helix config set` or environment variables:

| Provider | Config | Env var |
|----------|--------|---------|
| **OpenCode Zen** (free models) | `helix config set provider zen` | `OPENCODE_ZEN_API_KEY` |
| **OpenAI** | `helix config set provider openai` | `OPENAI_API_KEY` |
| **Anthropic** | `helix config set provider anthropic` | `ANTHROPIC_API_KEY` |
| **OpenRouter** (free tier) | `helix config set provider openrouter` | `OPENROUTER_API_KEY` |
| **HuggingFace** (free inference) | `helix config set provider hf` | `HF_TOKEN` |

Free Zen models: `deepseek-v4-flash-free`, `mimo-v2.5-free`, `nemotron-3-ultra-free`, `north-mini-code-free`, `laguna-s-2.1-free`

## Sub-agents (Pi-style)

Delegate tasks to isolated child processes:

```bash
helix submit-task '{"goal": "review src/index.ts for bugs", "context": "focus on security"}'
```

Returns structured result with usage stats:
```json
{ "result": "...", "agent": "sub-agent", "exitCode": 0, "usage": {"input": 45, "output": 120, "turns": 1} }
```

## Eval

Compare models quality / cost / latency:

```bash
helix eval --suite test.json --compare mimo-v2.5-free
helix eval --suite test.json --judge deepseek-v4-flash-free
```

## Architecture

```
                  ┌──────────────┐
                  │   helix CLI   │  bun --compile unified binary
                  │  (cli.ts)     │
                  └──────┬───────┘
                         │ buildAgent()
                  ┌──────▼───────┐
                  │  helix-core   │  Tool registry · Plugin system
                  │  (core/)      │  Web infra · Auth · Skills
                  └──────┬───────┘
          ┌───────────────┼───────────────┐
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │ helix-agent  │ │ helix-mcp   │ │ helix-memory │
   │ Engine ·     │ │ MCP client  │ │ JSONL store  │
   │ Providers    │ │ plugin      │ │ Soul persona │
   └──────────────┘ └──────────────┘ └──────────────┘
```

## Development

```bash
git clone https://github.com/gabriel-belmonte/helix.git
cd helix
bun install
bunx turbo run build          # build all packages
bunx turbo run test           # test all packages
bun build packages/cli/cli.ts --compile --outfile helix   # compile unified binary
```

### Structure

```
helix/
├── packages/
│   ├── agent/       → helix-agent     (npm: engine SDK)
│   ├── core/        → helix-core      (internal: registry, plugins, web, auth)
│   ├── cli/         → helix binary    (compiled CLI + TUI + Dashboard)
│   ├── tui/         → Ink TUI         (bundled in CLI binary)
│   ├── web/         → Hono dashboard  (bundled in CLI binary)
│   ├── mcp/         → MCP client      (internal plugin)
│   ├── eval/        → A/B eval        (internal)
│   ├── memory/      → JSONL memory    (internal)
│   └── site/        → Astro docs      (GitHub Pages)
├── turbo.json       → task orchestration
└── package.json     → Bun workspace root
```

## Why helix

- **LangChain** is heavy, opaque, hard to debug.
- **Most frameworks** lock you into their LLM client.
- **helix** is minimal and transparent. You read the core in one sitting, extend it in an afternoon, and swap any module without forking.

## License

MIT © gabriel-belmonte

## Sponsor

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=000)](https://buymeacoffee.com/gabrielbelmonte)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-29abe0?style=for-the-badge&logo=ko-fi&logoColor=fff)](https://ko-fi.com/gabrielbelmonte)
