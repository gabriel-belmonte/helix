#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
# monitor-metrics.sh — Helix Continuous Improvement Metrics Collector
# ===========================================================================
# Collects GitHub, npm, and local eval metrics and appends JSONL to
# ~/.helix/monitor/metrics.jsonl. Designed to be run daily from a cron job
# or manually.  Exit code: 0 on success, 1 on partial failure.
#
# Usage:  bash scripts/monitor-metrics.sh [--silent]
# ===========================================================================

SILENT=false
if [[ "${1:-}" == "--silent" ]]; then SILENT=true; fi

MONITOR_DIR="${HOME}/.helix/monitor"
METRICS_FILE="${MONITOR_DIR}/metrics.jsonl"
ALERTS_FILE="${MONITOR_DIR}/alerts.log"
mkdir -p "${MONITOR_DIR}"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TS_EPOCH="$(date -u +%s)"
log()  { if ! $SILENT; then echo "[monitor] $*"; fi; }
alert() { local level="$1" msg="$2"; echo "${NOW} | ${level} | ${msg}" >> "${ALERTS_FILE}"; log "${level} ${msg}"; }

REPO="gabriel-belmonte/helix"

# --- GitHub stats ---
log "Fetching GitHub stats..."
GH_DATA="{}"
if GH_RESPONSE="$(curl -sfL --max-time 10 "https://api.github.com/repos/${REPO}" 2>/dev/null)"; then
  STARS="$(echo "${GH_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stargazers_count',0))" 2>/dev/null || echo "null")"
  FORKS="$(echo "${GH_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('forks_count',0))" 2>/dev/null || echo "null")"
  OPEN_ISSUES="$(echo "${GH_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('open_issues_count',0))" 2>/dev/null || echo "null")"
  GH_DATA="{\"stars\":${STARS},\"forks\":${FORKS},\"open_issues\":${OPEN_ISSUES}}"
else
  alert "WARN" "GitHub API request failed (rate limit or network)"
  GH_DATA='{"stars":null,"forks":null,"open_issues":null}'
fi

# --- npm downloads (weekly) ---
log "Fetching npm stats..."
NPM_DATA="{}"
if NPM_RESPONSE="$(curl -sfL --max-time 10 "https://api.npmjs.org/downloads/point/last-week/helix-agent" 2>/dev/null)"; then
  NPM_DOWNLOADS="$(echo "${NPM_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('downloads',0))" 2>/dev/null || echo "null")"
  NPM_DATA="{\"weekly_downloads\":${NPM_DOWNLOADS}}"
else
  alert "WARN" "npm API request failed"
  NPM_DATA='{"weekly_downloads":null}'
fi

# --- CI status (latest workflow run) ---
log "Fetching CI status..."
CI_DATA='{"ci_status":"unknown"}'
if CI_RESPONSE="$(curl -sfL --max-time 10 "https://api.github.com/repos/${REPO}/actions/runs?per_page=1&branch=main&status=completed" 2>/dev/null)"; then
  CI_CONCLUSION="$(echo "${CI_RESPONSE}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
runs=d.get('workflow_runs',[])
if runs:
    r=runs[0]
    print(json.dumps({'conclusion':r.get('conclusion',''),'created_at':r.get('created_at','')}))
else:
    print(json.dumps({'conclusion':'unknown','created_at':''}))
" 2>/dev/null || echo '{"conclusion":"unknown","created_at":""}')"
  CI_DATA="${CI_CONCLUSION}"
fi

# --- Local eval state (if helix binary is available) ---
EVAL_DATA='{}'
if command -v helix &>/dev/null; then
  log "Checking local eval state..."
  EVAL_OUTPUT="$(helix eval --list 2>/dev/null || true)"
  if [ -n "${EVAL_OUTPUT}" ]; then
    EVAL_DATA="{\"eval_suites\":\"${EVAL_OUTPUT}\"}"
  fi
fi

# --- Build the JSONL record ---
RECORD="{\"timestamp\":\"${NOW}\",\"ts_epoch\":${TS_EPOCH},\"github\":${GH_DATA},\"npm\":${NPM_DATA},\"ci\":${CI_DATA},\"eval\":${EVAL_DATA}}"

echo "${RECORD}" >> "${METRICS_FILE}"

# --- Print summary ---
log "Written to ${METRICS_FILE}"
log "Record: $(echo "${RECORD}" | head -c 250)"
log "Done."
