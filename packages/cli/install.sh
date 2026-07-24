#!/usr/bin/env bash
# Helix Agent CLI + TUI installer — no npm required.
# Usage: curl -fsSL https://raw.githubusercontent.com/gabriel-belmonte/helix/main/packages/cli/install.sh | sh
set -e

REPO="gabriel-belmonte/helix"
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

# Resolve version from GitHub API
echo "→ fetching $REPO release ($VERSION)…"
if [ "$VERSION" = "latest" ]; then
  REL_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  REL_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

# Helper: download a release asset and install it.
download_asset() {
  local asset="$1" bin_name="$2"
  local dl_url
  dl_url="$(curl -fsSL "$REL_URL" \
    | grep -o "\"browser_download_url\": *\"[^\"]*$asset[^\"]*\"" \
    | head -1 | sed 's/.*: *"//; s/"$//')"
  [ -n "$dl_url" ] || err "no release asset found for $asset"
  local tmp; tmp="$(mktemp)"
  echo "→ downloading $asset…"
  curl -fsSL "$dl_url" -o "$tmp"
  if [ -w "$INSTALL_DIR" ]; then
    mv "$tmp" "$INSTALL_DIR/$bin_name"
    chmod +x "$INSTALL_DIR/$bin_name"
  else
    echo "→ need write access to $INSTALL_DIR, using sudo"
    sudo mv "$tmp" "$INSTALL_DIR/$bin_name"
    sudo chmod +x "$INSTALL_DIR/$bin_name"
  fi
}

# 1. Install the CLI binary.
download_asset "helix-${OS}-${ARCH}" "helix"

# 2. Install the TUI companion binary.
download_asset "helix-tui-${OS}-${ARCH}" "helix-tui"

# 3. Install the Dashboard companion binary.
download_asset "helix-dashboard-${OS}-${ARCH}" "helix-dashboard"

# Save version marker for `helix update`
VERSION_LABEL="${VERSION:-latest}"
if [ "$VERSION_LABEL" = "latest" ]; then
  VERSION_LABEL="$(curl -fsSL "$REL_URL" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/"tag_name": *"//; s/"$//')"
fi
echo "$VERSION_LABEL" > "$INSTALL_DIR/.helix-version" 2>/dev/null || true

echo "✓ installed: $(command -v helix) + $(command -v helix-tui) + $(command -v helix-dashboard) ($VERSION_LABEL)"
echo
echo "Next steps:"
echo "  export OPENCODE_ZEN_API_KEY=***   # or HF_TOKEN / OPENROUTER_API_KEY"
echo "  helix config set provider zen"
echo "  helix config set model big-pickle"
echo "  helix -p \"refactor utils.ts to async/await\""
echo "  helix tui                         # launch the terminal UI"
echo "  helix dashboard                   # launch the web Dashboard"
