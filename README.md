# 🧬 helix

[![CI](https://github.com/gabriel-belmonte/helix/actions/workflows/ci.yml/badge.svg)](https://github.com/gabriel-belmonte/helix/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/written%20in-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-ready-00b894.svg)](https://modelcontextprotocol.io/)
[![skills.sh compatible](https://img.shields.io/badge/skills.sh-compatible-ff4785.svg)](https://skills.sh/)
[![Bun](https://img.shields.io/badge/toolchain-Bun%201.3.14-000000.svg)](https://bun.sh/)

**A coding agent you can actually read.**

Minimal, transparent TypeScript agent framework — a single readable core that
every surface shares (CLI, TUI, web, Dashboard, Desktop). Modular, swappable
modules. Bring your own LLM. **MCP + Skills compatible.**

## Packages

| Package | What it is | Install |
|---|---|---|
| [`helix-agent`](packages/agent) | The engine — Agent loop, tool dispatch, multi-turn memory | `npm i helix-agent` |
| [`helix-core`](packages/core) | Single source of truth: tool registry, plugin system, web module, auth, skills, `buildAgent()` | `npm i helix-core` |
| [`helix-mcp`](packages/mcp) | MCP (Model Context Protocol) client plugin — expose any MCP server's tools as local tools | `npm i helix-mcp` |
| [`helix-agent-cli`](packages/cli) | Coding agent CLI (`helix`) — Bun-compiled binary | `npm i helix-agent-cli` |
| [`helix-tui`](packages/tui) | Terminal UI (Ink) over the same core — chat, streaming, live tool calls | `npm i helix-tui` |
| [`helix-agent-eval`](packages/eval) | Quality / cost / latency regression detection | `npm i helix-agent-eval` |
| [`helix-web`](packages/web) | Dashboard — web control panel (config, keys, skills, MCP, files) | `npm i helix-web` |
| [`helix-site`](packages/site) | Landing + docs ([live](https://gabriel-belmonte.github.io/helix-agent/)) | — |

## Features

- **One core, many surfaces** — CLI, TUI, and (soon) web/Dashboard/Desktop all
  call the same `buildAgent()`. Behavior never diverges.
- **Modular by default** — features like the `web` group (search + extract) are
  independent, opt-in, and swappable via the plugin system.
- **MCP support** — connect to any MCP server (stdio / http / sse) and use its
  tools as if they were local. Works with the [skills.sh](https://skills.sh)
  ecosystem too.
- **Skills** — load specialized instructions on demand from `SKILL.md` folders.
  Compatible with OpenCode / Claude Code skills (same `SKILL.md` format),
  including skills published on [skills.sh](https://skills.sh).
- **Secure by default** — API keys in `~/.helix/auth.json` (`chmod 600`),
  resolved as `env var > stored`. No at-rest encryption theater.
- **Bring your own LLM** — OpenAI, Anthropic, OpenRouter, HuggingFace,
  OpenCode Zen, or any OpenAI-compatible endpoint.

## Quick start

```bash
# Install the CLI (Bun-compiled binary)
curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh

# Or use the SDK
npm i helix-core
```

```ts
import { buildAgent } from "helix-core";

const agent = await buildAgent(yourLLMProvider, {
  config: { web: { search: true, extract: true } },
});

const reply = await agent.run("List the files in src/");
```

## Skills & MCP — verified example

Helix connects to real MCP servers. This `helix.mcp.json` wires up the
filesystem server and [Context7](https://context7.com) at once:

```json
{
  "servers": {
    "fs": { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] },
    "context7": { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  }
}
```

Install a skill from [skills.sh](https://skills.sh) with zero changes:

```bash
git clone --depth 1 https://github.com/vercel-labs/agent-skills.git /tmp/as
mkdir -p ~/.helix/skills
cp -r /tmp/as/skills/react-best-practices ~/.helix/skills/
```

See the [docs](https://gabriel-belmonte.github.io/helix-agent/helix/introduction/)
for the full guide (MCP, Skills, API keys).

## Development

This is a monorepo managed with **Bun** + Turborepo.

```bash
bun install            # install all deps
bunx turbo run build   # build all packages
bunx turbo run test    # test all packages
```

### Project structure

```
helix/
├── packages/
│   ├── agent/     → npm i helix-agent        (engine)
│   ├── core/      → npm i helix-core         (single source of truth)
│   ├── mcp/       → npm i helix-mcp           (MCP client plugin)
│   ├── cli/       → helix CLI (Bun binary)
│   ├── tui/       → npm i helix-tui           (Ink terminal UI)
│   ├── eval/      → npm i helix-agent-eval    (regression detection)
│   └── site/      → Astro + Starlight docs    (GitHub Pages)
├── turbo.json     → task orchestration
└── package.json   → Bun workspace root
```

## Why

- **LangChain** is heavy, opaque, hard to debug.
- **Most frameworks** lock you into their LLM client.
- **helix** is minimal and transparent. You read the core in one sitting,
  extend it in an afternoon, and swap any module without forking.

## License

MIT © gabriel-belmonte
