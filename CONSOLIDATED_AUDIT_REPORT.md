# Helix Documentation — Consolidated Audit Report

**Date:** 2026-07-24
**Sources:** README/docs quality audit (t_4b79912f), landing page audit (t_6757d1c8)
**Auditor:** writer profile

---

## Executive Summary

Combined audits of the README, docs site (16 EN + 13 ES pages), Astro config, and landing page found **20 unique issues** across 10 files. The most critical are Spanish text leaking into English pages and 26 sidebar entries pointing to non-existent pages. Estimated total fix time: ~90 minutes.

| Severity | Count |
|----------|:-----:|
| **High** | 5 |
| **Medium** | 8 |
| **Low** | 7 |
| **Total** | **20** |

---

## Issue Index

| # | Sev | Category | File(s) | Summary |
|---|-----|----------|---------|---------|
| 1 | **High** | Localization | architecture.mdx (EN) | Spanish text in English docs |
| 2 | **High** | Localization | index.astro | Spanish text in English landing page |
| 3 | **High** | Broken link | architecture.mdx (EN+ES) | Nav link points to non-existent page |
| 4 | **High** | Missing pages | astro.config.mjs | 26 sidebar entries reference missing .mdx files |
| 5 | **High** | Inconsistency | README vs docs | Package naming mismatch (helix-cli vs helix-agent-cli) |
| 6 | **Medium** | Staleness | index.mdx | Site intro has outdated LOC count and "future TUI" label |
| 7 | **Medium** | Staleness | architecture.mdx | TUI/Web/Dashboard marked as "future" but already ship |
| 8 | **Medium** | Tone | index.astro:314 | "throw a few euros" too informal for public page |
| 9 | **Medium** | Inconsistency | index.astro:33-34, 91, 172 | Nav order doesn't match section render order |
| 10 | **Medium** | Missing section | index.astro | No quickstart / install section on landing page |
| 11 | **Medium** | Inconsistency | index.astro vs index.mdx | Package count mismatch (7 on landing, 5 in docs) |
| 12 | **Medium** | Missing feature | Layout.astro | No Open Graph / social sharing metadata |
| 13 | **Medium** | Tone | index.astro:320 | "the saints" tier name too informal |
| 14 | **Low** | Missing context | README.md:23 | OPENCODE_ZEN_API_KEY quickstart doesn't explain where to get the key |
| 15 | **Low** | Staleness | index.astro:347, web App.tsx:44 | Hardcoded v0.1.0 version string |
| 16 | **Low** | Missing context | index.astro:66 | "skills.sh compatible" badge lacks explanation |
| 17 | **Low** | Tone | index.astro:20 | Madrid reference doubles down on locale alongside Spanish demo |
| 18 | **Low** | Security | index.astro (multiple) | Missing rel="noopener noreferrer" on external links |
| 19 | **Low** | Portability | Layout.astro:21 | Hardcoded /helix/ base path in favicon href |
| 20 | **Low** | Ordering | architecture.mdx, mcp.mdx, plugins.mdx | Multiple pages share sidebar.order: 1 |

---

## Detailed Findings

### HIGH — Must Fix

#### 1. Spanish Text in English Docs

**File:** `packages/site/src/content/docs/architecture.mdx`

| Line | Issue | Fix |
|------|-------|-----|
| 15 | Code block contains `← ÚNICA FUENTE (helix-core)` | → `← SINGLE SOURCE (helix-core)` |
| 51–53 | Spanish quote: *"una sola fuente para CLI, TUI, web, Dashboard y Desktop"* + conversational "lo dijiste mejor tú" | → *"One core, many surfaces"* — the guiding principle |

#### 2. Spanish Text in English Landing Page

**File:** `packages/site/src/pages/index.astro` — Lines 74, 77–81

Terminal demo uses a Spanish prompt and Spanish response:

```
~ — helix -p "hola quien eres?"
$ helix -p "hola quien eres?"
Helix: ¡Hola! Soy Helix, un agente de codificación
minimalista. Estoy aquí para ayudarte con tareas de software.
```

**Fix:** Replace with English prompt/response, e.g.:

