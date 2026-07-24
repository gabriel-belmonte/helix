# Landing Page Audit — `packages/site/src/pages/index.astro`

Audit date: 2026-07-24
Auditor: writer profile

---

## Issues Found

### 1. Spanish text in terminal demo (conversation remnant)

**File:** `packages/site/src/pages/index.astro`
**Lines:** 74, 77–81

The terminal demo uses a Spanish prompt and Spanish response:

```
~ — helix -p "hola quien eres?"
$ helix -p "hola quien eres?"
Helix: ¡Hola! Soy Helix, un agente de codificación
minimalista. Estoy aquí para ayudarte con tareas
de software.
```

**Problem:** The landing page is in English. A Spanish demo feels like a
conversation remnant or a language leak — visitors unfamiliar with Spanish
won't understand the example, and it breaks the consistent English tone.

**Suggested fix:** Replace with an English prompt/response, e.g.:

```
$ helix -p "What's the weather in Madrid?"
Helix: Let me check that for you.
```

This also better showcases tool-calling (the page's main selling point).

---

### 2. Informal tone in sponsor section

**File:** `packages/site/src/pages/index.astro`
**Line:** 314

> "throw a few euros at the work"

**Problem:** Too casual for a public-facing landing page. Reads like a
personal message, not a product pitch.

**Suggested fix:** "consider sponsoring the work" or "support continued
development"

---

### 3. Informal tier name

**File:** `packages/site/src/pages/index.astro`
**Lines:** 320–321

The €7/mo tier is named **"the saints"**.

**Problem:** While charming, "the saints" is informal and may confuse
international visitors. Sponsor tier names should be clear about value.

**Suggested fix:** Rename to "supporters" or "backers" — standard OSS
sponsorship terminology.

---

### 4. Inconsistent nav ↔ section order

**File:** `packages/site/src/pages/index.astro`
**Lines:** 33–34 (nav), 91 and 172 (sections)

Nav order: `why → ecosystem → code → features`
Section render order: `ecosystem (01) → why (02) → code (03) → features (04)`

**Problem:** Clicking "why" in the nav scrolls to section 02, but visually
ecosystem appears first. The nav promises a different reading order than
what's rendered.

**Suggested fix:** Reorder nav to match section order:
`ecosystem → why → code → features`, or reorder the sections to match
the nav.

---

### 5. Stale hardcoded version string

**File:** `packages/site/src/pages/index.astro`
**Line:** 347 (footer)

```
helix — MIT © gabriel-belmonte
```

Also in `packages/web/src/App.tsx` line 44:
```
helix-web · v0.1.0
```

**Problem:** Version `v0.1.0` is hardcoded and will go stale. The landing
page footer doesn't show a version, but the dashboard does — and neither
is wired to `package.json`.

**Suggested fix:** For the landing page, either remove the version or
inject it at build time from `package.json`. For the dashboard, use
`import.meta.env` or a build-time constant.

---

### 6. Missing "Getting Started" / install section

**File:** `packages/site/src/pages/index.astro`

**Problem:** The landing page jumps from hero → ecosystem → why → code →
features → sponsor, but has no quickstart or install instructions.
The hero CTA links to a GitHub tree URL, not an install command. A
visitor has to hunt for how to actually install helix.

**Suggested fix:** Add a "Quick Start" section (between features and
sponsor) with the actual install command:

```bash
curl -fsSL https://get.helix.dev | sh
```

Or at minimum, change the hero CTA to copy-pasteable install command
instead of a GitHub link.

---

### 7. "skills.sh compatible" badge lacks context

**File:** `packages/site/src/pages/index.astro`
**Line:** 66

Badge says `skills.sh compatible` but the ecosystem section (line 162)
only briefly mentions it. Most visitors won't know what skills.sh is.

**Suggested fix:** Either expand the badge to "skills.sh compatible —
install any published skill" or link the badge to the skills docs page.

---

### 8. Package count mismatch between landing page and docs

**File:** `packages/site/src/pages/index.astro` (ecosystem section)
vs. `packages/site/src/content/docs/index.mdx` (packages table)

- Landing page ecosystem: 7 items (core, agent, cli, eval, tui, mcp, skills)
- Docs intro packages table: 5 rows (agent, core, cli, eval, site)

**Problem:** `helix-tui`, `helix-mcp`, and "Skills" appear on the landing
page but not in the docs packages table. `helix-site` appears in docs
but not on the landing page.

**Suggested fix:** Reconcile — either add tui/mcp/skills to the docs
table, or clarify that the landing page shows the broader ecosystem
while the docs table shows publishable npm packages.

---

### 9. Code example uses Madrid (minor)

**File:** `packages/site/src/pages/index.astro`
**Line:** 20

```typescript
const reply = await agent.run("Weather in Madrid?");
```

**Problem:** Combined with the Spanish terminal demo, "Madrid" reinforces
a locale-specific feel. Not a bug, but slightly inconsistent with the
"for devs everywhere" footer.

**Suggested fix:** Use a neutral city like "London" or "Tokyo", or keep
Madrid but remove the Spanish demo to avoid doubling down on locale.

---

### 10. Missing `rel="noopener noreferrer"` on external links

**File:** `packages/site/src/pages/index.astro`
**Lines:** 38, 106, 115, 125, 134, 335, 338

External links to GitHub, skills.sh, Ko-fi lack `rel="noopener noreferrer"`.

**Problem:** Security best practice — prevents the opened page from
accessing `window.opener`.

**Suggested fix:** Add `rel="noopener noreferrer"` to all external `<a>`
tags.

---

### 11. No Open Graph / social sharing metadata

**File:** `packages/site/src/layouts/Layout.astro`

**Problem:** The layout has `<meta name="description">` but no OG tags
(`og:title`, `og:description`, `og:image`, `twitter:card`). Sharing the
landing page on social media will produce a generic preview.

**Suggested fix:** Add OG meta tags to `Layout.astro`:

```html
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content="/helix/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

---

### 12. Favicon path assumes `/helix/` base

**File:** `packages/site/src/layouts/Layout.astro`
**Line:** 21

```html
<link rel="icon" href="/helix/favicon.svg" />
```

**Problem:** Hardcodes the `/helix/` base path. If deployed at a
different path (or root), the favicon breaks.

**Suggested fix:** Use `import.meta.env.BASE_URL` or a config constant:

```html
<link rel="icon" href={`${import.meta.env.BASE_URL}favicon.svg`} />
```

---

## Summary

| # | Severity | Category | Line(s) | Issue |
|---|----------|----------|---------|-------|
| 1 | **High** | Spanish text / remnant | 74, 77–81 | Spanish in terminal demo |
| 2 | **Medium** | Informal tone | 314 | "throw a few euros" |
| 3 | **Low** | Informal tone | 320 | "the saints" tier name |
| 4 | **Medium** | Inconsistency | 33–34, 91, 172 | Nav order ≠ section order |
| 5 | **Low** | Staleness | 44 (App.tsx) | Hardcoded v0.1.0 |
| 6 | **Medium** | Missing section | — | No quickstart / install section |
| 7 | **Low** | Missing context | 66 | skills.sh badge unexplained |
| 8 | **Medium** | Inconsistency | — | Package count mismatch |
| 9 | **Low** | Tone | 20 | Madrid + Spanish demo = locale-heavy |
| 10 | **Low** | Security | 38, 106+ | Missing rel=noopener noreferrer |
| 11 | **Medium** | Missing feature | Layout.astro | No OG/social metadata |
| 12 | **Low** | Portability | Layout.astro:21 | Favicon path hardcoded |

**High:** 1 | **Medium:** 4 | **Low:** 7 | **Total:** 12 issues
