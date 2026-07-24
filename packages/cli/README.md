# helix-agent-cli

A minimal, transparent coding agent CLI built on helix-agent. Native Bun binary with curl install.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh
```

## Quick Start

```bash
# Set up a provider
helix config set provider zen
helix config set model big-pickle

# Run a single prompt
helix -p "refactor utils.ts to async/await"

# Interactive REPL
helix

# Terminal UI
helix tui

# Web Dashboard
helix dashboard
```

## Commands

| Command | Description |
|---------|-------------|
| `helix -p "prompt"` | Run a single prompt and exit |
| `helix` | Interactive REPL |
| `helix -v` | Verbose mode (show tool calls) |
| `helix -V, --version` | Show CLI version |
| `helix status` | Show provider, model, API keys, web infra |
| `helix doctor` | Diagnose infrastructure (keys, web, docker, skills) |
| `helix init` | Setup wizard for first-time configuration |
| `helix tui` | Launch Terminal UI (Ink) |
| `helix dashboard` | Launch web Dashboard on :8799 |
| `helix config set <k> <v>` | Save config value |
| `helix config list` | Show full config |
| `helix auth login <provider>` | Store API key (hidden prompt) |
| `helix auth list` | Show configured keys (masked) |
| `helix auth logout <provider>` | Remove stored key |
| `helix models` | List Zen models (free highlighted) |
| `helix models select` | Interactive model picker |
| `helix models set <id>` | Set model directly |
| `helix eval --suite <f>` | Evaluate a model over test cases |
| `helix eval --suite <f> --compare <slug>` | A/B two models |
| `helix eval --suite <f> --judge <slug>` | LLM judge grading |
| `helix learn <url\|file>` | Create a skill from a URL or file |
| `helix rollback [path]` | Restore file from checkpoint |
| `helix session save <n>` | Save conversation history |
| `helix session load <n>` | Restore a saved conversation |
| `helix session list` | List saved sessions |
| `helix history clear` | Clear conversation history |
| `helix update` | Update to latest release |
| `helix submit-task <file>` | Run as isolated sub-agent |
| `helix --sandbox -p "..."` | Run inside Docker sandbox |

## Providers

| Provider | Config | Env var |
|----------|--------|---------|
| OpenCode Zen (free) | `helix config set provider zen` | `OPENCODE_ZEN_API_KEY` |
| OpenAI | `helix config set provider openai` | `OPENAI_API_KEY` |
| Anthropic | `helix config set provider anthropic` | `ANTHROPIC_API_KEY` |
| OpenRouter (free tier) | `helix config set provider openrouter` | `OPENROUTER_API_KEY` |
| HuggingFace (free) | `helix config set provider hf` | `HF_TOKEN` |

## Configuration

Config is stored at `~/.helix/config.json`. API keys are stored at `~/.helix/auth.json` (chmod 600). Environment variables always take precedence over stored keys.

| Key | Description |
|-----|-------------|
| `provider` | One of: `zen`, `hf`, `openrouter`, `openai`, `anthropic` |
| `model` | Model slug (e.g. `big-pickle`, `Qwen/Qwen3-Coder-Next`) |
| `zenBaseUrl` | Override Zen endpoint |
| `hfBaseUrl` | Override HF endpoint |

## Web Tools

Enable web search and extraction with self-hosted infrastructure:

```bash
helix --web -p "search for latest Rust releases"
helix --web-search -p "search for TypeScript tips"
helix --web-extract -p "extract content from https://example.com"
```

Requires SearXNG on `:8888` and the extract server on `:8787`.

## License

MIT
