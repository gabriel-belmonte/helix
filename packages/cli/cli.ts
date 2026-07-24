#!/usr/bin/env node
// helix-agent-cli — a minimal, transparent coding agent on top of helix-agent.

import chalk from "chalk";
import ora from "ora";
import { buildAgent, listCredentials, setKey, removeKey, maskSecret, PROVIDER_ENV, AUTH_PATH, ZEN_MODELS, fetchZenModels, isFreeModel, rollbackFile, restoreById, listCheckpoints, type HelixPlugin } from "helix-core";
import { makeMcpPlugin } from "helix-mcp";
import { makeCavemanPlugin, makeRtkPlugin, makeDelegatePlugin, resolveRefs, type SubTaskInput, type SubTaskResult } from "helix-core";
import { loadProvider } from "./src/provider.js";
import { loadConfig, saveConfig, CONFIG_PATH, type HelixConfig } from "./src/config.js";
import { runUpdate } from "./src/update.js";
import { handleEval, type EvalCliOpts } from "./src/eval.js";
import { appendHistory, loadHistory, clearHistory } from "./src/history.js";
import type { ChatMessage, LLMProvider } from "helix-agent";
import { Agent } from "helix-agent";
/** Lazy import for TUI (bundled by bun --compile). */
let _startTui: (() => void) | null = null;
async function ensureTui() {
  if (!_startTui) {
    try { _startTui = (await import("../tui/src/tui.tsx")).startTui; } catch { _startTui = null; }
  }
  return _startTui;
}
/** Lazy import for Dashboard (bundled by bun --compile). */
let _startDashboard: ((port?: number) => void) | null = null;
async function ensureDashboard() {
  if (!_startDashboard) {
    try { _startDashboard = (await import("../web/server/index.ts")).startDashboard; } catch { _startDashboard = null; }
  }
  return _startDashboard;
}
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { parseArgs, type CliOpts } from "./src/args.js";

function printHelp() {
  console.log(chalk.bold("helix") + chalk.gray(" — minimal coding agent CLI (helix-agent)\n"));

  console.log(chalk.bold("USAGE"));
  console.log(`  ${chalk.cyan("helix -p \"prompt\"")}          run a single prompt and exit`);
  console.log(`  ${chalk.cyan("helix")}                        interactive REPL`);
  console.log(`  ${chalk.cyan("helix -v")}                   verbose: show tool calls`);
  console.log(`  ${chalk.cyan("helix -V, --version")}       show CLI version`);
  console.log(`  ${chalk.cyan("helix status")}              show provider, model and API-key status`);
  console.log(`  ${chalk.cyan("helix doctor")}              diagnose infrastructure (keys, web, docker, skills)`);
  console.log(`  ${chalk.cyan("helix init")}                setup wizard for first-time configuration`);
  console.log(`  ${chalk.cyan("helix session save <n>")}    save conversation history`);
  console.log(`  ${chalk.cyan("helix session load <n>")}    restore a saved conversation`);
  console.log(`  ${chalk.cyan("helix session list")}         list saved sessions`);
  console.log(`  ${chalk.cyan("helix --json -p ...")}       structured JSON output for scripting`);
  console.log(`  ${chalk.cyan("helix dashboard")}           launch the web Dashboard`);
  console.log(`  ${chalk.cyan("helix tui")}                 launch the terminal UI (Ink chat)`);
  console.log(`  ${chalk.cyan("helix config set <k> <v>")}  save a config value`);
  console.log(`  ${chalk.cyan("helix config get [k]")}         show config (or one key)`);
  console.log(`  ${chalk.cyan("helix config list")}            show full config path + values`);
  console.log(`  ${chalk.cyan("helix auth login <provider>")} store an API key (hidden prompt)`);
  console.log(`  ${chalk.cyan("helix auth list")}              show configured keys (masked)`);
  console.log(`  ${chalk.cyan("helix auth logout <provider>")} remove a stored key`);
  console.log(`  ${chalk.cyan("helix history clear")}        clear conversation history`);
  console.log(`  ${chalk.cyan("helix update")}               update to latest release\n`);
  console.log(`  ${chalk.cyan("helix learn <url|file>")}     create a skill from a URL or local file`);
  console.log(`  ${chalk.cyan("helix rollback [path]")}     restore <path> from checkpoint (default: last)`);
  console.log(`  ${chalk.cyan("helix rollback list")}       list available checkpoints\n`);
  console.log(`  ${chalk.cyan("helix models")}               list OpenCode Zen models (free highlighted)`);
  console.log(`  ${chalk.cyan("helix models select")}       interactive model picker (saves to config)`);
  console.log(`  ${chalk.cyan("helix models set <id>")}     set the model directly\n`);
  console.log(`  ${chalk.cyan("helix eval --suite <f>")}    evaluate a model over a JSON suite of cases`);
  console.log(`  ${chalk.cyan("helix eval --suite <f> --model <slug>")}   force a specific model`);
  console.log(`  ${chalk.cyan("helix eval --suite <f> --compare <slug>")}   A/B two models`);
  console.log(`  ${chalk.cyan("helix eval --suite <f> --judge <slug>")}     grade outputs with an LLM judge\n`);
  console.log(`  ${chalk.cyan("helix --web -p \"...\"")}        enable web_search + web_extract (self-hosted)`);
  console.log(`  ${chalk.cyan("helix --web-search -p \"...\"")}  enable only web_search`);
  console.log(`  ${chalk.cyan("helix --web-extract -p \"...\"")} enable only web_extract\n`);

  console.log(chalk.bold("PROVIDERS (set via config or env)"));
  console.log(`  ${chalk.cyan("zen")}     OpenCode Zen (free Big Pickle)  → set provider zen; key=OPENCODE_ZEN_API_KEY`);
  console.log(`  ${chalk.cyan("hf")}      HuggingFace router (free)        → set provider hf;   key=HF_TOKEN`);
  console.log(`  ${chalk.cyan("openrouter")}  OpenRouter free tier            → set provider openrouter; key=OPENROUTER_API_KEY`);
  console.log(`  ${chalk.cyan("openai")}  OpenAI                              → set provider openai; key=OPENAI_API_KEY`);
  console.log(`  ${chalk.cyan("anthropic")}  Anthropic                          → set provider anthropic; key=ANTHROPIC_API_KEY\n`);

  console.log(chalk.bold("CONFIG KEYS"));
  console.log(`  ${chalk.cyan("provider")}      one of: zen | hf | openrouter | openai | anthropic`);
  console.log(`  ${chalk.cyan("model")}         model slug (e.g. big-pickle, Qwen/Qwen3-Coder-Next)`);
  console.log(`  ${chalk.cyan("zenBaseUrl")}   override Zen endpoint`);
  console.log(`  ${chalk.cyan("hfBaseUrl")}    override HF endpoint\n`);

  console.log(chalk.bold("EXAMPLES"));
  console.log(`  ${chalk.gray("$")} helix config set provider zen`);
  console.log(`  ${chalk.gray("$")} helix config set model big-pickle`);
  console.log(`  ${chalk.gray("$")} helix -p "refactor utils.ts to async/await"`);
  console.log(`  ${chalk.gray("$")} helix -v -p "list files in src/"\n`);

  console.log(chalk.gray("NOTE: API keys resolve as env var > ~/.helix/auth.json (chmod 600)."));
  console.log(chalk.gray("      Store one with `helix auth login <provider>`; env vars always win."));
}

