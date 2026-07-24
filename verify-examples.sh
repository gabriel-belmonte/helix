#!/usr/bin/env bash
# Verify all SDK examples compile and run.
set -euo pipefail

cd "$(dirname "$0")/packages/agent"
echo "=== Verifying SDK examples ==="
echo ""

PASSED=0
FAILED=0

for f in examples/*.ts; do
  name=$(basename "$f")
  printf "  %-30s" "$name"
  if timeout 15 bun run "$f" > /dev/null 2>&1; then
    echo "✓"
    PASSED=$((PASSED + 1))
  else
    echo "✗"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "Results: $PASSED/$((PASSED + FAILED)) examples passed"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Running failed examples with output:"
  for f in examples/*.ts; do
    name=$(basename "$f")
    if ! timeout 15 bun run "$f" > /dev/null 2>&1; then
      echo ""
      echo "--- $name ---"
      timeout 15 bun run "$f" 2>&1 | head -20
    fi
  done
  exit 1
fi
