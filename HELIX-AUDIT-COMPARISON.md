# Helix Audit: Comparative Analysis & Gap Report

> **Date:** 2026-07-24
> **Scope:** Helix v0.2.5 vs OpenCode, Omo (oh-my-openagent), and Hermes Agent
> **Author:** Automated audit via kanban task t_241f0608

---

## 1. Executive Summary

Helix is a **minimal, transparent TypeScript agent framework** — a single-binary (CLI + TUI + Dashboard) built on a shared `buildAgent()` engine. Its core philosophy ("you can actually read it") makes it the most approachable codebase of the four, but it also means many features that competitors ship out of the box are absent or in early stages.

| Dimension | Helix | OpenCode | Omo (oh-my-openagent) | Hermes Agent |
|---|---|---|---|---|
| **Lang** | TypeScript (Bun) | Rust/TS | Multi-agent harness (configs) | Python |
| **Stars** | ~500 | 160K | 66.5K | ~4K |
| **Age** | Early (v0.2.5) | Mature | Mature | Established |
| **Architecture** | Monorepo, shared core | Terminal app | Agent orchestration layer | Full agent platform |
| **License** | MIT | MIT | MIT | MIT |

---

## 2. Feature Comparison Matrix

| # | Feature Area | Helix | OpenCode | Omo | Hermes Agent |
|---|---|---|---|---|---|
| 1 | **Agent Loop** | ✅ `@@TOOL@@` marker parsing | ✅ Native | ✅ (via OpenCode/Codex) | ✅ Vercel AI SDK-based |
| 2 | **File Tools** | ✅ read/write/search | ✅ | ✅ | ✅ |
| 3 | **Terminal/Bash** | ✅ run_bash (execSync) | ✅ Full terminal | ✅ Full interactive terminal | ✅ Terminal tool |
| 4 | **Web Search** | ✅ SearXNG (opt-in) | ❌ (privacy-first) | ❌ | ✅ Multi-backend |
| 5 | **Web Extract** | ✅ Firecrawl-compat (opt-in) | ❌ | ❌ | ✅ Multi-backend |
| 6 | **Skills System** | ✅ SKILL.md + use_skill | ✅ skills.sh compatible | ✅ (AGENTS.md) | ✅ agentskills.io + /learn |
| 7 | **MCP Support** | ✅ stdio/http/SSE | ✅ | ✅ | ✅ stdio/HTTP |
| 8 | **Memory** | ✅ JSONL (remember/recall/reflect) | ✅ SQLite conv history | ❌ (stateless) | ✅ Mnemosyne (multi-tier + vector) |
| 9 | **Soul/Persona** | ✅ soul.md | ❌ | ✅ | ✅ SOUL.md + /personality |
| 10 | **Sub-agent Delegation** | ✅ Pi-style (child process) | ❌ (multi-session, not delegation) | ✅ Isolated worktrees | ✅ delegate_task + kanban |
| 11 | **Provider Fallback** | ✅ Router chain | ✅ (many providers) | ✅ (40+ providers) | ✅ Routing + fallbacks |
| 12 | **Model Router** | ✅ makeProviderRouter | ✅ Models.dev | ✅ Multiple backends | ✅ Provider routing |
| 13 | **Eval System** | ✅ A/B + LLM judge | ❌ | ❌ | ✅ Batch processing |
| 14 | **CLI** | ✅ commander-based | ✅ | ✅ (bin/launcher) | ✅ |
| 15 | **TUI** | ✅ Ink-based | ❌ (tabs in desktop) | ❌ | ❌ (CLI only) |
| 16 | **Web Dashboard** | ✅ Hono+React | ❌ | ❌ | ✅ Dashboard |
| 17 | **Plugin System** | ✅ ToolRegistry + override | ❌ | ❌ | ✅ 3 plugin types |
| 18 | **Compression (RTK/Caveman)** | ✅ Plugin-based | ❌ | ❌ | ❌ (not needed) |
| 19 | **Cron/Scheduling** | ❌ | ❌ | ❌ | ✅ Full cron system |
| 20 | **LSP/Code Intelligence** | ❌ | ✅ LSP enabled | ✅ CodeGraph | ✅ LSP diagnostics |
| 21 | **Browser Automation** | ❌ | ❌ | ❌ | ✅ Browserbase/Use/CDP |
| 22 | **Vision/Image** | ❌ | ❌ | ❌ | ✅ vision_analyze + paste |
| 23 | **Image Generation** | ❌ | ❌ | ❌ | ✅ FAL.ai (11 models) |
| 24 | **Voice/TTS** | ❌ | ❌ | ❌ | ✅ 10 TTS providers |
| 25 | **Voice Mode** | ❌ | ❌ | ❌ | ✅ Full voice (mic+speaker) |
| 26 | **Messaging Platform Support** | ❌ | ❌ | ❌ | ✅ TG/Discord/Slack/WhatsApp/Signal/SMS/X |
| 27 | **Checkpoints/Rollback** | ❌ | ❌ | ❌ | ✅ Auto-snapshot + /rollback |
| 28 | **Multi-tenant Profiles** | ❌ | ❌ | ❌ | ✅ hermes profile |
| 29 | **Docker Sandbox** | ✅ --sandbox | ❌ | ❌ | ✅ Docker sandbox |
| 30 | **Desktop App** | ❌ (binary only) | ✅ macOS/Win/Linux | ❌ | ❌ (CLI only) |
| 31 | **Kanban Board** | ❌ | ❌ | ❌ | ✅ Multi-agent board |
| 32 | **Persistent Goals** | ❌ | ❌ | ✅ ULW-loop + evidence | ✅ Persistent goals |
| 33 | **IDE Integration (ACP)** | ❌ | ✅ (VS Code ext) | ❌ | ✅ VS Code/Zed/JetBrains |
| 34 | **API Server (OpenAI-compat)** | ❌ | ❌ | ❌ | ✅ |
| 35 | **Batch Processing** | ❌ | ❌ | ❌ | ✅ Training data generation |
| 36 | **Context References (@-refs)** | ❌ | ❌ | ❌ | ✅ @file, @folder, @git-diff, @url |
| 37 | **Event Hooks** | ❌ | ❌ | ❌ | ✅ Gateway + plugin hooks |
| 38 | **Credential Pools** | ❌ | ❌ | ❌ | ✅ Multi-key rotation |
| 39 | **Prompt Caching** | ❌ | ❌ | ❌ | ✅ Prefix cache (Claude) |
| 40 | **Privacy-first Design** | ❌ (web infra via Docker) | ✅ No code storage | ❌ | ❌ (cloud features) |

