# Documentation Audit Report

**Date:** 2026-07-24
**Auditor:** writer profile (kanban task t_916eb40c)
**Scope:** All documentation files — README.md, HELIX-ROADMAP.md, HELIX-AUDIT-COMPARISON.md, packages/site/ (16 English docs + 13 Spanish docs + landing page)

---

## Summary

| Category | Issues Found |
|----------|-------------|
| Spanish text in English docs | 2 |
| Informal / conversation remnants | 1 |
| Machine-specific notes leaking into general docs | 2 |
| EN/ES content drift (missing sections) | 4 |
| Outdated / inaccurate statements | 3 |
| Missing sidebar ordering conflicts | 3 |
| Landing page inaccuracies | 2 |
| Missing standard docs (CHANGELOG, CONTRIBUTING) | 2 |
| **Total** | **19** |

---

## 1. Spanish Text in English Docs (HIGH)

These are clear localization leaks — Spanish text in files meant for the English locale.

### `packages/site/src/content/docs/architecture.mdx:15`

```text
core/        ← ÚNICA FUENTE (helix-core)
```

**Fix:** Change to `← SINGLE SOURCE OF TRUTH (helix-core)` or `← SOURCE OF TRUTH (helix-core)`.

### `packages/site/src/content/docs/architecture.mdx:51`

```markdown
Because you said it best: *"una sola fuente para CLI, TUI, web, Dashboard y
Desktop"*.
```

**Fix:** Remove the Spanish quote entirely or translate. This reads like a conversation response, not documentation. Suggested replacement:

```markdown
This is the "single source of truth" design: one package owns the runtime,
and every surface is a thin adapter.
```

---

## 2. Informal / Conversation Remnants (MEDIUM)

### `packages/site/src/content/docs/architecture.mdx:51`

```markdown
Because you said it best: *"una sola fuente para CLI, TUI, web, Dashboard y Desktop"*.
```

This reads like a direct response to someone in a conversation ("you said it best"). Documentation should not reference a specific conversation.

**Fix:** Rewrite as a factual statement about the design rationale without the "you said it best" framing.

---

## 3. Machine-Specific Notes Leaking into General Docs (MEDIUM)

### `packages/site/src/content/docs/web-dashboard.mdx:57-58` (EN)

```markdown
> **Port note:** `:8787` is used by Hermes' local Firecrawl on this machine, so
> Helix web defaults to `:8799`.
```

"This machine" is machine-specific — not relevant to general documentation readers.

**Fix:** Remove the Hermes reference. Just state:

```markdown
> **Port note:** The Dashboard defaults to `:8799`. Override with `PORT=... bun run start`.
```

### `packages/site/src/content/docs/web-dashboard.mdx:65-66` (ES)

```markdown
> **Nota de puerto:** el `:8787` lo usa el Firecrawl local de Hermes en esta
> máquina, así que el dashboard de Helix usa `:8799` por defecto.
```

Same issue in Spanish version.

**Fix:** Same approach — remove the Hermes/machine reference.

---

## 4. EN/ES Content Drift (HIGH)

The Spanish translations have fallen out of sync with the English originals. These are content gaps, not just translation quality issues.

### `packages/site/src/content/docs/cli.mdx` — ES missing flags

The EN version documents these flags that the ES version omits entirely:

| Missing Flag | EN Line |
|-------------|---------|
| `--sandbox` | Line 31 |
| `--json` | Line 32 |
| `--web` | Line 33 |
| `--web-search` | Line 34 |
| `--web-extract` | Line 35 |

**Fix:** Add the missing flag rows to the ES CLI reference table.

### `packages/site/src/content/docs/self-provisioning.mdx` — ES uses `sudo docker`

EN (line 19):
```bash
docker run -d --name helix-searxng ...
```

ES (line 19):
```bash
sudo docker run -d --name helix-searxng ...
```

The ES version also adds a VPS-specific note (lines 25-26) about the default user not being in the `docker` group. This is machine-specific and should not be in general docs.

**Fix:** Align ES with EN — use `docker` (not `sudo docker`) and remove the VPS note.

### `packages/site/src/content/docs/web-dashboard.mdx` — ES has extra Docker section

The ES version (lines 59-63) includes a Docker Compose section that the EN version does not:

```bash
docker compose up     # sirve http://localhost:8799, monta ~/.helix
```

**Fix:** Either add this section to EN too, or remove it from ES. If Docker Compose is a supported deployment method, it should be documented in both languages.

### `packages/site/src/content/docs/eval.mdx` — ES has extra tips section

The ES version (lines 191-200) includes a "Consejos" (Tips) section with 4 bullet points about cost, latency, suite size, and `--scripted`. The EN version has no equivalent.

