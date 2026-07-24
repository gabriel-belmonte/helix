# Continuous Improvement — Monitoring & Triage

> **Never-ending triage mission.** This document defines the automated monitoring,
> dashboard, and triage loop that keeps Helix healthy, competitive, and
> continuously improving.

---

## 1. Philosophy

Continuous improvement isn't a project with a due date — it's a **living process**
that runs on a cadence. Every component below is designed to run unattended and
surface actionable issues as tasks on the kanban board. The loop never stops.

**The cycle:**

```
Collect metrics → Detect regressions → File triage tasks → Fix → Verify → Repeat
```

---

## 2. Monitored Dimensions

### 2.1 Code Quality & Pipeline Health

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| CI pass rate | GitHub Actions | < 90% over last 7 days |
| Build time | GitHub Actions | > 3 min (p95) |
| Test pass rate | `bunx turbo run test` | Any failure |
| Bundle size (CLI binary) | Release workflow | > 50 MB |
| TypeScript strict errors | `tsc --noEmit` | Any new error |

### 2.2 Community & Adoption

| Metric | Source | Check Cadence |
|--------|--------|---------------|
| GitHub stars | GitHub API | Daily |
| npm downloads (weekly) | npm API | Weekly |
| Open issues / PRs | GitHub API | Daily |
| Issue response time | GitHub API | Weekly (p50) |
| Fork count | GitHub API | Weekly |

### 2.3 Model & Eval Quality

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Eval suite pass rate | `helix eval` | Regression > 5% |
| Zen free model availability | OpenCode Zen API | Any 503 |
| Provider latency (p95) | `helix status --latency` | > 5 s |
| Tool call success rate | Agent telemetry | < 95% |

### 2.4 Competitor Landscape

| What to Watch | Where | Cadence |
|---------------|-------|---------|
| New AI coding tool releases | GitHub trending / HN | Weekly |
| Pricing changes | Provider pricing pages | Monthly |
| Feature gaps opened/closed | Product comparison | Monthly |

---

## 3. Monitoring Infrastructure

### 3.1 Dashboard (Web, built-in)

The Helix web dashboard includes a **Monitor** tab (available at
`/api/monitor` → React UI) that renders all KPIs on a single page:

- **Status cards** — CI health, npm downloads, GitHub stars in a glance
- **Trend chart** — key metrics over the last 30 days (stored as JSONL)
- **Alert log** — recent threshold crossings
- **Eval run log** — latest eval suite results

Access with: `helix dashboard` → click **Monitor** in the sidebar.

### 3.2 Metrics Collector Script

`scripts/monitor-metrics.sh` (described below) is a standalone shell script that:

1. Queries the GitHub API for stars, forks, open issues/PRs
2. Queries the npm registry for weekly download counts
3. Runs a quick `helix eval` to capture current eval status
4. Outputs JSONL to `~/.helix/monitor/metrics.jsonl`

Run it manually: `bash scripts/monitor-metrics.sh`

Or let the cron job run it (see §5).

### 3.3 Cron-Based Monitoring

Three cron jobs run on the Hermes infrastructure:

| Job | Schedule | What It Does |
|-----|----------|-------------|
| `monitor-metrics` | Daily (06:00 UTC) | Collects GitHub/npm/eval metrics → JSONL |
| `monitor-triage` | Weekly (Mon 09:00 UTC) | Reviews metrics, files triage tasks for regressions |
| `monitor-competitors` | Weekly (Wed 14:00 UTC) | Scans GitHub trending / HN for new AI coding tools |

Each job writes structured data to `~/.helix/monitor/` and uses kanban tasks
for any actionable follow-up.

---

## 4. Triage Process

When a metric crosses its alert threshold, the following process runs:

### 4.1 Detection

1. The `monitor-metrics` cron collects all KPIs
2. The `monitor-triage` cron compares each KPI against its threshold
3. Any threshold breach → a structured kanban task is created with:
   - **Title:** `Triage: <metric name> — <value> vs threshold <threshold>`
   - **Body:** metric value, trend data, link to dashboard
   - **Priority:** based on severity (CI failure = high, stars flat = low)
   - **Assignee:** `default` (the agent that picks up triage tasks)

