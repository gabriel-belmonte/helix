#!/usr/bin/env bash
# Build all Helix CLI binaries and publish them (plus install.sh) as a GitHub Release.
# Prereqs: `bun` installed, `gh` logged in (gh auth login), repo exists.
set -e

REPO="gabriel-belmonte/helix-agent-cli"
VERSION="${1:-0.1.0}"
OUT="dist"

echo "→ compiling binaries with bun…"
bun build cli.ts --compile --target=bun-linux-aarch64  --outfile="$OUT/helix-linux-aarch64"
bun build cli.ts --compile --target=bun-linux-x64        --outfile="$OUT/helix-linux-x64"
bun build cli.ts --compile --target=bun-darwin-aarch64 --outfile="$OUT/helix-darwin-aarch64"
bun build cli.ts --compile --target=bun-darwin-x64       --outfile="$OUT/helix-darwin-x64"

echo "→ creating release $VERSION…"
gh release create "$VERSION" \
  --repo "$REPO" \
  --title "Helix Agent CLI $VERSION" \
  --notes "Native binaries (no npm). Install: curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix-agent-cli/main/install.sh | sh" \
  "$OUT/helix-linux-aarch64" \
  "$OUT/helix-linux-x64" \
  "$OUT/helix-darwin-aarch64" \
  "$OUT/helix-darwin-x64" \
  "install.sh"

echo "✓ released $VERSION with 4 binaries + install.sh"
echo "  install.sh is served from this repo: raw.githubusercontent.com/gabriel-belmonte/helix-agent-cli/main/install.sh"
