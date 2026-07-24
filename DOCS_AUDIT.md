# Helix Codebase Documentation Audit

**Date:** 2026-07-24
**Scope:** All 9 packages in helix-monorepo (63 TypeScript source files)
**Auditor:** Hermes Writer Agent

---

## Executive Summary

Helix has **strong inline documentation** for a project of its size. Most exported
functions and types have JSDoc comments. The main gaps are:

1. **Per-package README files** — only the root README exists; individual packages lack docs
2. **Usage examples** — public APIs (especially `helix-agent` SDK and `helix-core`)
   have few runnable examples
3. **Type field descriptions** — many interface fields lack JSDoc comments
4. **Private helper documentation** — internal functions often lack any comments

---

## Gap Analysis by Package

### 1. `packages/agent` (helix-agent SDK) — npm:helix-agent

**Status:** Moderate gaps. This is the public SDK — gaps here directly hurt users.

| File | Gap | Severity |
|------|-----|----------|
| `src/index.ts:16-24` | `Tool` type fields (`name`, `description`, `run`, `schema`) lack individual JSDoc | Medium |
| `src/index.ts:26-35` | `LLMProvider` type fields lack JSDoc (only inline comments) | Medium |
| `src/index.ts:37-48` | `AgentOptions` type: `name`, `system`, `llm`, `tools`, `maxSteps` lack JSDoc | Medium |
| `src/index.ts:195-201` | `defineTool()` — no JSDoc explaining what it does or when to use it | High |
| `src/providers.ts:10-13` | `RetryOpts` type — `maxRetries` and `backoffMs` lack JSDoc | Low |
| `src/providers.ts:17-28` | `scriptedLLM()` — no JSDoc explaining the script callback signature | Medium |
| `src/providers.ts:34-119` | `openAIProvider()` — no JSDoc, no usage example | High |
| `src/vercel.ts:21-37` | `VercelProviderOpts` — `tools` field lacks JSDoc | Low |
| `src/vercel.ts:142-160` | `vercelProvider()` — has JSDoc but no usage example in docstring | Medium |
| `src/vercel.ts:184-223` | `vercelToolProvider()` — has JSDoc with example but example uses Zod (not JSON Schema) | Low |
| `src/vercel.ts:246-365` | `vercelStreamingProvider()` — has JSDoc with example | OK |
| `examples/` | Only 2 examples (`hello-agent.ts`, `live-openrouter.ts`). Missing: MCP example, tool definition example, streaming example, custom provider example | High |

### 2. `packages/core` (helix-core) — internal

**Status:** Good overall. Most exports have JSDoc. Gaps in types and helpers.