**Fix:** Add the tips section to the EN version as well.

---

## 5. Outdated / Inaccurate Statements (MEDIUM)

### `packages/site/src/content/docs/index.mdx:19`

```markdown
CLI, future TUI, web UI, Dashboard, Desktop) shares
```

TUI is not "future" — it already exists and is bundled in the CLI binary.

**Fix:** Change to `CLI, TUI, web UI, Dashboard, Desktop`.

### `packages/site/src/content/docs/architecture.mdx:26`

```text
(tui/ web/ desktop/ ← future surfaces, all consume core)
```

TUI is not a future surface — it exists today.

**Fix:** Change to `(tui/ web/ desktop/ ← surfaces, all consume core)` or move `tui/` out of the "future" parenthetical.

### `packages/site/src/pages/index.astro:292`

```html
<span class="badge">~300 LOC engine</span>
```

The landing page feature card for "Native binary" says:
```markdown
Works on macOS, Linux x64/arm64.
```

But the README and install script support Windows x64 as well.

**Fix:** Change to `Works on macOS, Linux x64/arm64, Windows x64.`

---

## 6. Sidebar Ordering Conflicts (LOW)

Multiple pages share `sidebar.order: 1`, which can cause unpredictable sorting:

| File | sidebar.order |
|------|:---:|
| `architecture.mdx` | 1 |
| `mcp.mdx` | 1 |
| `plugins.mdx` | 1 |

**Fix:** Assign unique sequential order values within each sidebar group. The `astro.config.mjs` already defines explicit sidebar structure, so `sidebar.order` in frontmatter is redundant — but if kept, values should be unique.

---

## 7. Landing Page Issues (LOW)

### `packages/site/src/pages/index.astro:74,79-80` — Spanish in English demo

The terminal demo shows a Spanish prompt and Spanish response:

```html
<span class="tname">~ — helix -p "hola quien eres?"</span>
...
<span class="ok">Helix:</span> ¡Hola! Soy Helix, un agente de codificación
```

On the English landing page, this should use English.

**Fix:** Change to an English prompt/response, e.g.:

```html
<span class="tname">~ — helix -p "what can you do?"</span>
...
<span class="ok">Helix:</span> I'm Helix, a minimal coding agent.
I can read/write files, run commands, search the web, and more.
```

---

## 8. Missing Standard Documentation (LOW)

### No CHANGELOG.md

There is no changelog file. The README mentions version badges and releases, but no CHANGELOG tracks what changed between versions.

**Suggestion:** Add a `CHANGELOG.md` at root, or link to GitHub Releases from the README.

### No CONTRIBUTING.md

No contributor guide exists. For an open-source project, this is a standard expectation.

**Suggestion:** Add a `CONTRIBUTING.md` covering setup, dev workflow, PR process.

---

## 9. Root-Level Internal Docs (INFO)

`HELIX-ROADMAP.md` and `HELIX-AUDIT-COMPARISON.md` are internal planning/audit documents sitting at the repo root. They are high-quality and well-structured, but:

- They reference specific version numbers (`v0.2.5 → v0.4.0`) that will go stale
- They contain competitor analysis that may not be appropriate for a public repo README
- They are not linked from the site docs or README

**Suggestion:** Either move to a `docs/internal/` directory or add a note at the top of each saying they are internal planning documents.

---

## 10. README.md Quality (PASS)

The root README is well-structured and comprehensive. Minor notes:

- **Line 167**: Lists specific free model names (`deepseek-v4-flash-free`, etc.) — these will go stale as models rotate. Consider phrasing like "Free models are highlighted with a `-free` suffix" instead of listing specific names.
- **Line 44**: Feature table says "58 Zen models" — this number will change. Consider "50+ Zen models" or removing the count.
- Overall: clean, well-formatted, good use of tables and code blocks. No Spanish text or conversation remnants.

---

## Recommended Priority

| Priority | Fix | Effort |
|:---:|-----|:---:|
| 1 | Spanish text in architecture.mdx (2 instances) | 5 min |
| 2 | Machine-specific notes in web-dashboard.mdx (EN + ES) | 10 min |
| 3 | EN/ES CLI flag drift (add missing flags to ES) | 15 min |
| 4 | Self-provisioning ES docker command alignment | 5 min |
| 5 | Landing page Spanish demo → English | 10 min |
| 6 | "Future TUI" → "TUI" in index.mdx + architecture.mdx | 5 min |
| 7 | Windows support in landing page | 2 min |
| 8 | Add missing tips section to EN eval.mdx | 10 min |
| 9 | Add Docker Compose section to EN web-dashboard.mdx (or remove from ES) | 10 min |
| 10 | Sidebar order conflicts | 5 min |

**Estimated total fix time: ~75 minutes**
