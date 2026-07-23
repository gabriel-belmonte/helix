# Helix — containerized, the simple way: ship the compiled binary.
#
# `bun build --compile` bundles agent + core + mcp + eval into ONE static
# executable, so the container never resolves workspaces or runs TS at runtime.
#
# Build:
#   docker build --target cli -t helix-cli .
#   docker build --target web -t helix-web .
#
# Run the dashboard:
#   docker run -p 8799:8799 -e OPENCODE_ZEN_API_KEY=*** -v $HOME/.helix:/root/.helix helix-web
#
# Run the CLI:
#   docker run -e OPENCODE_ZEN_API_KEY=*** -v $HOME/.helix:/root/.helix helix-cli -p "list files"

# ── Base: Bun on Debian slim ───────────────────────────────────────────────
FROM oven/bun:latest AS base
WORKDIR /app
COPY . .
# Install workspace deps (no need for turbo native binary in Docker).
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# ── Builder: compile static binaries ───────────────────────────────────────
FROM base AS build
# Build each package in dependency order (avoids turbo's platform binary issue).
RUN cd packages/agent && bun run build \
 && cd ../memory && bun run build \
 && cd ../core && bun run build \
 && cd ../mcp && bun run build \
 && cd ../eval && bun run build \
 && cd ../cli && bun run build
# 2) Build the web UI (Vite -> static assets in packages/web/dist).
RUN cd packages/web && bun run build
# 3) Compile self-contained executables (no Bun runtime needed at runtime).
#    Embed the version so `--version` works inside the standalone binary.
RUN CLI_VER="$(node -p "require('./packages/cli/package.json').version")" \
 && printf 'export const BUILD_VERSION: string = "%s";\n' "$CLI_VER" > packages/cli/src/version.generated.ts \
 && bun build packages/cli/cli.ts --compile --target=bun-linux-x64 --outfile=/app/helix \
 && bun build packages/web/server/index.ts --compile --target=bun-linux-x64 --outfile=/app/helix-web

# ── Target: cli ────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS cli
WORKDIR /app
COPY --from=build /app/helix /usr/local/bin/helix
VOLUME ["/root/.helix"]
ENTRYPOINT ["helix"]
CMD ["--help"]

# ── Target: web (Dashboard on :8799) ───────────────────────────────────────
FROM debian:bookworm-slim AS web
WORKDIR /app/packages/web
# The compiled server serves the built Vite UI from ./dist (relative to cwd).
COPY --from=build /app/helix-web /usr/local/bin/helix-web
COPY --from=build /app/packages/web/dist /app/packages/web/dist
ENV PORT=8799
EXPOSE 8799
VOLUME ["/root/.helix"]
ENTRYPOINT ["helix-web"]