| File | Gap | Severity |
|------|-----|----------|
| `src/registry.ts:21` | `HelixTool` type alias — no JSDoc | Low |
| `src/registry.ts:47-57` | `ToolRegistry.has()`, `.get()`, `.list()` — no JSDoc | Medium |
| `src/registry.ts:64-86` | `HelixConfig` type fields: `zenBaseUrl`, `hfBaseUrl`, `fallback`, `features`, `web`, `infra` lack JSDoc | Medium |
| `src/registry.ts:88-95` | `defaultConfig` — no JSDoc explaining what it provides | Low |
| `src/registry.ts:101-116` | `HelixPluginContext` — `config` field lacks JSDoc | Low |
| `src/agent.ts:20-30` | `defaultSkillDirs()` — no JSDoc | Medium |
| `src/agent.ts:48-103` | `buildAgent()` — no JSDoc (the most important function in core) | High |
| `src/config.ts:12-13` | `CONFIG_DIR`, `CONFIG_PATH` constants — no JSDoc | Low |
| `src/config.ts:15-22` | `loadConfig()` — no JSDoc | Medium |
| `src/config.ts:24-27` | `saveConfig()` — no JSDoc | Medium |
| `src/auth.ts:29-35` | `helixDir()` — no JSDoc | Medium |
| `src/auth.ts:36-38` | `authPath()` — no JSDoc | Medium |
| `src/auth.ts:98-100` | `fingerprint()` — no JSDoc | Low |
| `src/auth.ts:103-106` | `maskSecret()` — no JSDoc | Low |
| `src/auth.ts:108-111` | `expandHome()` — no JSDoc | Low |
| `src/auth.ts:130-140` | `substitute()` — no JSDoc | Medium |
| `src/web_search.ts:13-55` | `createWebSearchTool()` — no JSDoc | Medium |
| `src/web_extract.ts:14-61` | `createWebExtractTool()` — no JSDoc | Medium |
| `src/builtins.ts:9-11` | `safePath()` — no JSDoc | Low |
| `src/builtins.ts:77-85` | `globToRegex()` — no JSDoc | Low |
| `src/builtins.ts:88-109` | `walkDir()` — no JSDoc | Low |
| `src/skill.ts:38-49` | `parseFrontmatter()` — no JSDoc | Low |
| `src/skill.ts:221-228` | `SkillFromSourceResult` type — no JSDoc | Low |
| `src/checkpoint.ts:27-30` | `stamp()` — no JSDoc | Low |
| `src/checkpoint.ts:32-35` | `safeName()` — no JSDoc | Low |
| `src/delegate.ts:26-36` | `AgentConfig` — `tools` field has JSDoc but `source` lacks it | Low |
| `src/delegate.ts:75-88` | `findHelixBin()` — no JSDoc | Low |
| `src/delegate.ts:111-142` | `runSubtask()` — no JSDoc | Low |
| `src/delegate.ts:144-163` | `buildArgs()` — no JSDoc | Low |
| `src/delegate.ts:165-192` | `readTaskResult()` — no JSDoc | Low |
| `src/delegate.ts:194-243` | `runSubtaskAsync()` — no JSDoc | Low |
| `src/delegate.ts:247-424` | `makeDelegatePlugin()` — no JSDoc | Medium |
| `src/caveman.ts:13-100` | `cavemanCompress()` — no JSDoc | Medium |
| `src/rtk.ts:25-68` | `rtkCompress()` — no JSDoc | Medium |
| `src/refs.ts:41-53` | `expandGlob()` — no JSDoc | Low |
| `src/refs.ts:55-59` | `joinPath()` — no JSDoc | Low |
| `src/refs.ts:62-77` | `readFileContent()` — no JSDoc | Low |
| `src/refs.ts:80-87` | `formatRef()`, `formatError()` — no JSDoc | Low |
| `src/refs.ts:92-118` | `resolveGitDiff()` — no JSDoc | Low |
| `src/refs.ts:120-183` | `resolveUrls()` — no JSDoc | Low |
| `src/refs.ts:185-275` | `resolvePaths()` — no JSDoc | Low |
| `src/web-infra.ts:46-63` | `urlUp()` — no JSDoc | Low |
| `src/web-infra.ts:65-77` | `dockerCmd()` — no JSDoc | Low |
| `src/web-infra.ts:79-81` | `dockerAvailable()` — no JSDoc | Low |
| `src/web-infra.ts:83-129` | `ensureDocker()` — no JSDoc | Low |
| `src/web-infra.ts:131-155` | `ensureExtractServer()` — no JSDoc | Low |
| `src/web-infra.ts:157-162` | `WebInfraStatus` type — no JSDoc | Low |
| `src/zen.ts:14-20` | `ZenModel` — `id` field lacks JSDoc | Low |
| `src/zen.ts:89` | `ZEN_BASE_URL` — no JSDoc | Low |
| `src/zen.ts:92-94` | `isFreeModel()` — no JSDoc | Low |

### 3. `packages/cli` (helix-agent-cli) — binary

**Status:** Good. CLI help is thorough. Minor internal gaps.

| File | Gap | Severity |
|------|-----|----------|
| `cli.ts:40-100` | `printHelp()` — comprehensive but no JSDoc | Low |
| `cli.ts:102-121` | `promptHidden()` — no JSDoc | Low |
| `cli.ts:123-184` | `handleAuth()` — no JSDoc | Low |
| `cli.ts:186-235` | `handleModels()` — no JSDoc | Low |
| `cli.ts:237-247` | `printConfig()` — no JSDoc | Low |
| `cli.ts:254-275` | `getCliVersion()` — no JSDoc | Low |
| `cli.ts:283-314` | `printStatus()` — no JSDoc | Low |
| `cli.ts:316-334` | `statusWebInfra()` — no JSDoc | Low |
| `cli.ts:336-434` | `runDashboard()` — no JSDoc | Low |
| `cli.ts:436-450` | `runTui()` — no JSDoc | Low |
| `cli.ts:452-501` | `runDoctor()` — no JSDoc | Low |
| `src/args.ts:4-43` | `CliOpts` interface — fields lack JSDoc | Medium |
| `src/args.ts:45-140` | `parseArgs()` — no JSDoc | Medium |
| `src/history.ts` | Not read — may have gaps | Unknown |
| `src/update.ts` | Not read — may have gaps | Unknown |
| `src/eval.ts` | Not read — may have gaps | Unknown |
| `src/config.ts` | Not read — may have gaps | Unknown |
| `src/provider.ts` | Not read — may have gaps | Unknown |

