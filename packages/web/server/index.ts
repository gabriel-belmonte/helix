// helix-web server: Hono API + static SPA serving.
//
// The API is a thin control surface over Helix's real on-disk state:
//   - ~/.helix/config.json   (provider, model, base URLs)   via loadConfig/saveConfig
//   - ~/.helix/auth.json     (API keys, chmod 600)          via helix-core auth
//   - skills/ folders        (SKILL.md discovery)           via discoverSkills
//   - helix.mcp.json         (MCP server list)              read/write JSON
//   - filesystem             (file browser)                 via node:fs
//
// One port serves both the dashboard UI and the JSON API, matching the
// "one minimal process" philosophy.

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { homedir } from "node:os";
import { join, resolve, relative, dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { loadConfig, saveConfig, type HelixConfig } from "../../cli/src/config.js";
import { listCredentials, setKey, removeKey, PROVIDER_ENV } from "helix-core";
import { discoverSkills } from "helix-core";

const HELIX_DIR = join(homedir(), ".helix");
const MCP_PATH = join(HELIX_DIR, "helix.mcp.json");

// File browser root: walk up from cwd to find a .git (repo root), else HOME.
// This keeps the dashboard anchored to a real project instead of packages/web.
function resolveRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    dir = dirname(dir);
  }
  return homedir();
}
const ROOT = resolveRoot();

function mcpConfig(): { servers: Record<string, unknown> } {
  try {
    if (!existsSync(MCP_PATH)) return { servers: {} };
    return JSON.parse(readFileSync(MCP_PATH, "utf8"));
  } catch {
    return { servers: {} };
  }
}
function saveMcpConfig(cfg: { servers: Record<string, unknown> }) {
  mkdirSync(HELIX_DIR, { recursive: true });
  writeFileSync(MCP_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

const app = new Hono();

// --- Health ---
app.get("/api/health", (c) => c.json({ ok: true, product: "helix-web" }));

// --- Config (provider, model, base URLs) ---
app.get("/api/config", (c) => c.json(loadConfig()));
app.post("/api/config", async (c) => {
  const body = await c.req.json<Partial<HelixConfig>>();
  const current = loadConfig();
  const next: HelixConfig = { ...current, ...body };
  saveConfig(next);
  return c.json(next);
});

// --- Auth / API keys (masked list + add/remove) ---
app.get("/api/auth", (c) => c.json(listCredentials()));
app.post("/api/auth", async (c) => {
  const { provider, key } = await c.req.json<{ provider: string; key: string }>();
  if (!provider || !key) return c.json({ error: "provider and key required" }, 400);
  setKey(provider, key);
  return c.json({ ok: true, provider });
});
app.delete("/api/auth/:provider", (c) => {
  const provider = c.req.param("provider");
  removeKey(provider);
  return c.json({ ok: true, provider });
});

// --- Skills (discovered from skill dirs) ---
app.get("/api/skills", (c) => {
  const dirs = [
    join(HELIX_DIR, "skills"),
    join(process.cwd(), "skills"),
    join(homedir(), ".claude", "skills"),
    join(process.cwd(), ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
    join(process.cwd(), ".agents", "skills"),
  ];
  const skills = discoverSkills(dirs).map((s) => ({
    name: s.name,
    description: s.description,
    dir: relative(process.cwd(), s.dir),
  }));
  return c.json(skills);
});

// --- MCP servers ---
app.get("/api/mcp", (c) => c.json(mcpConfig()));
app.post("/api/mcp", async (c) => {
  const cfg = await c.req.json<{ servers: Record<string, unknown> }>();
  saveMcpConfig(cfg);
  return c.json(cfg);
});

// --- Files (browser rooted at project root) ---
app.get("/api/files", (c) => {
  const reqPath = c.req.query("path") || ".";
  const abs = resolve(ROOT, reqPath);
  // prevent escaping the project root
  if (!abs.startsWith(ROOT)) return c.json({ error: "out of bounds" }, 400);
  if (!existsSync(abs)) return c.json({ error: "not found" }, 404);
  const st = statSync(abs);
  if (!st.isDirectory()) return c.json({ path: reqPath, entries: [] });
  const entries = readdirSync(abs)
    .map((name) => {
      const full = join(abs, name);
      let isDir = false;
      try { isDir = statSync(full).isDirectory(); } catch {}
      return { name, isDir, path: relative(ROOT, full) };
    })
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  return c.json({ path: reqPath, entries });
});

// --- Static SPA (prod build) ---
app.get("/*", serveStatic({ root: "./dist" }));
app.get("/", serveStatic({ root: "./dist", path: "index.html" }));

export { app };

const PORT = Number(process.env.PORT) || 8799;
// Only start listening when run directly (not when imported by tests).
if (import.meta.main) {
  Bun.serve({ fetch: app.fetch, port: PORT });
  console.log(`helix-web listening on http://localhost:${PORT} (API + dashboard)`);
}