### 4.2 Classification

Each triage task is classified into one of:

| Class | Action | Response SLA |
|-------|--------|-------------|
| **🔴 Critical** | CI broken, release blocked | Fix within 24h |
| **🟡 Warning** | Metric degrading, no immediate breakage | Investigate within 72h |
| **🟢 Info** | Trend to watch, no action needed | Log and monitor |
| **📊 Eval regression** | Model quality dropped | Re-run eval, compare judges |

### 4.3 Remediation

1. **Critical:** The agent drops everything, investigates root cause, and files a
   fix PR. The task stays open until CI passes again.
2. **Warning:** The agent performs a deeper investigation, documents findings,
   and may create a follow-up task for a targeted fix in the next sprint.
3. **Info:** Logged to `~/.helix/monitor/observations.md` for the weekly review.
4. **Eval regression:** A full eval suite is triggered and compared against the
   previous baseline. If confirmed, a fix task is created.

### 4.4 Weekly Review

Every Monday at 09:00 UTC, the `monitor-triage` cron generates a **weekly
health report** that includes:

- Summary of all threshold crossings in the past week
- Trends: which metrics improved, regressed, or held steady
- Competitor watch: new releases or feature changes in the ecosystem
- Recommended focus areas for the coming week

---

## 5. Cron Job Config

The following Hermes cron jobs are active:

```bash
# Collect daily metrics
hermes cron create --schedule "0 6 * * *" \
  --name "monitor-metrics" \
  --script scripts/monitor-metrics.sh \
  --deliver local

# Weekly triage + health report
hermes cron create --schedule "0 9 * * 1" \
  --name "monitor-triage" \
  --prompt "Review the latest monitor metrics from ~/.helix/monitor/ and file
    kanban tasks for any threshold crossings. Then generate a weekly health
    report as a comment on the continuous-improvement tracking task." \
  --skills "monitor-triage" \
  --deliver local

# Weekly competitor scan
hermes cron create --schedule "0 14 * * 3" \
  --name "monitor-competitors" \
  --prompt "Search GitHub Trending and Hacker News for new AI coding agent
    tools, frameworks, or providers released this week. Summarize noteworthy
    changes relevant to Helix (new MCP servers, model releases, pricing
    changes). File observations to ~/.helix/monitor/competitor-watch.md." \
  --skills "web" \
  --deliver local
```

---

## 6. Dashboard Reference

The built-in web dashboard's **Monitor** section renders:

```
┌─────────────────────────────────────────────────────┐
│  Helix Dashboard · Monitor                          │
├─────────────────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐       │
│  │ ⭐    │  │ 📦    │  │ ✅    │  │ ⚡    │       │
│  │ 1,234 │  │ 5,678 │  │ 98%   │  │ 1.2s  │       │
│  │ Stars  │  │ npm/wk│  │ CI OK │  │ Build │       │
│  └───────┘  └───────┘  └───────┘  └───────┘       │
│                                                     │
│  ┌─ Recent Alerts ───────────────────────────────┐  │
│  │  🔴 CI failed on main — 2026-07-23 14:02     │  │
│  │  🟡 npm downloads down 15% this week          │  │
│  │  🟢 Stars +42 this week (trending up)         │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Eval Runs ────────────────────────────────────┐ │
│  │  Suite       | Score | Δ from baseline         │ │
│  │  code-gen    | 87%   | +2% ▲                   │ │
│  │  tool-call   | 94%   | -1% ▼                   │ │
│  │  reasoning   | 79%   | -4% ▼ (triage filed)    │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 7. File Layout

```
~/.helix/monitor/
├── metrics.jsonl          # Time-series KPI data (appended daily)
├── observations.md        # Info-level observations for weekly review
├── competitor-watch.md    # Competitor scan findings
└── alerts.log             # Alert crossings (threshold breaches)
```

---

## 8. Responsibilities

| Role | Responsibility |
|------|---------------|
| **Automated agent** | Runs cron jobs, collects metrics, files triage tasks |
| **Human (Gabri)** | Reviews critical triage tasks, makes strategic decisions on warnings |
| **Weekly review** | Read the Monday report, set priorities for the week |

---

*Last updated: 2026-07-24*