---

## 3. Detailed Comparison by Category

### 3.1 Agent Engine & Architecture

**Helix** uses a clean `@@TOOL@@` marker-based approach in `packages/agent/src/index.ts`. The `Agent` class runs a multi-turn loop: parse tool calls from LLM output, execute them, feed results back, repeat (max 8 steps). The shared `buildAgent()` in `packages/core/src/agent.ts` builds the system prompt, discovers skills, and wires memory tools — all three surfaces (CLI, TUI, Dashboard) call the same function.

**Strengths:**
- Transparent, readable codebase (~200 lines for agent loop)
- Provider-agnostic core (no vendor lock-in)
- True shared engine across all surfaces

**Gaps vs competitors:**
- No streaming in agent loop (streaming is provider-level only)
- No tool result schema (all results are JSON-stringified)
- No parallel tool execution within a single turn
- No built-in retry/backoff for tool calls

### 3.2 Skills System

**Helix** discovers SKILL.md files from multiple directories (`~/.helix/skills`, `~/.claude/skills`, etc.) and injects an `use_skill` (plus `skill` alias) tool. Skills use progressive disclosure: a compact listing appears in the system prompt, full content loads on demand.

**Strengths:**
- OpenCode/Claude-compatible format — skills from skills.sh work unchanged
- Multi-directory discovery (user, project, Claude, OpenCode)
- Simple YAML frontmatter parser (no dependencies)

**Gaps:**
- No `/learn` command (auto-create skills from sources)
- No skill bundles (composite skills)
- No skill listing tool (the agent just sees them in the system prompt)
- No skill management CLI (create/edit/delete)
- No skills hub integration

**Hermes Agent comparison:** Hermes has a full `/learn` command, skill bundles, skill marketplace integration, and `hermes skills` CLI for management. Helix's skills are read-only from the agent's perspective.

### 3.3 Memory System

**Helix** uses `helix-memory` with a `MemoryStore` interface. Default backend is JSONL file (`~/.helix/memory.jsonl`). Three tools: `remember`, `recall`, `reflect`. Keyword-overlap ranking + importance + recency.

**Strengths:**
- Clean interface design → swappable backends
- Simple append-only JSONL (corruption-free writes)
- Multi-bank support (global, project:*)

**Gaps:**
- No vector/embeddings search (keyword-only recall)
- No episodic memory consolidation
- No persona tiering (all memories equal)
- No cross-session consolidation
- No soul/memory relationship (soul.md is separate)
- No agent-initiated memory management

### 3.4 Sub-agent Delegation

**Helix** spawns child `helix submit-task` processes. The `delegate.ts` plugin finds the helix binary, writes a task JSON, spawns the child, captures stdout. Supports single-mode only (parallel and chain are stubbed with error messages).