// Read a line from stdin without echoing it (for secret entry).
async function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const rlAny = rl as any;
  let armed = false;
  // Suppress echo: after the question is printed, mask everything typed.
  rlAny._writeToOutput = (str: string) => {
    if (!armed) {
      output.write(str);
      if (str.includes(question)) armed = true;
      return;
    }
    // Only emit newlines while armed (so Enter still moves the cursor).
    if (str === "\n" || str === "\r\n") output.write(str);
  };
  const answer = await rl.question(question);
  rl.close();
  output.write("\n");
  return answer;
}

async function handleAuth(opts: CliOpts) {
  if (opts.authAction === "list") {
    console.log(chalk.gray(`auth: ${AUTH_PATH} (chmod 600)\n`));
    const creds = listCredentials();
    for (const c of creds) {
      const mark = c.configured ? chalk.green("●") : chalk.gray("○");
      const src = c.fromEnv
        ? chalk.yellow(c.source) + chalk.gray(" (env wins)")
        : c.source === "(none)"
          ? chalk.gray("(not set)")
          : chalk.cyan(c.source);
      const fp = c.fingerprint ? chalk.gray(` ${c.fingerprint}`) : "";
      console.log(`  ${mark} ${chalk.bold(c.provider.padEnd(11))} ${src}${fp}`);
    }
    console.log(chalk.gray("\n  ● configured   ○ not set"));
    console.log(chalk.gray("  env vars always take precedence over stored keys."));
    return;
  }

  if (opts.authAction === "logout") {
    const provider = opts.authProvider;
    if (!provider) {
      console.error(chalk.red("✗") + " usage: helix auth logout <provider>");
      process.exit(1);
    }
    const removed = removeKey(provider);
    if (removed) console.log(chalk.green("✓") + ` removed stored key for ${chalk.cyan(provider)}`);
    else console.log(chalk.gray(`no stored key for ${provider}`));
    return;
  }

  if (opts.authAction === "login") {
    const provider = opts.authProvider;
    if (!provider) {
      console.error(chalk.red("✗") + " usage: helix auth login <provider>");
      console.error(chalk.gray("  providers: " + Object.keys(PROVIDER_ENV).join(", ")));
      process.exit(1);
    }
    if (!PROVIDER_ENV[provider]) {
      console.log(chalk.yellow("!") + ` unknown provider "${provider}" — storing anyway.`);
      console.log(chalk.gray("  known: " + Object.keys(PROVIDER_ENV).join(", ")));
    }
    let key = opts.authKey;
    if (!key) {
      key = (await promptHidden(chalk.cyan(`Paste ${provider} API key: `))).trim();
    }
    if (!key) {
      console.error(chalk.red("✗") + " no key provided");
      process.exit(1);
    }
    setKey(provider, key);
    console.log(
      chalk.green("✓") +
        ` stored ${chalk.cyan(provider)} key (${chalk.gray(maskSecret(key))}) in ${chalk.gray(AUTH_PATH)}`
    );
    const envName = PROVIDER_ENV[provider];
    if (envName && process.env[envName]) {
      console.log(chalk.yellow("!") + ` note: ${envName} is set in your env and will take precedence.`);
    }
    return;
  }
}

