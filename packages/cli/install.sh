#!/usr/bin/env bash
# Helix Agent CLI installer — no npm required.
# Usage: curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix-agent-cli/main/install.sh | sh
set -e

REPO="gabriel-belmonte/helix-agent-cli"
BIN_NAME="helix"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
VERSION="${HELIX_VERSION:-latest}"

err() { echo "✗ $*" >&2; exit 1; }

# Detect OS / arch
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="aarch64" ;;
  *) err "unsupported arch: $ARCH" ;;
esac
case "$OS" in
  linux) OS="linux" ;;
  darwin) OS="darwin" ;;
  *) err "unsupported OS: $OS (use WSL on Windows)" ;;
esac

# Resolve version + asset URL from GitHub API
ASSET="helix-${OS}-${ARCH}"
echo "→ fetching $REPO release ($VERSION)…"
if [ "$VERSION" = "latest" ]; then
  REL_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  REL_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

DOWNLOAD_URL="$(curl -fsSL "$REL_URL" \
  | grep -o "\"browser_download_url\": *\"[^\"]*$ASSET[^\"]*\"" \
  | head -1 | sed 's/.*: *\"//; s/\"$//')"

[ -n "$DOWNLOAD_URL" ] || err "no release asset found for $ASSET"

# Pick a temp dir we can write
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "→ downloading $ASSET…"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP/$BIN_NAME"

# Install (sudo only if needed)
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
  chmod +x "$INSTALL_DIR/$BIN_NAME"
else
  echo "→ need write access to $INSTALL_DIR, using sudo"
  sudo mv "$TMP/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
  sudo chmod +x "$INSTALL_DIR/$BIN_NAME"
fi

# Save version marker for `helix update`
VERSION_LABEL="${VERSION:-latest}"
if [ "$VERSION_LABEL" = "latest" ]; then
  VERSION_LABEL="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/"tag_name": *"//; s/"$//')"
fi
echo "$VERSION_LABEL" > "$INSTALL_DIR/.helix-version" 2>/dev/null || true

echo "✓ installed: $(command -v $BIN_NAME) ($VERSION_LABEL)"
echo
echo "Next steps:"
echo "  export OPENCODE_ZEN_API_KEY=***   # or HF_TOKEN / OPENROUTER_API_KEY"
echo "  helix config set provider zen"
echo "  helix config set model big-pickle"
echo "  helix -p \"refactor utils.ts to async/await\""