### 4. `packages/memory` (helix-memory) — internal

**Status:** Good. Well-documented types and interfaces.

| File | Gap | Severity |
|------|-----|----------|
| `src/index.ts:58-59` | `MEMORY_DIR`, `MEMORY_PATH` — no JSDoc | Low |
| `src/index.ts:69-83` | `readAll()` — no JSDoc | Low |
| `src/index.ts:85-88` | `writeAll()` — no JSDoc | Low |
| `src/index.ts:90-93` | `dirname()` — no JSDoc | Low |
| `src/index.ts:95-99` | `remember()` — no JSDoc (implements interface) | Low |
| `src/index.ts:102-118` | `recall()` — no JSDoc (implements interface) | Low |
| `src/index.ts:121-126` | `reflect()` — no JSDoc (implements interface) | Low |
| `src/index.ts:128-129` | `list()` — no JSDoc (implements interface) | Low |
| `src/index.ts:132-135` | `clear()` — no JSDoc (implements interface) | Low |
| `src/index.ts:205-208` | `readSoul()` — has JSDoc but no usage example | Low |

### 5. `packages/mcp` (helix-mcp) — internal

**Status:** Good. Well-documented with clear architecture comments.

| File | Gap | Severity |
|------|-----|----------|
| `src/index.ts:18-37` | `McpServerConfig` union type — no JSDoc on individual variants | Low |
| `src/index.ts:39-42` | `McpConfig` type — no JSDoc | Low |
| `src/index.ts:44-61` | `createTransport()` — no JSDoc | Low |
| `src/index.ts:63-70` | `connectServer()` — no JSDoc | Low |

### 6. `packages/eval` (helix-eval) — internal

**Status:** Good. Types and functions have JSDoc.

| File | Gap | Severity |
|------|-----|----------|
| `src/index.ts:8-13` | `ScoreContext` — `input`, `output`, `expected` fields lack JSDoc | Low |
| `src/index.ts:18-26` | `CaseResult` — fields lack JSDoc | Low |
| `src/index.ts:28-37` | `EvalCase` — `costPer1kPrompt`, `costPer1kCompletion` fields lack JSDoc | Low |
| `src/index.ts:39-46` | `EvalReport` — fields lack JSDoc | Low |
| `src/index.ts:49-51` | `defaultScore()` — no JSDoc | Low |
| `src/index.ts:53-56` | `estimateTokens()` — no JSDoc | Low |
| `src/index.ts:58-98` | `runEval()` — no JSDoc | Medium |
| `src/index.ts:104-124` | `CompareReport` — fields lack JSDoc | Low |
| `src/index.ts:131-185` | `compareEval()` — no JSDoc | Medium |
| `src/index.ts:198-226` | `makeLlmJudge()` — has JSDoc | OK |

### 7. `packages/web` (helix-web) — internal

**Status:** Minimal. Dashboard server API routes undocumented.

| File | Gap | Severity |
|------|-----|----------|
| `src/api.ts:2-9` | `api()` — no JSDoc | Medium |
| `server/index.ts:29-36` | `resolveRoot()` — no JSDoc | Low |
| `server/index.ts:39-50` | `mcpConfig()`, `saveMcpConfig()` — no JSDoc | Low |
| `server/index.ts:52-204` | API routes — no JSDoc explaining request/response shapes | High |
| `server/index.ts:116-140` | `getAgent()` — no JSDoc | Low |
| `server/index.ts:209-213` | `startDashboard()` — no JSDoc | Medium |

### 8. `packages/tui` (helix-tui) — bundled

**Status:** Not audited (TUI source not read in this pass).

### 9. `packages/site` (helix-site) — Astro docs

**Status:** Not audited (docs site content not read in this pass).

---

## Missing Usage Examples

These public APIs lack runnable examples in their JSDoc or README:

| API | File | Priority |
|-----|------|----------|
| `Agent` constructor + `run()` | `packages/agent/src/index.ts` | **Critical** — only 1 basic example in README |
| `defineTool()` | `packages/agent/src/index.ts` | **High** — no example of creating a custom tool |
| `scriptedLLM()` | `packages/agent/src/providers.ts` | Medium — used in tests but no doc example |
| `openAIProvider()` | `packages/agent/src/providers.ts` | **High** — main provider, no example |
| `vercelProvider()` | `packages/agent/src/vercel.ts` | Medium — has example but could be clearer |
| `vercelStreamingProvider()` | `packages/agent/src/vercel.ts` | Medium — has example |
| `buildAgent()` | `packages/core/src/agent.ts` | **Critical** — the core builder, zero examples |
| `makeProviderRouter()` | `packages/core/src/router.ts` | **High** — has usage comment but no runnable example |
| `makeCavemanPlugin()` | `packages/core/src/caveman.ts` | Medium — has usage comment |
| `makeRtkPlugin()` | `packages/core/src/rtk.ts` | Medium — has usage comment |
| `makeDelegatePlugin()` | `packages/core/src/delegate.ts` | Medium — complex feature, needs examples |
| `discoverSkills()` | `packages/core/src/skill.ts` | Medium — has JSDoc but no example |
| `createSkillFromSource()` | `packages/core/src/skill.ts` | Medium — used by `helix learn` |
| `resolveRefs()` | `packages/core/src/refs.ts` | Medium — power feature, no example |
| `runEval()` / `compareEval()` | `packages/eval/src/index.ts` | Medium — CLI has examples but SDK doesn't |
| `makeLlmJudge()` | `packages/eval/src/index.ts` | Medium — has JSDoc but no example |
| `makeMcpPlugin()` | `packages/mcp/src/index.ts` | Medium — has README example |
| `JsonlMemoryStore` | `packages/memory/src/index.ts` | Low — internal but useful for extenders |
| `makeMemoryTools()` | `packages/memory/src/index.ts` | Low — internal |

---

## Missing Per-Package Documentation

| Package | Has README? | Has CHANGELOG? | Has API docs? |
|---------|-------------|----------------|---------------|
| helix (root) | Yes | No | Partial (README) |
| helix-agent | No | No | No |
| helix-core | No | No | No |
| helix-cli | No | No | No |
| helix-tui | No | No | No |
| helix-web | No | No | No |
| helix-mcp | No | No | No |
| helix-eval | No | No | No |
| helix-memory | No | No | No |
| helix-site | N/A (is the docs) | N/A | N/A |

---

## Recommendations (Priority Order)

1. **Create `packages/agent/README.md`** — This is the npm-published SDK. It needs:
   - Installation instructions
   - Quick start example (30 seconds to first tool call)
   - API reference table (Agent, Tool, LLMProvider, defineTool)
   - Provider examples (OpenAI, Anthropic, Vercel, custom)
   - Streaming example
   - MCP integration example

2. **Add JSDoc to `buildAgent()`** in `packages/core/src/agent.ts` — This is the
   most important function in the codebase. It should have a full docstring with
   parameter descriptions and a usage example.

3. **Add JSDoc to `defineTool()`** in `packages/agent/src/index.ts` — The primary
   way users create tools.

4. **Add JSDoc to `openAIProvider()`** in `packages/agent/src/providers.ts` — The
   most commonly used provider.

5. **Create examples directory** in `packages/agent/examples/` with:
   - `basic-tool.ts` — defineTool + Agent
   - `streaming.ts` — streaming responses
   - `mcp-integration.ts` — MCP plugin usage
   - `custom-provider.ts` — implementing LLMProvider
   - `memory.ts` — using memory tools

6. **Add JSDoc to `HelixConfig` fields** in `packages/core/src/registry.ts` — Users
   need to know what each config field does.

7. **Document Dashboard API routes** in `packages/web/server/index.ts` — Each route
   should document its request/response shape.

8. **Add JSDoc to `CliOpts` fields** in `packages/cli/src/args.ts` — Helps
   contributors understand what each flag does.

---

## What's Already Good

- **Root README** is comprehensive with architecture diagram, feature matrix, and examples
- **Inline comments** in most files explain the "why" not just the "what"
- **Type definitions** are well-structured with clear field names
- **Core registry** (`registry.ts`) has the best documentation in the codebase
- **Skill system** (`skill.ts`) has thorough JSDoc on all public functions
- **Checkpoint system** (`checkpoint.ts`) has complete JSDoc on all public functions
- **Auth system** (`auth.ts`) has thorough documentation including security design rationale
- **Router** (`router.ts`) has usage example in comments
- **Delegate plugin** (`delegate.ts`) has detailed tool description with examples

---

*Generated by helix documentation audit — 2026-07-24*
