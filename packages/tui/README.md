# helix-tui

Helix TUI — a thin Ink-based terminal UI over helix-core.

## Overview

`helix-tui` provides a rich terminal interface for interacting with Helix agents. Built on [Ink](https://github.com/vadimdemedes/ink) (React for CLIs), it offers a chat-like experience in the terminal with model selection, tool call visibility, and session management.

## Quick Start

The TUI is launched via the unified CLI binary:

```bash
helix tui
```

Or from source:

```bash
cd packages/tui
bun run src/tui.tsx
```

## Features

- **Chat interface** — conversational terminal UI with streaming responses
- **Model picker** — Ctrl+M to switch between Zen models
- **Tool call visibility** — see tool invocations and results inline
- **Session persistence** — resume previous conversations
- **Keyboard shortcuts** — efficient navigation and control

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+M | Open model picker |
| Ctrl+C | Exit |
| Enter | Send message |
| Shift+Enter | New line in input |

## Architecture

The TUI is a thin adapter over `helix-core`:

```
User input → Ink UI → helix-core buildAgent() → LLM + tools → Ink rendering
```

It imports the same `buildAgent()` engine as the CLI and Dashboard, so behavior is identical across all surfaces.

## Dependencies

- `ink` — React-based terminal UI framework
- `react` — UI primitives
- `helix-agent` — Agent engine
- `helix-core` — Tool registry, plugins, config

## Development

```bash
# From monorepo root
bun run packages/tui/src/tui.tsx

# Or via CLI
helix tui
```

## License

MIT