```
$ helix -p "What's the weather in Madrid?"
Helix: Let me check that for you.
```

This also better showcases tool-calling (the page's main selling point).

#### 3. Broken Navigation Link

**File:** `packages/site/src/content/docs/architecture.mdx` (EN line 68, ES line 57)

Links to `/helix/web-module/` which has no corresponding `.mdx` file. The page is listed in the sidebar config but never created. Renders as a 404.

**Fix:** Create the missing page, or remove the link.

#### 4. Sidebar References 26 Non-Existent Pages

**File:** `packages/site/astro.config.mjs`

Both English and Spanish sidebars reference pages with no corresponding `.mdx` files:

- **English (13 missing):** quickstart, authentication, web-module, self-provisioning, mcp, skills, memory, web-dashboard, plugins, replace-module, write-module, eval, cli
- **Spanish (13 missing):** Same pages under `/es/` path

All 26 render as 404 links on the live site.

**Fix:** Either create all missing pages, or remove the sidebar entries until pages exist.

#### 5. Inconsistent Package Naming

README uses `helix-cli`, `helix-eval`, `helix-web`, `helix-mcp`, `helix-memory`.
Docs use `helix-agent-cli`, `helix-agent-eval`, and omit several packages.

**Fix:** Align to a single naming convention across all docs.

---

### MEDIUM — Should Fix

#### 6. Stale Content in Site Intro

**File:** `packages/site/src/content/docs/index.mdx`

| Line | Issue | Fix |
|------|-------|-----|
| 17 | "It started as a ~300 LOC engine" — stale, monorepo has 9 packages | Update LOC count or remove |
| 19 | "future TUI" — TUI already exists and ships | → "CLI, TUI, web UI, Dashboard, Desktop" |
| 43–51 | Packages table lists only 5 of 9 packages (missing helix-tui, helix-web, helix-mcp, helix-memory) | Add all 9 packages |

#### 7. Stale "Future" Labels

**File:** `packages/site/src/content/docs/architecture.mdx`

| Line | Issue | Fix |
|------|-------|-----|
| 26 | `(tui/ web/ desktop/ ← future surfaces)` — TUI and web exist | Remove "future" or restructure |
| 63 | "web / Dashboard / Desktop (future)" — Dashboard exists | Remove "(future)" |

#### 8. Informal Tone in Sponsor Section

**File:** `packages/site/src/pages/index.astro`

| Line | Issue | Fix |
|------|-------|-----|
| 314 | "throw a few euros at the work" — too casual for a public page | → "consider sponsoring the work" or "support continued development" |
| 320 | €7/mo tier named "the saints" — informal, may confuse international visitors | → "Supporters" or "Backers" |

#### 9. Inconsistent Nav ↔ Section Order

**File:** `packages/site/src/pages/index.astro`

Nav order (lines 33–34): `why → ecosystem → code → features`
Section render order: `ecosystem (01) → why (02) → code (03) → features (04)`

Clicking "why" in the nav scrolls to section 02, but ecosystem appears first visually.

**Fix:** Reorder nav to match section order: `ecosystem → why → code → features`, or reorder sections to match nav.

#### 10. Missing Quickstart / Install Section

**File:** `packages/site/src/pages/index.astro`

The landing page jumps from hero → ecosystem → why → code → features → sponsor with no install instructions. The hero CTA links to a GitHub tree URL, not an install command.

**Fix:** Add a "Quick Start" section between features and sponsor with the actual install command:

```bash
curl -fsSL https://get.helix.dev | sh
```

Or change the hero CTA to a copy-pasteable install command.

#### 11. Package Count Mismatch

**File:** `packages/site/src/pages/index.astro` (ecosystem section) vs. `packages/site/src/content/docs/index.mdx` (packages table)

- Landing page ecosystem: 7 items (core, agent, cli, eval, tui, mcp, skills)
- Docs intro packages table: 5 rows (agent, core, cli, eval, site)

`helix-tui`, `helix-mcp`, and "Skills" appear on the landing page but not in the docs table. `helix-site` appears in docs but not on the landing page.

**Fix:** Reconcile — either add tui/mcp/skills to the docs table, or clarify the distinction.

#### 12. No Open Graph / Social Sharing Metadata

**File:** `packages/site/src/layouts/Layout.astro`

Has `<meta name="description">` but no OG tags (`og:title`, `og:description`, `og:image`, `twitter:card`). Sharing on social media produces a generic preview.

**Fix:** Add OG meta tags:

```html
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content="/helix/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

---

### LOW — Nice to Fix

#### 13. Missing Context in README Quickstart

**File:** `README.md` line 23

`OPENCODE_ZEN_API_KEY` quickstart doesn't explain where to get the key.

**Fix:** Add a link to the docs or a brief explanation.

#### 14. Hardcoded Version String

**Files:** `packages/site/src/pages/index.astro` line 347, `packages/web/src/App.tsx` line 44

Version `v0.1.0` is hardcoded and will go stale. The landing page footer doesn't show a version, but the dashboard does — neither is wired to `package.json`.

**Fix:** Inject version at build time from `package.json` or use `import.meta.env`.

#### 15. "skills.sh Compatible" Badge Lacks Context

**File:** `packages/site/src/pages/index.astro` line 66

Badge says `skills.sh compatible` but most visitors won't know what skills.sh is.

**Fix:** Expand to "skills.sh compatible — install any published skill" or link to the skills docs page.

#### 16. Madrid Reference Doubles Down on Locale

**File:** `packages/site/src/pages/index.astro` line 20

```typescript
const reply = await agent.run("Weather in Madrid?");
```

Combined with the Spanish terminal demo, "Madrid" reinforces a locale-specific feel.

**Fix:** Use a neutral city like "London" or "Tokyo", or keep Madrid but remove the Spanish demo.

#### 17. Missing rel="noopener noreferrer" on External Links

**File:** `packages/site/src/pages/index.astro` lines 38, 106, 115, 125, 134, 335, 338

External links to GitHub, skills.sh, Ko-fi lack `rel="noopener noreferrer"`.

**Fix:** Add `rel="noopener noreferrer"` to all external `<a>` tags.

#### 18. Favicon Path Assumes /helix/ Base

**File:** `packages/site/src/layouts/Layout.astro` line 21

```html
<link rel="icon" href="/helix/favicon.svg" />
```

Hardcodes the `/helix/` base path. If deployed at a different path, the favicon breaks.

**Fix:** Use `import.meta.env.BASE_URL`:

```html
<link rel="icon" href={`${import.meta.env.BASE_URL}favicon.svg`} />
```

#### 19. Sidebar Ordering Conflicts

**Files:** `architecture.mdx`, `mcp.mdx`, `plugins.mdx` — all have `sidebar.order: 1`

Multiple pages sharing the same order value causes unpredictable sorting.

**Fix:** Assign unique sequential order values, or remove the redundant `sidebar.order` frontmatter since `astro.config.mjs` already defines explicit sidebar structure.

---

## Recommended Fix Order

| # | Fix | Effort |
|---|-----|:------:|
| 1 | Spanish text in architecture.mdx (2 instances) | 5 min |
| 2 | Spanish text in index.astro terminal demo | 10 min |
| 3 | Remove 26 broken sidebar entries from astro.config.mjs | 10 min |
| 4 | Create or remove broken /helix/web-module/ link | 5 min |
| 5 | Align package naming across README and docs | 10 min |
| 6 | Update stale content in index.mdx (LOC, TUI, packages table) | 10 min |
| 7 | Remove stale "future" labels in architecture.mdx | 5 min |
| 8 | Fix informal tone in landing page sponsor section | 5 min |
| 9 | Reorder nav to match section order | 5 min |
| 10 | Add quickstart section to landing page | 10 min |
| 11 | Reconcile package counts (landing vs docs) | 5 min |
| 12 | Add OG meta tags to Layout.astro | 10 min |

**Estimated total: ~90 minutes**

---

*Consolidated from: DOCS_QUALITY_AUDIT.md (t_4b79912f) + LANDING_PAGE_AUDIT.md (t_6757d1c8)*
