# Documentation Quality Audit — helix-monorepo

Audited: README.md, 3 English docs, 3 Spanish docs, landing page, Astro config.
Date: 2026-07-24

## Issues Found

### 1. Spanish Text in English Docs

**File:** `packages/site/src/content/docs/architecture.mdx`

- **Line 15** — Code block contains Spanish: `← ÚNICA FUENTE (helix-core)`
  - Fix: Change to `← SINGLE SOURCE (helix-core)`
- **Lines 51-53** — Spanish quote: *"una sola fuente para CLI, TUI, web, Dashboard y Desktop"*. Also conversational ("lo dijiste mejor tú").
  - Fix: Translate and remove address. Replace with: *"One core, many surfaces"* — the guiding principle.

### 2. Spanish in English Landing Page

**File:** `packages/site/src/pages/index.astro`

- **Lines 74, 77-79** — Terminal demo uses Spanish prompt (`hola quien eres?`) and Spanish reply on the English landing page.
  - Fix: Use English prompt and reply (e.g. `"What tools do you have?"`).

### 3. Broken Navigation Link

**Files:** `packages/site/src/content/docs/architecture.mdx` (EN line 68, ES line 57)

- Links to `/helix/web-module/` which does not exist in `docs/`. The page is listed in `astro.config.mjs` sidebar but has no `.mdx` file.
  - Fix: Create the missing page, or remove the link.

### 4. Sidebar References 26 Non-Existent Pages

**File:** `packages/site/astro.config.mjs`

Both English and Spanish sidebars reference pages that have no corresponding `.mdx` files:

**English (13 missing):** quickstart, authentication, web-module, self-provisioning, mcp, skills, memory, web-dashboard, plugins, replace-module, write-module, eval, cli

**Spanish (13 missing):** Same pages in `/es/` path.

These render as 404 links on the live site.

### 5. Stale Content in Site Intro

**File:** `packages/site/src/content/docs/index.mdx`

- **Line 17** — "It started as a ~300 LOC engine" is stale; the monorepo now has 9 packages.
- **Line 19** — "future TUI" — TUI already exists and ships.
- **Lines 43-51** — Packages table lists only 5 of 9 packages. Missing: helix-tui, helix-web, helix-mcp, helix-memory (helix-core is listed but only as description, not by name).

### 6. Stale "Future" Labels

**File:** `packages/site/src/content/docs/architecture.mdx`

- **Line 26** — `(tui/ web/ desktop/ ← future surfaces)` — TUI and web already exist.
- **Line 63** — "web / Dashboard / Desktop (future)" — Dashboard exists.

### 7. Inconsistent Package Naming

README uses `helix-cli`, `helix-eval`, `helix-web`, `helix-mcp`, `helix-memory`.
Docs use `helix-agent-cli`, `helix-agent-eval`, and omit several packages.
Needs alignment to a single convention.

### 8. Minor: Quick-Start Context Gap

**File:** `README.md`

- Line 23 — `OPENCODE_ZEN_API_KEY` quickstart doesn't explain where to get the key. Low priority.

## Summary

| # | Severity | Category | Files |
|---|----------|----------|-------|
| 1 | High | Spanish in English docs | architecture.mdx (EN) |
| 2 | High | Spanish in English landing | index.astro |
| 3 | High | Broken link (404) | architecture.mdx (EN+ES) |
| 4 | High | 26 missing sidebar pages | astro.config.mjs |
| 5 | Medium | Stale content | index.mdx |
| 6 | Medium | Stale "future" labels | architecture.mdx |
| 7 | Medium | Inconsistent naming | README vs docs |
| 8 | Low | Missing context | README.md |
