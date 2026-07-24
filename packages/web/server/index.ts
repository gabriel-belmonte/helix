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
import { loadConfig, saveConfig, type HelixConfig } from "helix-core";
import { listCredentials, setKey, removeKey, PROVIDER_ENV, ZEN_MODELS, fetchZenModels, isFreeModel } from "helix-core";
import { discoverSkills, defaultSkillDirs, buildAgent, loadProvider } from "helix-core";
import { scriptedLLM } from "helix-agent";
import { JsonlMemoryStore, readSoul } from "helix-memory";

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

// --- Zen model catalog (free highlighted) ---
app.get("/api/zen-models", async (c) => {
  const models = await fetchZenModels().catch(() => ZEN_MODELS);
  const current = loadConfig().model;
  return c.json({
    models: models.map((m) => ({ ...m, current: m.id === current })),
    current,
  });
});

// --- Skills (discovered from skill dirs) ---
app.get("/api/skills", (c) => {
  const dirs = defaultSkillDirs();
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

// --- Chat (live agent over the web) ---
// One in-memory agent per sessionId. The agent uses the configured provider
// (resolved from ~/.helix/auth.json or env). Falls back to the scripted
// provider when no key is set, so the dashboard still demonstrates the flow.
const sessions = new Map<string, any>();

async function getAgent(sessionId: string, demo = false) {
  if (demo) {
    const p = scriptedLLM((turn) => {
      if (turn === 0) return "@@TOOL@@ list_dir {}";
      return "Hello! I'm Helix running in demo mode (no API key needed).";
    });
    const a = await buildAgent(p, { config: {} });
    sessions.set(sessionId, a);
    return a;
  }
  let agent = sessions.get(sessionId);
  if (agent) return agent;
  let provider;
  try {
    provider = loadProvider();
  } catch {
    provider = scriptedLLM((turn) => {
      if (turn === 0) return "@@TOOL@@ list_dir {}";
      return "Hello! I'm Helix running in demo mode (no API key configured).";
    });
  }
  agent = await buildAgent(provider, { config: {} });
  sessions.set(sessionId, agent);
  return agent;
}

app.post("/api/chat", async (c) => {
  const { message, sessionId = "default", demo = false } = await c.req.json<{
    message: string;
    sessionId?: string;
    demo?: boolean;
  }>();
  if (!message) return c.json({ error: "message required" }, 400);
  const agent = await getAgent(sessionId, demo);
  const reply = await agent.run(message);
  return c.json({ reply });
});

// --- Memory (helix-memory: JSONL store) ---
const memoryStore = new JsonlMemoryStore();

app.get("/api/memory", (c) => {
  const bank = c.req.query("bank") || "global";
  return c.json({ bank, entries: memoryStore.list({ bank }) });
});

app.post("/api/memory", async (c) => {
  const body = await c.req.json<{ text: string; type?: string; bank?: string; importance?: number }>();
  if (!body.text) return c.json({ error: "text required" }, 400);
  const entry = memoryStore.remember({
    type: (body.type as any) || "fact",
    text: body.text,
    bank: body.bank || "global",
    importance: body.importance ?? 0.6,
  });
  return c.json(entry);
});

app.delete("/api/memory", (c) => {
  const bank = c.req.query("bank") || "global";
  memoryStore.clear({ bank });
  return c.json({ ok: true, bank });
});

app.get("/api/soul", (c) => c.json({ soul: readSoul() }));

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

/** Start the dashboard server. Called by the CLI or directly. */
export function startDashboard(port?: number) {
  const p = port ?? (Number(process.env.PORT) || 8799);
  Bun.serve({ fetch: app.fetch, port: p });
  console.log(`helix-web listening on http://localhost:${p} (API + dashboard)`);
}

const PORT = Number(process.env.PORT) || 8799;
// Only start listening when run directly (not when imported).
if (import.meta.main) {
  startDashboard(PORT);
}