async function handleModels(opts: CliOpts) {
  // `helix models set <id>` — save directly without prompting.
  if (opts.modelsSet) {
    const cfg = loadConfig();
    cfg.model = opts.modelsSet;
    saveConfig(cfg);
    console.log(chalk.green("✓") + ` saved ${chalk.cyan("model")} = ${chalk.cyan(opts.modelsSet)}`);
    return;
  }

  // Fetch live catalog; fall back to curated list offline.
  const spinner = ora({ text: "Fetching model catalog…", color: "cyan" }).start();
  const models = await fetchZenModels().catch(() => { spinner.warn("offline — using cached models"); return ZEN_MODELS; });
  spinner.stop();
  const current = loadConfig().model;

  console.log(chalk.bold("OpenCode Zen models") + chalk.gray(` (${models.length} available)`));
  console.log(chalk.gray("  free models are highlighted in green\n"));
  models.forEach((m, i) => {
    const tag = m.free ? chalk.green("FREE ") : chalk.gray("     ");
    const marker = m.id === current ? chalk.yellow("→") : " ";
    const name = m.free ? chalk.green(m.id) : m.id;
    console.log(`  ${marker} ${String(i + 1).padStart(2)}. ${tag} ${name}`);
  });

  if (!opts.modelsSelect) return;

  // Interactive picker.
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question(chalk.cyan("\nSelect model # (or name), empty to cancel: "))).trim();
  rl.close();
  if (!answer) return;

  let chosen: string | undefined;
  const asNum = Number(answer);
  if (!Number.isNaN(asNum) && models[asNum - 1]) {
    chosen = models[asNum - 1].id;
  } else if (models.some((m) => m.id === answer)) {
    chosen = answer;
  }
  if (!chosen) {
    console.error(chalk.red("✗") + " invalid selection");
    return;
  }
  const cfg = loadConfig();
  cfg.model = chosen;
  saveConfig(cfg);
  const free = isFreeModel(chosen) ? chalk.green(" (free)") : "";
  console.log(chalk.green("✓") + ` saved ${chalk.cyan("model")} = ${chalk.cyan(chosen)}${free}`);
}

function printConfig(cfg: HelixConfig, key?: string) {
  console.log(chalk.gray(`config: ${CONFIG_PATH}`));
  if (key) {
    console.log(`  ${chalk.cyan(key)} = ${cfg[key as keyof HelixConfig] ?? chalk.gray("(unset)")}`);
  } else {
    for (const k of Object.keys(cfg) as (keyof HelixConfig)[]) {
      console.log(`  ${chalk.cyan(k)} = ${cfg[k] ?? chalk.gray("(unset)")}`);
    }
    if (Object.keys(cfg).length === 0) console.log(`  ${chalk.gray("(empty — run `helix config set provider <x>`")}`);
  }
}

// Read the CLI version. Priority:
//   1. BUILD_VERSION — written at release/build time into version.generated.ts
//      (release.yml / Dockerfile regenerate it with the release tag before compile).
//   2. package.json next to the entry (dev / npm install).
import { BUILD_VERSION } from "./src/version.generated.js";
function getCliVersion(): string {
  if (BUILD_VERSION && BUILD_VERSION.length > 0) return BUILD_VERSION;
  try {
    const here = import.meta.dirname ?? import.meta.url;
    let dir = here.startsWith("file://") ? new URL(here).pathname : String(here);
    if (dir.endsWith("cli.ts") || dir.endsWith("cli.js")) dir = dir.replace(/cli\.(ts|js)$/, "");
    let cur = dir;
    for (let i = 0; i < 6; i++) {
      const p = join(cur, "package.json");
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, "utf8"));
        if (pkg.name === "helix-agent-cli" || pkg.name?.startsWith("helix-")) return pkg.version ?? "0.0.0";
      }
      const parent = join(cur, "..");
      if (parent === cur) break;
      cur = parent;
    }
  } catch {
    /* ignore */
  }
  return "0.0.0";
}

function printVersion() {
  const v = getCliVersion();
  console.log(`helix-agent-cli ${v}`);
}

// Show the active provider + model and whether each provider's API key is set.
async function printStatus(cfg: HelixConfig) {
  const creds = listCredentials();
  const active = cfg.provider ?? "(unset)";
  const activeModel = cfg.model ?? "(unset)";
  console.log(chalk.bold("Helix status"));
  console.log(`  ${chalk.cyan("provider")}  ${active}`);
  console.log(`  ${chalk.cyan("model")}     ${activeModel}`);
  if (cfg.fallback && cfg.fallback.length > 0) {
    console.log(`  ${chalk.cyan("fallback")} [${cfg.fallback.join(", ")}]`);
  }
  const feats = cfg.features ?? {};
  const activeFeats = Object.entries(feats).filter(([, v]) => v).map(([k]) => k);
  if (activeFeats.length > 0) {
    console.log(`  ${chalk.cyan("features")} ${activeFeats.join(", ")}`);
  }
  console.log();
  console.log(chalk.bold("API keys"));
  for (const c of creds) {
    const mark = c.configured ? chalk.green("● set") : chalk.gray("○ not set");
    const src = c.fromEnv
      ? chalk.yellow("env") + chalk.gray(` (${c.source})`)
      : c.source === "(none)"
        ? chalk.gray("—")
        : chalk.cyan(c.source);
    const fp = c.fingerprint ? chalk.gray(`  ${c.fingerprint}`) : "";
    console.log(`  ${mark.padEnd(10)} ${chalk.bold(c.provider.padEnd(11))} ${src}${fp}`);
  }
  console.log(chalk.gray("  env vars take precedence over stored keys."));

  // Web infra status.
  await statusWebInfra();
}

