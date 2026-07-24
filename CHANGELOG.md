# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.6] - 2025-07-24

### Added
- **Web Dashboard** — Hono-based control panel on port 8799 (config, API keys, skills, MCP, files). Launched with `helix dashboard`.
- **TUI (Terminal UI)** — Ink-based full-screen chat with streaming output, tool-call indicator, and model picker (Ctrl+M). Launched with `helix tui`.
- **Sub-agents** — Process-isolated child agent delegation (Pi-style). Run with `helix submit-task`.
- **Compression plugins** — Caveman (40–60% token savings) and RTK (30–70%) plugins for reducing tool output token usage.
- **Model selector** — Interactive model picker with 58+ Zen models, free models highlighted.
- **Provider fallback chain** — Auto-failover across multiple LLM providers when configured via `helix config set fallback`.
- **Session management** — Save, load, export, and list conversations (`helix session` commands).
- **JSON output mode** — Structured JSON output for scripting/CI (`--json` flag).
- **Init wizard** — Interactive setup for first-time users (`helix init`).
- **Doctor command** — Full diagnostics check for API keys, infra, Docker, skills (`helix doctor`).
- **Self-update** — Update to latest release binary (`helix update`).
- **Docker sandbox** — Run agent inside Docker containers (`--sandbox` flag).
- **MCP integration** — Model Context Protocol support for connecting external tool servers (`helix.mcp.json`).
- **Skills system** — Compatible with skills.sh, OpenCode, and Claude skill formats.
- **Eval suite** — A/B model comparison and LLM judge grading for quality/cost/latency regression detection.
- **Soul/persona memory** — Persistent JSONL-based memory with personality configuration.
- **Verified provenance** — npm publish with `--provenance` for supply-chain security.

### Changed
- Unified binary architecture — CLI + TUI + Dashboard compiled into a single binary via `bun --compile`.
- Monorepo restructure — Moved to Bun workspaces with Turborepo task orchestration (`packages/agent`, `packages/core`, `packages/cli`, `packages/tui`, `packages/web`, `packages/mcp`, `packages/eval`, `packages/memory`, `packages/site`).
- `helix-core` as single source of truth — Agent runtime, tool registry, plugin system, config, and auth centralized in one package.
- Replaced LangChain dependency — Zero-dependency agent engine with `ai` (Vercel) as the only peer dependency.
- Web module split — Granular `web_search` (SearXNG) and `web_extract` (Firecrawl-compatible) as independently toggleable modules, off by default.

### Fixed
- CI build and test pipeline — Bun-based CI with Turborepo, excluding docs site from test graph for speed.
- Binary cross-compilation — Native binaries for Linux x64/ARM64, macOS Intel/Silicon, Windows x64 via `bun build --compile`.

## [0.2.5] - 2025-07-23

### Added
- **Web search module** — SearXNG-backed `web_search` tool for local web search without API keys.
- **Web extract module** — Firecrawl-compatible `web_extract` tool for page content extraction.
- **Self-provisioning infra** — Helix automatically starts SearXNG (Docker) and extract server (Python) when web modules are enabled.
- **Provider system** — Support for OpenCode Zen (free models), OpenAI, Anthropic, OpenRouter, and HuggingFace providers.
- **Config system** — `helix config` commands for managing provider, model, and feature settings.
- **Auth system** — `helix auth` commands for storing and managing API keys.
- **Plugin system** — `ctx.overrideTool(...)` API for replacing or adding modules without forking.

### Changed
- Initial public release of the monorepo architecture.
- CLI rewritten as a Bun native binary with `--compile`.

### Fixed
- Tool dispatch reliability improvements.
- Provider error handling and retry logic.

## [0.2.0] - 2025-07-22

### Added
- **Agent engine** — Core agent loop with multi-turn conversation and tool dispatch.
- **Tool registry** — Centralized tool registration and dispatch system.
- **CLI** — Command-line interface for running prompts, interactive REPL, and configuration.
- **Skills support** — Load SKILL.md files for agent context and capabilities.
- **Memory** — JSONL-based persistent conversation memory.
- **Eval** — Basic model evaluation and comparison tools.
- **MCP client** — Model Context Protocol client for connecting external tool servers.

### Changed
- Initial public release as a monorepo.

[Unreleased]: https://github.com/gabriel-belmonte/helix/compare/v0.2.6...HEAD
[0.2.6]: https://github.com/gabriel-belmonte/helix/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/gabriel-belmonte/helix/compare/v0.2.0...v0.2.5
[0.2.0]: https://github.com/gabriel-belmonte/helix/releases/tag/v0.2.0
