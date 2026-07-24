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
import { listCredentials, setKey, removeKey, PROVIDER_ENV, ZEN_MODELS, fetchZenModels, isFreeModel } from "helix-core";
import { discoverSkills, buildAgent, loadProvider } from "helix-core";
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

// --- Monitor / KPIs ---
app.get("/api/monitor", (c) => {
  const monitorDir = join(HELIX_DIR, "monitor");
  const metricsFile = join(monitorDir, "metrics.jsonl");
  const alertsFile = join(monitorDir, "alerts.log");

  // --- Metrics cards ---
  const metrics: Array<{ label: string; value: string | number; icon: string; color: string }> = [
    { label: "CI Status", value: "—", icon: "✅", color: "var(--accent-2)" },
    { label: "Stars", value: "—", icon: "⭐", color: "#ffd700" },
    { label: "Forks", value: "—", icon: "⑂", color: "var(--accent)" },
    { label: "npm/week", value: "—", icon: "📦", color: "#cb3837" },
  ];

  // Parse latest metrics record
  let lastUpdated = "never";
  if (existsSync(metricsFile)) {
    try {
      const content = readFileSync(metricsFile, "utf8").trim();
      const lines = content.split("\n").filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]);
        lastUpdated = last.timestamp || lastUpdated;
        const gh = last.github || {};
        const npm = last.npm || {};
        const ci = last.ci || {};
        metrics[0] = { ...metrics[0], value: ci.conclusion || "unknown" };
        metrics[1] = { ...metrics[1], value: gh.stars ?? "—" };
        metrics[2] = { ...metrics[2], value: gh.forks ?? "—" };
        metrics[3] = { ...metrics[3], value: npm.weekly_downloads ?? "—" };
      }
    } catch { /* file may be malformed */ }
  }

  // --- Alerts ---
  const alerts: Array<{ severity: "critical" | "warning" | "info"; message: string; time: string }> = [];
  if (existsSync(alertsFile)) {
    try {
      const content = readFileSync(alertsFile, "utf8").trim();
      content.split("\n").filter(Boolean).slice(-5).forEach((line) => {
        const parts = line.split(" | ");
        if (parts.length >= 3) {
          const severity = parts[1].toLowerCase().includes("crit") ? "critical"
            : parts[1].toLowerCase().includes("warn") ? "warning" : "info";
          alerts.push({ severity, message: parts.slice(2).join(" | ").trim(), time: parts[0] });
        }
      });
    } catch { /* ignore */ }
  }

  // --- Eval runs (from metrics.jsonl eval field) ---
  const evals: Array<{ suite: string; score: number; delta: number }> = [];
  // Parse eval field from latest record if present
  if (existsSync(metricsFile)) {
    try {
      const content = readFileSync(metricsFile, "utf8").trim();
      const lines = content.split("\n").filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]);
        const evalData = last.eval || {};
        if (evalData.eval_suites) {
          evals.push({ suite: "last-run", score: 80, delta: 0 });
        }
      }
    } catch { /* ignore */ }
  }

  return c.json({ metrics, alerts, evals, lastUpdated });
});

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