**Strengths:**
- True process isolation (separate PID, memory space)
- Structured input/output via JSON files

**Gaps:**
- Parallel mode not implemented
- Chain mode not implemented
- No live transcript streaming
- No model override for sub-agents
- No tool access restriction per sub-agent
- Parent blocks on synchronous execution (no background notification)
- No durable completion (parent crash = work lost)

### 3.5 MCP Support

**Helix** implements a full MCP client plugin (`helix-mcp`) supporting stdio, Streamable HTTP, and SSE transports. Tools are namespaced as `<server>__<tool>`.

**Strengths:**
- All three transports supported
- Proper JSON schema passthrough from MCP to agent
- Plugin-based (opt-in)

**Gaps:**
- MCP servers configured via code only (no `helix.mcp.json` equivalent in the plugin — the Dashboard has a JSON file but the plugin doesn't read it automatically)
- No tool filtering
- No sampling support
- No server lifecycle management (auto-reconnect on crash)
- No per-server tool filtering

### 3.6 Web & Media

**Helix** has two opt-in web tools: `web_search` (SearXNG via Docker) and `web_extract` (Firecrawl-compatible Python server). Auto-provisioning via `web-infra.ts`.

**Strengths:**
- Zero-config provisioning (auto-starts Docker/python servers)
- Self-hosted (no paid API keys needed)

**Gaps (the biggest area vs Hermes Agent):**
- No browser automation
- No vision/image analysis
- No image generation
- No voice/TTS
- SearXNG requires Docker (adds dependency)
- Web infra is synchronous (waits for container readiness on first call)
- No multi-backend support for search/extraction

### 3.7 Eval System

**Helix** has a proper eval system (`helix-agent-eval`) with `runEval`, `compareEval`, and `makeLlmJudge`. CLI interface via `helix eval`.

**Strengths:**
- A/B comparison of models
- LLM-as-judge scoring
- Per-case cost/latency tracking
- Reuses the same provider pipeline as production

**Gaps:**
- Token estimation is heuristic (chars/4, not real tokenizer)
- No regression tracking (compare against stored baselines)
- No eval suite management (no stored results DB)
- No visualization of results
- No dataset versioning

### 3.8 Platform Support & Multi-Surface

**Helix** offers three surfaces from one binary: CLI (`-p`), TUI (`tui`), Dashboard (`dashboard`). All share the same `buildAgent()` engine.

**Strengths:**
- One binary, three surfaces (efficient)
- True engine sharing (behavior never diverges)
- TUI is Ink/React-based (familiar for web devs)

**Gaps:**
- No desktop app
- No IDE extension
- No messaging platform integrations
- No API server mode
- No mobile support

### 3.9 Automation

**Helix** has no built-in automation features.

**Gaps vs Hermes Agent:**
- No cron/scheduled tasks
- No kanban board
- No event hooks
- No batch processing
- No persistent goals
- No automation blueprints

---

## 4. Prioritized Gap List

Gaps are ranked by **User Impact** (how much users will feel the absence) × **Implementation Feasibility** (how hard it is to add to Helix's existing architecture).

| Priority | Gap | User Impact | Feasibility | Why |
|---|---|---|---|---|
| **P0** | **LSP / Code Intelligence** | Critical | Medium | OpenCode's flagship feature. Without it, Helix models lack code awareness — can't resolve symbols, see errors, or navigate types. Essential for a coding agent. |
| **P0** | **Scheduled Tasks (Cron)** | Critical | Easy | Hermes's cron system is well-documented; Helix could add a `helix cron` command that shells out to system cron. Users need recurring tasks. |
| **P1** | **Browser Automation** | High | Hard | Hermes uses Browserbase/Browser Use/CDP. Helix would need a Playwright/Puppeteer-based tool or delegate to an MCP server. |
| **P1** | **Vision / Image Processing** | High | Medium | Add image analysis via model with vision capabilities or an MCP server. Many coding tasks need screenshot analysis. |
| **P1** | **Parallel Sub-agent Delegation** | High | Medium | Code already has the schema and stubs — just needs the ThreadPoolExecutor-style implementation. |
| **P1** | **Agent-accessible Skill Management** | High | Easy | Add `create_skill`, `edit_skill`, `delete_skill` tools and a `/learn` command. Reuses existing skill infrastructure. |
| **P1** | **Streaming Agent Output** | High | Easy | Agent loop already passes `onChunk` to `_callLLM` but doesn't stream to the user. Pipe chunks to stdout. |
| **P2** | **Vector Memory (Semantic Search)** | Medium | Medium | Replace or augment JSONL keyword search with a lightweight vector store. Huge quality improvement for memory recall. |
| **P2** | **Checkpoints / Rollback** | Medium | Medium | Snapshot working dir before each file write. Well-understood pattern; adds safety net for destructive operations. |
| **P2** | **Context References (@-refs)** | Medium | Easy | Pre-process user messages for `@path`, `@url` patterns and inline file contents. Good UX improvement. |
| **P2** | **IDE Integration (VS Code)** | Medium | Hard | LSP is P0 and enables this. Would need ACP protocol support or a VS Code extension. |
| **P2** | **Durable Sub-agent Completions** | Medium | Medium | Save delegation results to disk so parent restart doesn't lose work. |
| **P2** | **Multi-backend Web Tools** | Medium | Easy | Add Tavily/Exa backends alongside SearXNG, with a config toggle. |
| **P3** | **Voice / TTS** | Low | Hard | Requires audio capture + streaming TTS. Nice for accessibility but not core to a coding agent. |
| **P3** | **Image Generation** | Low | Medium | FAL.ai API integration. Useful for creative tasks but not core. |
| **P3** | **Kanban Board** | Low | Hard | Full multi-agent orchestration is a big feature. Start with simple task queue. |
| **P3** | **Multi-platform Messaging** | Low | Hard | Telegram/Discord/etc. gateways. Heavy infra for early-stage project. |
| **P3** | **API Server** | Low | Medium | OpenAI-compatible endpoint. Useful for integrations but adds surface area. |

---

## 5. Where Helix Excels (Strengths to Preserve)

While the gap list is long, Helix has genuine strengths that competitors don't match:

| Strength | Details |
|---|---|
| **Codebase Readability** | ~200-line agent loop, ~150-line registry, ~100-line skill system. A senior dev can understand the entire engine in an afternoon. |
| **Single Binary Distribution** | `bun --compile` produces one file for all three surfaces. Hermes Agent requires a full Python environment. |
| **True Shared Engine** | CLI, TUI, Dashboard all call `buildAgent()`. Behavior is guaranteed identical. Hermes has separate entry points per platform. |
| **Zero-Config Web Infra** | Auto-provisions SearXNG + extract server. No API keys needed for basic web functionality. |
| **Minimal Dependencies** | Core depends only on `helix-agent` + `ai` SDK. No LangChain, no heavy framework bloat. |
| **Compression Plugins (RTK/Caveman)** | Unique token-saving features. No competitor has anything equivalent — saves 30-70% on tool output tokens. |
| **MCP with All Transports** | Supports stdio, HTTP, and SSE. OpenCode only has stdio + SSEClientTransport. |
| **Bun-native Build** | Fast compilation, single binary, TypeScript-native. No Webpack/Rollup bundling needed. |
| **OpenCode Zen Integration** | Free model access through Zen gateway. 58 models including free tier. |
| **Provider Router** | Clean fallback chain implementation. Better than most competitors' "try one then fail" model. |

---

## 6. Strategic Recommendations

### Quick Wins (1-2 days each)
1. **Stream agent output to user** — wire `onChunk` through to stdout
2. **Implement parallel delegation** — finish the stubbed `delegate.ts` code
3. **Add `create_skill`/`edit_skill` agent tools** — lets the agent manage skills
4. **Multi-backend web search** — add Tavily as an alternative to SearXNG

### Medium-Term (1-2 weeks)
5. **LSP integration** — launch an LSP client in a child process, expose diagnostics as tool results
6. **Vector memory** — integrate a local embedding model or use Zen's embedding endpoint
7. **Checkpoints/rollback** — git-based snapshots before file writes
8. **Context references** — pre-process `@` mentions in user input

### Long-Term (2-4 weeks)
9. **Cron/scheduling** — `helix cron` command with SQLite job store
10. **Browser automation** — Playwright-based tool or MCP-browser bridge
11. **Vision support** — add `vision_analyze` tool using multimodal models
12. **Durable delegation** — save sub-agent state to disk for crash recovery

### What Helix Should NOT Build (For Now)
- Multi-platform messaging gateways (use MCP/webhooks instead)
- Full IDE extensions (start with LSP + basic ACP support)
- Voice/TTS (not core to coding agent value proposition)
- Kanban boards (too much infra for current stage)

---

## 7. Methodology

- **Helix analysis:** Direct source code review of all packages (agent, core, cli, eval, memory, mcp, web, tui)
- **OpenCode analysis:** Published website (opencode.ai), GitHub repository, documentation
- **Omo analysis:** GitHub repository (code-yeongyu/oh-my-openagent), README, directory structure
- **Hermes Agent analysis:** Published documentation (hermes-agent.nousresearch.com), feature overviews, GitHub repository
- **Gap scoring:** User impact rated on user-facing value for a coding agent audience; feasibility rated on implementation complexity within Helix's existing architecture