/** Check web infrastructure (SearXNG + extract server) and print status. */
async function statusWebInfra() {
  const spinner = ora({ text: "Checking web infra…", color: "cyan" }).start();
  const searxngUrl = "http://127.0.0.1:8888";
  const extractUrl = "http://127.0.0.1:8787";
  const [searxngUp, extractUp] = await Promise.all([
    fetch(searxngUrl + "/search?q=test&format=json", { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok).catch(() => false),
    fetch(extractUrl + "/health", { signal: AbortSignal.timeout(2000) })
      .then((r) => r.ok).catch(() => false),
  ]);
  spinner.stop();

  const sx = searxngUp ? chalk.green("● online") : chalk.gray("○ offline");
  const ex = extractUp ? chalk.green("● online") : chalk.gray("○ offline");
  console.log(`\n${chalk.bold("Web infra")}`);
  console.log(`  ${chalk.cyan("web_search")}  ${searxngUrl.padEnd(24)} ${sx}`);
  console.log(`  ${chalk.cyan("web_extract")} ${extractUrl.padEnd(24)} ${ex}`);
}

// Launch the Helix Dashboard (web control panel) on :8799.
// Uses imported startDashboard() (bundled by bun --compile).
async function runDashboard() {
  const PORT = process.env.PORT ?? "8799";
  const startDashboard = await ensureDashboard();
  if (startDashboard) {
    startDashboard();
    return;
  }

  // Fallback: dev checkout
  const here = import.meta.dirname ?? ".";
  const serverCandidate = join(here, "../web/server/index.ts");
  const bun = process.env.PATH?.split(":").map((d) => join(d, "bun")).find((p) => existsSync(p));
  if (existsSync(serverCandidate) && bun) {
    const sp = ora({ text: "Starting Helix Dashboard…", color: "cyan" }).start();
    const child = spawn(bun, [serverCandidate], {
      stdio: "ignore",
      env: { ...process.env, PORT },
    });
    await new Promise((r) => setTimeout(r, 2000));
    const ok = await fetch(`http://localhost:${PORT}/api/health`)
      .then((r) => r.ok).catch(() => false);
    if (ok) {
      sp.succeed(`Helix Dashboard running on http://localhost:${PORT}`);
    } else {
      sp.warn("Dashboard may still be starting…");
    }
    child.unref();
    return;
  }

  // 3) Docker available: fallback.
  const dockerPaths = ["docker", "/usr/bin/docker", "/usr/local/bin/docker"];
  const hasDocker = dockerPaths.some((p) => existsSync(p));
  if (hasDocker) {
    const sp = ora({ text: "Starting Helix Dashboard (Docker)…", color: "cyan" }).start();
    const configVol = join(homedir(), ".helix");
    console.log(chalk.green("✓") + " Docker detected — starting the Helix Dashboard container...\n");
    console.log(chalk.gray(`  Dashboard → http://localhost:${PORT}`));
    console.log(chalk.gray(`  Config    → ${configVol} mounted at /root/.helix`));
    console.log(chalk.gray("  Press Ctrl+C to stop.\n"));

    // The user needs the image. Try to use docker compose first (if they have
    // the repo cloned), otherwise run the container directly.
    const composeCandidates = [
      join(process.cwd(), "docker-compose.yml"),
      join(process.cwd(), "docker-compose.yaml"),
      join(process.cwd(), "Dockerfile"),
    ];
    const hasCompose = composeCandidates.some((p) => existsSync(p));

    if (hasCompose && existsSync(join(process.cwd(), "Dockerfile"))) {
      // Build from local source.
      const child = spawn("docker", ["compose", "up", "--build", "-d"], {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      child.on("exit", (code) => {
        if (code === 0) {
          console.log(chalk.green("\n✓") + ` Helix Dashboard running on http://localhost:${PORT}`);
        }
        process.exit(code ?? 0);
      });
    } else {
      // Run the pre-built image from GitHub Container Registry.
      // Pulls automatically if not available locally.
      const image = "ghcr.io/gabriel-belmonte/helix/helix-web:latest";
      const args = [
        "run", "-d", "--rm",
        "--name", "helix-web",
        "-p", `${PORT}:8799`,
        "-v", `${configVol}:/root/.helix`,
        "-e", `PORT=${PORT}`,
        image,
      ];
      const child = spawn("docker", args, { stdio: "inherit" });
      child.on("exit", (code) => {
        if (code === 0) {
          console.log(chalk.green("\n✓") + ` Helix Dashboard running on http://localhost:${PORT}`);
        } else {
          // Pull failed or image not found — fallback to build instructions.
          console.log(chalk.yellow("\n!") + " Could not pull the image. Build it locally:");
          console.log(`  ${chalk.cyan("docker build --target web -t helix-web .")}  # from the repo root`);
          console.log(`  ${chalk.cyan("docker run -p 8799:8799 -v $HOME/.helix:/root/.helix helix-web")}`);
        }
        process.exit(code ?? 0);
      });
    }
    return;
  }

  // 3) Nothing available — print instructions.
  console.log(chalk.yellow("!") + " Helix Dashboard needs Docker or the web package.");
  console.log(chalk.gray("  Install Docker and run:"));
  console.log(`    ${chalk.cyan("docker run -d -p 8799:8799 -v $HOME/.helix:/root/.helix ghcr.io/gabriel-belmonte/helix/helix-web:latest")}`);
  console.log(chalk.gray("  Or from a source checkout:"));
  console.log(`    ${chalk.cyan("bun run server/index.ts")}  # in packages/web`);
}

// Launch the Helix TUI (Ink-based terminal UI).
// Imports and calls startTui() directly (no companion binary needed).
function runTui() {
  ensureTui().then((startTui) => {
    if (startTui) { startTui(); return; }
    // Fallback: try spawning from dev checkout
    const tuiPath = join(import.meta.dirname ?? ".", "../tui/src/tui.tsx");
    if (existsSync(tuiPath)) {
      const bun = process.env.PATH?.split(":").map((d) => join(d, "bun")).find((p) => existsSync(p));
      if (bun) { spawn(bun, [tuiPath], { stdio: "inherit", env: { ...process.env } }); return; }
    }
    console.log(chalk.yellow("!") + " Helix TUI not available in this build.");
    console.log(`  ${chalk.cyan("cd helix-monorepo && bun run packages/tui/src/tui.tsx")}`);
  });
}

/** Diagnostics: check API keys, web infra, Docker, config, skills, MCP. */
async function runDoctor() {
  const cfg = loadConfig();
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // 1. API keys
  const envKeys = Object.entries(PROVIDER_ENV).filter(([, env]) => process.env[env]);
  const storedKeys = existsSync(AUTH_PATH) ? (JSON.parse(readFileSync(AUTH_PATH, "utf8"))) : {};
  const allProviders = ["zen", "openai", "anthropic", "openrouter", "hf"];
  for (const prov of allProviders) {
    const fromEnv = envKeys.find(([p]) => p === prov);
    const fromStore = storedKeys[prov];
    const configured = !!fromEnv || !!fromStore;
    const source = fromEnv ? "env" : fromStore ? "auth.json" : null;
    checks.push({
      name: `API key: ${prov}`,
      ok: configured,
      detail: configured ? `✅ ${source}` : "❌ not set",
    });
  }

  // 2. Web infra
  checks.push({ name: "SearXNG (web_search)", ok: false, detail: "checking…" });
  checks.push({ name: "Extract (web_extract)", ok: false, detail: "checking…" });
  try {
    const sx = await fetch("http://127.0.0.1:8888/search?q=test&format=json", { signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false);
    checks[checks.length - 2] = { name: "SearXNG (web_search)", ok: sx, detail: sx ? "✅ online :8888" : "❌ offline :8888" };
    const ex = await fetch("http://127.0.0.1:8787/health", { signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false);
    checks[checks.length - 1] = { name: "Extract (web_extract)", ok: ex, detail: ex ? "✅ online :8787" : "❌ offline :8787" };
  } catch { /* ignore */ }

  // 3. Docker
  const hasDocker = ["docker", "/usr/bin/docker", "/usr/local/bin/docker"].some(p => existsSync(p));
  checks.push({ name: "Docker", ok: hasDocker, detail: hasDocker ? "✅ available" : "❌ not found" });

  // 4. Skills
  const { discoverSkills: discoverSkillsFn } = await import("helix-core");
  const skills = discoverSkillsFn([]);
  checks.push({ name: "Skills", ok: true, detail: `${skills.length} found` });

  // 5. Config
  checks.push({ name: `Config (${cfg.provider ?? "unset"})`, ok: !!cfg.provider, detail: cfg.provider ? `✅ model: ${cfg.model ?? "(default)"}` : "❌ no provider set" });

  // Print results
  console.log(chalk.bold("\n🔍 Helix Doctor\n"));
  for (const c of checks) {
    const icon = c.ok ? chalk.green("●") : chalk.red("○");
    console.log(`  ${icon} ${chalk.bold(c.name.padEnd(30))} ${c.detail}`);
  }
  console.log();
  const allOk = checks.every(c => c.ok);
  if (allOk) console.log(chalk.green("  ✓ All checks passed"));
  else console.log(chalk.yellow(`  ⚠ ${checks.filter(c => !c.ok).length} issue(s) found`));
}

/** Session management: save/load/list/export conversation history. */
async function runSession(action: string, name?: string) {
  const histDir = join(homedir(), ".helix", "sessions");
  mkdirSync(histDir, { recursive: true });

  if (action === "list") {
    const files = readdirSync(histDir).filter(f => f.endsWith(".json"));
    if (files.length === 0) return console.log(chalk.gray("  No saved sessions."));
    console.log(chalk.bold("\n📁 Saved sessions\n"));
    for (const f of files) {
      const label = f.replace(".json", "");
      const stats = statSync(join(histDir, f));
      const age = Math.round((Date.now() - stats.mtimeMs) / 1000 / 60);
      console.log(`  ${chalk.cyan(label.padEnd(25))} ${chalk.gray(`${age}m ago`)}`);
    }
    return;
  }

  if (action === "save" && name) {
    const history = loadHistory(1000);
    writeFileSync(join(histDir, `${name}.json`), JSON.stringify(history, null, 2));
    return console.log(chalk.green(`✓ session saved as "${name}" (${history.length} messages)`));
  }

  if (action === "load" && name) {
    const path = join(histDir, `${name}.json`);
    if (!existsSync(path)) return console.log(chalk.red(`✗ session "${name}" not found`));
    const data = JSON.parse(readFileSync(path, "utf8"));
    clearHistory();
    for (const msg of data) appendHistory(msg.role, msg.content);
    return console.log(chalk.green(`✓ session "${name}" restored (${data.length} messages)`));
  }

  if (action === "export" && name) {
    const path = join(histDir, `${name}.json`);
    if (!existsSync(path)) return console.log(chalk.red(`✗ session "${name}" not found`));
    const data = JSON.parse(readFileSync(path, "utf8"));
    process.stdout.write(JSON.stringify(data, null, 2));
    return;
  }

  console.log(chalk.yellow("  Usage: helix session <save|load|list|export> [name]"));
}

/** Init: scaffold ~/.helix/ with config, guide for auth, skills, MCP. */
async function runInit() {
  const cfg = loadConfig();

  // Check if already configured
  if (cfg.provider) {
    console.log(chalk.gray("  Helix is already configured."));
    console.log(chalk.gray(`  provider: ${cfg.provider}, model: ${cfg.model ?? "(default)"}`));
    console.log(chalk.gray("  To reconfigure: helix config set provider <name>"));
    return;
  }

  console.log(chalk.bold("\n🚀 Helix Init — Setup Wizard\n"));

  // Provider selection
  console.log(chalk.cyan("Choose a provider:"));
  const providers = [
    { id: "zen", label: "OpenCode Zen (free models available)", default: true },
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "openrouter", label: "OpenRouter (free tier)", default: true },
    { id: "hf", label: "HuggingFace (free inference)" },
  ];
  for (const p of providers) {
    const def = p.default ? chalk.gray(" (recommended)") : "";
    console.log(`  ${chalk.cyan(p.id.padEnd(14))} ${p.label}${def}`);
  }

  // Default setup
  cfg.provider = "zen";
  cfg.model = "big-pickle";
  saveConfig(cfg as any);

  console.log(chalk.green("\n✓ Config saved:") + ` provider=zen, model=big-pickle`);
  console.log(chalk.gray("\nNext steps:"));
  console.log(`  ${chalk.cyan("Set your API key:")}`);
  console.log(`    export OPENCODE_ZEN_API_KEY="sk-..."`);
  console.log(`  ${chalk.cyan("Or use the auth command:")}`);
  console.log(`    helix auth login zen`);
  console.log(`  ${chalk.cyan("Try it:")}`);
  console.log(`    helix -p "list the files in this directory"`);
  console.log(`  ${chalk.cyan("TUI:")}`);
  console.log(`    helix tui`);
  console.log(`  ${chalk.cyan("Dashboard:")}`);
  console.log(`    helix dashboard`);
  console.log();
}

/**
 * Run Helix inside a Docker sandbox container (sandboxed tool execution).
 * Mounts the current directory, runs `helix -p "<prompt>"` inside.
 */
async function runSandbox(prompt: string) {
  const docker = ["docker", "/usr/bin/docker", "/usr/local/bin/docker"].find((p) => existsSync(p));
  if (!docker) {
    console.error(chalk.red("✗") + " Docker not found. Install Docker for sandbox mode.");
    console.log(chalk.gray("  See https://docs.docker.com/engine/install/"));
    process.exit(1);
  }

  const sandboxImage = "ghcr.io/gabriel-belmonte/helix/helix-sandbox:latest";
  const cwd = process.cwd();
  const helixHome = join(homedir(), ".helix");

  console.log(chalk.gray("🐳 Running in Docker sandbox..."));
  console.log(chalk.gray(`  Prompt: "${prompt}"`));
  console.log(chalk.gray(`  Mounts: ${cwd} → /workspace`));

  const args = [
    "run", "--rm", "-i",
    "-v", `${cwd}:/workspace`,
    "-v", `${helixHome}:/root/.helix`,
    "-e", `OPENCODE_ZEN_API_KEY=${process.env.OPENCODE_ZEN_API_KEY || ""}`,
    "-e", `HELIX_SUBAGENT=${process.env.HELIX_SUBAGENT || ""}`,
    "-w", "/workspace",
    sandboxImage,
    "helix", "-p", prompt,
  ];

  const result = spawnSync(docker, args, { stdio: "inherit", timeout: 300_000 });
  process.exit(result.status ?? 0);
}

/**
 * Handle `submit-task` — run a single task as an isolated sub-agent.
 * Used by the delegate_task tool (process isolation pattern, Pi-style).
 * 
 * Reads task JSON from file, runs agent with limited tools, writes result JSON.
 */
async function handleSubmitTask(taskPath: string, resultPath?: string) {
  let task: SubTaskInput;
  try {
    task = JSON.parse(readFileSync(taskPath, "utf8"));
  } catch (e: any) {
    console.error(chalk.red("✗") + ` Failed to read task: ${e.message}`);
    process.exit(1);
  }

  const llm = loadProvider({ scripted: false });

  // Sub-agent: no tools — must reply directly from goal + context only.
  // If the task needs file data, the parent passes it via `context`.
  const agent = new Agent({
    name: "sub-agent",
    system: "You are a focused sub-agent. Answer the user's task directly.",
    llm,
    tools: [],
    maxSteps: 3,
  });

  const startTime = Date.now();
  const result = await agent.run(task.goal);
  const elapsed = Date.now() - startTime;

  const output: SubTaskResult = {
    result,
    agent: "sub-agent",
    exitCode: 0,
    usage: {
      input: task.goal.length,
      output: result.length,
      turns: 1,
    },
  };

  if (resultPath) {
    writeFileSync(resultPath, JSON.stringify(output, null, 2));
  } else {
    // Write to stdout if no result path
    process.stdout.write(JSON.stringify(output));
  }
}

/**
 * Handle `helix learn <url|file>` — read content from a URL or local file
 * and create a persistent skill from it.
 */
async function handleLearn(target: string) {
  const { createSkillFromSource } = await import("helix-core");
  try {
    const result = await createSkillFromSource(target);
    console.log(chalk.green("✓") + " " + result.message);
    console.log(chalk.gray(`  Created skill "${result.name}" — ${result.dir}`));
  } catch (e: any) {
    console.error(chalk.red("✗") + " " + e.message);
    process.exit(1);
  }
}

/**
 * Handle `helix rollback <path|"last">` — restore a file from a snapshot.
 */
async function handleRollback(target: string) {
  const { rollbackFile, restoreById, listCheckpoints } = await import("helix-core");

  if (target === "list") {
    const all = listCheckpoints(undefined, 20);
    if (all.length === 0) {
      console.log(chalk.yellow("!") + " No checkpoints available.");
      return;
    }
    console.log(chalk.bold(`Checkpoints (${all.length}):`));
    for (const c of all) {
      const ts = new Date(c.time).toISOString().slice(0, 19).replace("T", " ");
      console.log(`  ${chalk.cyan(c.id.padEnd(50))} ${String(c.size).padStart(8)} B  ${chalk.gray(ts)}  ${c.originalPath}`);
    }
    return;
  }

  if (target === "last") {
    const all = listCheckpoints(undefined, 1);
    if (all.length === 0) {
      console.log(chalk.yellow("!") + " No checkpoints available.");
      return;
    }
    const latest = all[0];
    const result = rollbackFile(latest.originalPath);
    if (result.success) {
      console.log(chalk.green("✓") + " " + result.message);
    } else {
      console.log(chalk.red("✗") + " " + result.message);
    }
    return;
  }

  // Rollback by file path
  const result = rollbackFile(target);
  if (result.success) {
    console.log(chalk.green("✓") + " " + result.message);
  } else {
    console.log(chalk.red("✗") + " " + result.message);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Version flag (works even with no config / offline).
  if (opts.version) {
    printVersion();
    return;
  }

  // Status: active provider/model + which API keys are configured.
  if (opts.status) {
    await printStatus(loadConfig());
    return;
  }

  // Dashboard: launch the web control panel.
  if (opts.dashboard) {
    await runDashboard();
    return;
  }

  // Doctor: diagnose infrastructure.
  if (opts.doctor) {
    await runDoctor();
    return;
  }

  // Session: save/load/list/export conversation history.
  if (opts.sessionAction) {
    await runSession(opts.sessionAction, opts.sessionName);
    return;
  }

  // Init: scaffold ~/.helix/ config + auth wizard.
  if (opts.init) {
    await runInit();
    return;
  }

  // TUI: launch the terminal UI (Ink-based chat).
  if (opts.tui) {
    runTui();
    return;
  }

  // Update subcommand
  if (opts.update) {
    await runUpdate();
    return;
  }

  // Auth subcommand
  if (opts.auth) {
    await handleAuth(opts);
    return;
  }

  // Models subcommand (Zen catalog + picker)
  if (opts.modelsList || opts.modelsSelect) {
    await handleModels(opts);
    return;
  }

  // Eval subcommand — run/compare model quality across a suite.
  if (opts.eval) {
    try {
      await handleEval({
        suite: opts.evalSuite,
        model: opts.evalModel,
        compare: opts.evalCompare,
        judge: opts.evalJudge,
        scripted: opts.scripted,
      } as EvalCliOpts);
    } catch (e: any) {
      console.error(chalk.red("✗") + " " + e.message);
      process.exit(1);
    }
    return;
  }

  // History clear subcommand
  if (opts.historyClear) {
    clearHistory();
    console.log(chalk.green("✓") + " history cleared");
    return;
  }

  // Sandbox subcommand — run inside Docker container
  if (opts.sandboxTool) {
    if (!opts.prompt) {
      console.error(chalk.red("✗") + " --sandbox requires -p <prompt>");
      process.exit(1);
    }
    await runSandbox(opts.prompt);
    return;
  }

  // Submit-task subcommand — run as sub-agent (process isolation)
  if (opts.submitTask) {
    await handleSubmitTask(opts.submitTask, opts.submitResult);
    return;
  }

  // Learn subcommand — create a skill from URL or file
  if (opts.learnTarget) {
    await handleLearn(opts.learnTarget);
    return;
  }

  // Rollback subcommand — restore a file from a checkpoint snapshot
  if (opts.rollbackTarget !== undefined) {
    await handleRollback(opts.rollbackTarget);
    return;
  }

  // Config subcommand
  if (opts.config) {
    if (opts.configGet) {
      printConfig(loadConfig(), opts.configKey);
      return;
    }
    if (opts.configKey && opts.configVal !== undefined) {
      const cfg = loadConfig();
      (cfg as any)[opts.configKey] = opts.configVal;
      saveConfig(cfg);
      console.log(chalk.green("✓") + ` saved ${chalk.cyan(opts.configKey)} = ${chalk.cyan(opts.configVal)}`);
      console.log(chalk.gray("  (set your API key in the environment, e.g. OPENCODE_ZEN_API_KEY)"));
      return;
    }
    printHelp();
    return;
  }

  if (opts.cwd) process.chdir(opts.cwd);

  // Verbose callback: log each tool call in real time
  const onToolCall = opts.verbose
    ? (name: string, input: unknown) => {
        const preview = typeof input === "object" ? JSON.stringify(input) : String(input);
        console.log(
          chalk.cyan("  🔧 " + name) +
          chalk.gray("(" + (preview.length > 120 ? preview.slice(0, 120) + "..." : preview) + ")")
        );
      }
    : undefined;

  // --- Prepare plugins + tools before provider ---
  const savedHistory = loadHistory(20);
  const initialHistory: ChatMessage[] = savedHistory.map((e) => ({
    role: e.role,
    content: e.content,
  }));
  const plugins: HelixPlugin[] = [];
  const mcpPath = (() => {
    const local = join(process.cwd(), "helix.mcp.json");
    const home = join(homedir(), ".helix", "helix.mcp.json");
    return existsSync(local) ? local : existsSync(home) ? home : null;
  })();
  if (mcpPath) {
    try {
      const raw = JSON.parse(readFileSync(mcpPath, "utf8"));
      const servers = raw.servers ?? raw;
      plugins.push(makeMcpPlugin({ servers }));
      console.log(chalk.gray(`[mcp] loaded from ${mcpPath}`));
    } catch (e: any) {
      console.warn(chalk.yellow("!") + ` failed to parse ${mcpPath}: ${e.message}`);
    }
  }
  const cfg = loadConfig();
  const feats = cfg.features ?? {};
  if (feats.caveman) { plugins.push(makeCavemanPlugin()); console.log(chalk.gray(`[caveman] compression enabled`)); }
  if (feats.rtk) { plugins.push(makeRtkPlugin()); console.log(chalk.gray(`[rtk] compression enabled`)); }

  let llm: LLMProvider;
  try {
    llm = loadProvider({ scripted: opts.scripted });
    // Delegate plugin: spawn sub-agents as isolated processes.
    plugins.push(makeDelegatePlugin());
  } catch (e: any) {
    console.error(chalk.red("✗") + " " + e.message);
    process.exit(1);
  }

  const agent = await buildAgent(llm, {
    config: {
      web: {
        search: opts.webSearch ?? cfg.web?.search ?? false,
        extract: opts.webExtract ?? cfg.web?.extract ?? false,
      },
    },
    plugins,
    onToolCall,
    initialHistory,
  });

  if (opts.prompt) {
    if (opts.verbose) console.log(chalk.gray("→ prompt: " + opts.prompt));

    // Resolve @-references in the prompt before passing to the agent
    const resolvedPrompt = await resolveRefs(opts.prompt);
    if (resolvedPrompt !== opts.prompt && opts.verbose) {
      console.log(chalk.gray("→ refs resolved: " + resolvedPrompt.slice(0, 120) + "..."));
    }

    if (opts.jsonMode) {
      // JSON mode: structured output for scripting
      const startTime = Date.now();
      const reply = await agent.run(resolvedPrompt);
      const elapsed = Date.now() - startTime;
      appendHistory("user", opts.prompt);
      appendHistory("assistant", reply);
      process.stdout.write(JSON.stringify({
        result: reply,
        latency: elapsed,
        turns: 1,
      }, null, 2) + "\n");
      return;
    }

    // Streaming: print chunks as they arrive
    const onChunk = (text: string) => {
      process.stdout.write(chalk.white(text));
    };
    const reply = await agent.run(resolvedPrompt, onChunk);
    // Persist this turn
    appendHistory("user", opts.prompt);
    appendHistory("assistant", reply);
    console.log();
    return;
  }

  // Interactive REPL
  const turnCount = initialHistory.length > 0 ? chalk.gray(`(${savedHistory.length} messages in history) `) : "";
  console.log(chalk.gray("Helix coding agent (helix-agent). ") + turnCount + chalk.gray("Type 'exit' to quit.\n"));
  const rl = readline.createInterface({ input, output });
  while (true) {
    const userInput = await rl.question(chalk.cyan("you> "));
    if (userInput.trim().toLowerCase() === "exit") break;
    if (!userInput.trim()) continue;

    // Resolve @-references before passing to the agent
    const resolvedInput = await resolveRefs(userInput);
    if (resolvedInput !== userInput && opts.verbose) {
      console.log(chalk.gray("→ refs resolved"));
    }

    // Streaming in REPL
    const onChunk = (text: string) => {
      process.stdout.write(chalk.white(text));
    };
    const reply = await agent.run(resolvedInput, onChunk);
    // Persist this turn
    appendHistory("user", userInput);
    appendHistory("assistant", reply);
    console.log("\n");
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
