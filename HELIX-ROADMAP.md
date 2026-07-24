# Helix Improvement Roadmap

> **Date:** 2026-07-24
> **Scope:** Helix v0.2.5 → v0.4.0
> **Based on:** [HELIX-AUDIT-COMPARISON.md](./HELIX-AUDIT-COMPARISON.md) (40-dimension gap analysis vs OpenCode, Omo, Hermes Agent)
> **Effort Scale:** 1 SP ≈ 1 day for one developer

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Sprint 1 — Quick Wins (Week 1)](#2-sprint-1--quick-wins-week-1)
3. [Sprint 2 — Core Infrastructure (Week 2)](#3-sprint-2--core-infrastructure-week-2)
4. [Sprint 3 — Memory & Safety (Week 3)](#4-sprint-3--memory--safety-week-3)
5. [Dependency Graph](#5-dependency-graph)
6. [Total Effort & Timeline](#6-total-effort--timeline)
7. [Explicit Non-goals](#7-explicit-non-goals)

---

## 1. Executive Summary

Helix's biggest competitive gaps are **LSP/code intelligence**, **scheduled tasks**, **browser automation**, and **vision/image processing**. Most quick wins (streaming, parallel delegation, skill management) are already partially stubbed — they need implementation, not invention.

This roadmap sequences 10 improvements across 3 sprints (~3 weeks), prioritizing user impact and implementation feasibility. Each item includes:

- **Description** — what gets built
- **Expected Benefit** — why it matters
- **Effort** — story points (1 SP ≈ 1 day)
- **Success Metric** — how we verify it's done

---

## 2. Sprint 1 — Quick Wins (Week 1)

**Theme:** Ship high-impact features that already have stubs or infrastructure in place.
**Total:** 10 SP | **Target:** v0.3.0

### 2.1 Streaming Agent Output (P1, 1 SP)

**Description:** Wire the existing `onChunk` callback in the agent loop through to the CLI's stdout so users see tokens as they arrive instead of waiting for the full response. Currently `Agent.run()` accepts `onChunk` and `LLMProvider.stream` is defined, but no surface pipes chunks to the user.

**Expected Benefit:** Dramatically improved perceived responsiveness. Users see output incrementally instead of staring at a spinner.

**Effort:** 1 SP

**Success Metric:** `helix -p "write a haiku about typescript"` prints tokens progressively instead of all at once.

**Implementation notes:**
- In the CLI's single-prompt mode, `onChunk` should write to `process.stdout.write(chunk)` without buffering
- In REPL mode, chunks stream into the current message area
- TUI already renders incrementally through Ink's built-in streaming

---

### 2.2 Parallel Sub-agent Delegation (P1, 3 SP)

**Description:** Replace the stubbed `"parallel mode not yet implemented"` and `"chain mode not yet implemented"` in `packages/core/src/delegate.ts` with real implementations. Parallel mode spawns N sub-agents concurrently via `Promise.allSettled`; chain mode pipes one sub-agent's result as the next's context.

**Expected Benefit:** Unlocks true concurrent work — code review + test writing + docs generation in parallel. The schema and tool description already advertise these modes.

**Effort:** 3 SP

**Success Metric:** `{ goal: "...", mode: "parallel", agents: ["reviewer", "tester"] }` spawns both sub-agents concurrently and returns consolidated results within ~max(individual times) instead of sum.

**Implementation notes:**
- Parallel: use `Promise.allSettled` over `spawnSync` → need `spawn` (async) instead of `spawnSync`
- Each child writes its own temp result file for collection
- Chain: pipe `result.result` from task N as `context` into task N+1
- Add `HELIX_WAIT` env flag to avoid parent blocking; return a job handle

---

### 2.3 Agent-accessible Skill Management (P1, 2 SP)

**Description:** Add three new agent tools — `create_skill`, `edit_skill`, `delete_skill` — and a `helix learn` CLI command that creates a skill from a URL or file. Currently skills are read-only from the agent's perspective (discover via `use_skill` but never write).

**Expected Benefit:** Agents can persist workflows and patterns on the fly without the user manually creating SKILL.md files. Matches Hermes Agent's `/learn` capability.

**Effort:** 2 SP

**Success Metric:** An agent can call `create_skill` with a name/description/body, then immediately `use_skill` it. Skills persist across sessions.

**Implementation notes:**
- `create_skill(name, description, body)` — writes `~/.helix/skills/<name>/SKILL.md`
- `edit_skill(name, body)` — overwrites existing SKILL.md body
- `delete_skill(name)` — removes the skill directory
- `helix learn <url|file>` — reads content and creates a skill from it
- All operations re-discover skills so the system prompt updates next turn
- Place tools in `packages/core/src/skill.ts` alongside existing skill infrastructure

---

### 2.4 Multi-backend Web Tools (P2, 2 SP)

**Description:** Add Tavily and Exa as alternative backends for `web_search` and `web_extract`, configurable via `helix config set web.backend tavily` or a feature flag. Currently Helix only supports SearXNG (self-hosted Docker, opt-in).

**Expected Benefit:** Users who prefer managed API services over self-hosting Docker can use Tavily/Exa without changing tools. Reduces Docker dependency for minimal installs.

**Effort:** 2 SP

**Success Metric:** With `HELIX_TAVILY_API_KEY` set, `web_search` returns results using Tavily backend without SearXNG running.

**Implementation notes:**
- Create a `WebBackend` interface in `packages/core/src/web_search.ts`
- Current SearXNG implementation becomes one backend implementation
- Add Tavily backend (REST API, needs API key in auth.json)
- Runtime selection via config `web.backend: "searxng" | "tavily" | "auto"` (auto = try local SearXNG first, fall back to configured API)
- Same pattern for `web_extract` — Firecrawl API or Jina Reader

---

### 2.5 Context References (@-refs) (P2, 2 SP)

**Description:** Pre-process user messages for `@path`, `@url`, `@git-diff` patterns and inline the referenced content before it reaches the agent loop. Hermes Agent's `@`-references are a major UX differentiator.

**Expected Benefit:** Users can say "review @src/index.ts" instead of "read the file at src/index.ts first". Reduces tool call overhead for common patterns.

**Effort:** 2 SP

**Success Metric:** Input `"review @packages/core/src/agent.ts"` automatically inlines the file content into the user message before the agent sees it.

**Implementation notes:**
- Add a `resolveRefs(text: string): Promise<string>` function in a new `packages/core/src/refs.ts`
- Called in the CLI's `runAgent` before passing to `agent.run()`
- Patterns: `@<path>` → inline file contents, `@url` → fetch and inline, `@git-diff` → `git diff` output
- Structured format: `[Referenced: src/index.ts]\n\`\`\`\n<content>\n\`\`\``
- Glob support: `@src/**/*.ts` inlines multiple files with headers

---

## 3. Sprint 2 — Core Infrastructure (Week 2)

**Theme:** Add the two P0 features that competitors (OpenCode, Hermes Agent) treat as table stakes.
**Total:** 13 SP | **Target:** v0.3.5

### 3.1 LSP / Code Intelligence (P0, 8 SP)

**Description:** Launch an LSP client as a child process in the agent's context. Expose three tools: `lsp_diagnostics` (current file errors/warnings), `lsp_symbols` (symbols at cursor or in file), `lsp_completions` (context-aware suggestions). Use the Language Server Protocol over stdio.

**Expected Benefit:** The #1 gap vs OpenCode. Without code intelligence, Helix models are blind to types, errors, references, and definitions. Makes Helix credible as a coding agent for non-trivial projects.

**Effort:** 8 SP (heaviest single item)

**Success Metric:** In a TypeScript project with `ts_server` running, `lsp_diagnostics` returns real type errors and `lsp_symbols` returns function signatures from the open file.

**Implementation notes:**
- Create `packages/core/src/lsp.ts` — LSP client manager
- Spawn language server binaries as child processes (e.g., `typescript-language-server`, `pyright`, `rust-analyzer`)
- Cache server instances per project root (reconnect on workspace change)
- Use stdio JSON-RPC for communication (no extra dependencies needed — simple request/response over stdin/stdout)
- Tools expose: `lsp_diagnostics(filePath)` → errors/warnings, `lsp_symbols(filePath)` → definitions/references, `lsp_completions(filePath, line, col)` → suggestions
- Auto-detect project type from `tsconfig.json`/`pyproject.toml`/`Cargo.toml` to pick the right server
- Feature-gated: enabled only when `helix config set features.lsp true`

---

### 3.2 Cron / Scheduled Tasks (P0, 5 SP)

**Description:** Add a `helix cron` subsystem with an SQLite job store. Users can schedule recurring agent tasks: "every morning at 9am, run helix -p 'summarize yesterday's git log'". Jobs run in headless agent sessions. Includes `helix cron add/list/remove` CLI commands.

**Expected Benefit:** The other P0 gap. Recurring automation is what separates an agent from a chatbot. Hermes Agent's cron system is the most mature — Helix needs a lightweight equivalent.

**Effort:** 5 SP

**Success Metric:** `helix cron add --schedule "0 9 * * *" --prompt "check for TODO comments"` persists to SQLite and the job fires at the scheduled time.

**Implementation notes:**
- Create `packages/core/src/cron.ts` — job store + scheduler
- SQLite via `bun:sqlite` (built-in, no extra dependency)
- Table: `CREATE TABLE jobs (id TEXT, schedule TEXT, prompt TEXT, enabled INTEGER, last_run INTEGER)`
- Scheduler process: `helix cron daemon` forks a long-running process that polls every 60s
- Uses same `buildAgent()` engine for headless execution
- `helix cron add/list/remove/daemon` CLI subcommands
- Output is logged to `~/.helix/cron/<job-id>.log`
- Persists across machine restarts via SQLite file

---

## 4. Sprint 3 — Memory & Safety (Week 3)

**Theme:** Make Helix memory competitive and add safety nets. These are P2 gaps that materially affect user trust.
**Total:** 13 SP | **Target:** v0.4.0

### 4.1 Vector Memory / Semantic Search (P2, 5 SP)

**Description:** Augment the JSONL keyword-overlap `recall` with a vector/embeddings backend. Use a local embedding model (via Zen's embedding endpoint or a local ONNX model) to produce embeddings, then cosine-similarity search. The `MemoryStore` interface already supports swapping backends.

**Expected Benefit:** Keyword-only recall misses conceptually related memories. Vector search lets the agent surface "the user prefers tabs over spaces" when asked "what was their indentation preference?" even if neither word appears verbatim.

**Effort:** 5 SP

**Success Metric:** After storing "prefer 2-space indentation for TypeScript", `recall("what indentation style?")` returns the memory even though "indentation" wasn't in the stored text.

**Implementation notes:**
- Implement `VectorMemoryStore implements MemoryStore` in a new `packages/memory/src/vector.ts`
- Use Zen's embedding endpoint (already has API key from provider config) for free embeddings
- Embeddings stored in a simple JSONL sidecar: `memory.embeddings.jsonl` (one `{ id, vector }` per entry)
- Cosine similarity ranking
- Falls back to keyword search when embeddings are unavailable (offline mode)
- New config toggle: `features.vectorMemory: true`
- The clean `MemoryStore` interface means zero changes to the agent loop

---

### 4.2 Checkpoints / Rollback (P2, 5 SP)

**Description:** Before each `write_file` tool call, snapshot the target file's current content to `~/.helix/checkpoints/<project>/<path>.<timestamp>`. Add a `rollback` tool the agent (or user via CLI) can use to undo changes. Also auto-snapshot before the agent loop starts.

**Expected Benefit:** Safety net for destructive operations. Users can recover from bad agent writes without git history manipulation. Matches Hermes Agent's checkpoint/rollback feature.

**Effort:** 5 SP

**Success Metric:** After `write_file` overwrites a file, `helix rollback last` restores the previous content. Agent can call `rollback` tool to undo its own changes.

**Implementation notes:**
- Hook into `write_file` in `packages/core/src/builtins.ts`
- Checkpoint directory: `~/.helix/checkpoints/<project-hash>/<relative-path>/<timestamp>.bak`
- `rollback(path, timestamp?)` tool — restore from checkpoint
- `helix rollback list` — show recent checkpoints
- `helix rollback <path>` — restore specific file
- Prune checkpoints older than 7 days
- Optional git integration: if file is tracked and clean, `git checkout` is faster

---

### 4.3 Durable Sub-agent Completions (P2, 3 SP)

**Description:** Save sub-agent results to disk so they survive a parent process crash. Currently `delegate.ts` writes task/results to a temp dir that's deleted after the parent reads it. Change this to a persistent store in `~/.helix/delegations/`.

**Expected Benefit:** Long-running delegated work (code review, background research) isn't lost if the parent Helix session ends unexpectedly. Sub-agent results are available for offline inspection.

**Effort:** 3 SP

**Success Metric:** Start a `delegate_task` with a 60-second task, kill the parent process mid-wait, re-launch Helix — `helix delegation list` shows the completed sub-agent result.

**Implementation notes:**
- Delegation store: `~/.helix/delegations/<uuid>/` with `input.json`, `result.json`, `meta.json`
- Meta includes: status (pending/running/done), timestamps, model used
- Parent can poll: check if result.json exists instead of blocking on child process
- `helix delegation list/status/show` CLI commands
- Optional: auto-retry timed-out delegations
- Garbage collect delegations older than 7 days

---

## 5. Dependency Graph

```
Sprint 1                Sprint 2              Sprint 3
─────────               ─────────             ─────────
Streaming ──────────────► Cron ───────────────► (none)
  (no deps)               (needs streaming      (no downstream)
                           for job output)

Parallel Delegation ────► LSP ─────────────────► Durable Delegation
  (no deps)               (no deps on            (depends on Parallel
                           streaming/P-delegation) Delegation infra)

Skill Management ───────► (enables agents to     ──► Vector Memory
  (no deps)               auto-create cron jobs)    (no direct dep,
                           (no blocking dep)        but builds on same
                                                     MemoryStore interface)
Multi-backend Web ──────► (independent)
  (no deps)

@-refs ─────────────────► (independent)
  (no deps)
```

Key points:
- **No item blocks another.** All 10 improvements can be built in parallel if needed.
- **Streaming + Parallel Delegation** unblock cron: cron needs streaming for job output, and parallel delegation enables running multiple cron jobs concurrently.
- **Durable Delegation** logically follows Parallel Delegation since they share the delegation infrastructure.
- **Skill Management** enables agents to create their own cron jobs, but isn't a hard dependency.

---

## 6. Total Effort & Timeline

| Sprint | Items | SP | Target Version | Cumulative |
|--------|-------|----|----------------|------------|
| Sprint 1 | 5 quick wins | 10 | v0.3.0 | 10 SP |
| Sprint 2 | 2 core infrastructure | 13 | v0.3.5 | 23 SP |
| Sprint 3 | 3 memory & safety | 13 | v0.4.0 | 36 SP |

**Timeline:** ~3 weeks with one developer. 2 developers could parallelize Sprint 1 items (most have no cross-dependencies) and complete in ~1.5 weeks.

**Risk factors:**
- LSP integration (8 SP) is the riskiest item — language servers vary in quality, protocol complexity, and platform availability
- Cron daemon needs a process supervisor (systemd user service or `pm2`) for production reliability
- Vector memory quality depends on embedding model availability — offline fallback to keyword search is critical

---

## 7. Explicit Non-goals

These features were identified as gaps but explicitly deferred. Rationale:

| Feature | Why Deferred | Possible Future |
|---------|-------------|-----------------|
| **Browser Automation** | Requires Playwright/Puppeteer + headless Chrome — heavy dependency for an early-stage project | Consider MCP-based browser tool instead of native |
| **Vision / Image Processing** | Depends on multimodal model support in provider layer — Zen doesn't offer vision models yet | Add once provider supports image inputs |
| **Voice / TTS** | Not core to coding agent value proposition | MCP plugin or separate skill |
| **Kanban Board** | Full multi-agent orchestration is too much infra for v0.x | Start with simple task queue in v0.5+ |
| **Multi-platform Messaging** | Telegram/Discord gateways are heavy infra | Use webhooks + MCP instead |
| **IDE Extension (VS Code)** | LSP is P0; the extension itself is secondary | Consider ACP protocol first |
| **API Server (OpenAI-compat)** | Adds surface area and auth complexity | Post-v1.0 feature |
| **Image Generation** | Creative use case, not coding agent core | MCP plugin or separate package |
| **Batch Processing** | Training data generation is niche for Helix's audience | Post-v1.0 if demand emerges |

---

## Appendix: Mapping Audit Gaps to Roadmap Items

| Audit Priority | Gap | Roadmap Item | Sprint |
|---------------|-----|-------------|--------|
| P0 | LSP / Code Intelligence | §3.1 LSP Integration | Sprint 2 |
| P0 | Scheduled Tasks (Cron) | §3.2 Cron System | Sprint 2 |
| P1 | Parallel Sub-agent Delegation | §2.2 Parallel Delegation | Sprint 1 |
| P1 | Agent-accessible Skill Management | §2.3 Skill Tools | Sprint 1 |
| P1 | Streaming Agent Output | §2.1 Streaming | Sprint 1 |
| P1 | Browser Automation | Deferred (non-goal) | — |
| P1 | Vision / Image Processing | Deferred (non-goal) | — |
| P2 | Vector Memory | §4.1 Vector Memory | Sprint 3 |
| P2 | Checkpoints / Rollback | §4.2 Checkpoints | Sprint 3 |
| P2 | Context References (@-refs) | §2.5 @-refs | Sprint 1 |
| P2 | Durable Sub-agent Completions | §4.3 Durable Delegation | Sprint 3 |
| P2 | Multi-backend Web Tools | §2.4 Multi-backend Web | Sprint 1 |
| P2 | IDE Integration (VS Code) | Deferred (non-goal) | — |
| P3 | Voice / TTS | Deferred (non-goal) | — |
| P3 | Image Generation | Deferred (non-goal) | — |
| P3 | Kanban Board | Deferred (non-goal) | — |
| P3 | Multi-platform Messaging | Deferred (non-goal) | — |
| P3 | API Server | Deferred (non-goal) | — |
