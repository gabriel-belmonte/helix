#!/usr/bin/env node
// helix-agent-cli — a minimal, transparent coding agent on top of helix-agent.

import chalk from "chalk";
import ora from "ora";
import { buildAgent, listCredentials, setKey, removeKey, maskSecret, PROVIDER_ENV, AUTH_PATH, ZEN_MODELS, fetchZenModels, isFreeModel, type HelixPlugin } from "helix-core";
import { makeMcpPlugin } from "helix-mcp";
import { loadProvider } from "./src/provider.js";
import { loadConfig, saveConfig, CONFIG_PATH, type HelixConfig } from "./src/config.js";
import { runUpdate } from "./src/update.js";
import { handleEval, type EvalCliOpts } from "./src/eval.js";
import { appendHistory, loadHistory, clearHistory } from "./src/history.js";
import type { ChatMessage } from "helix-agent";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";

interface CliOpts {
  prompt?: string;
  scripted?: boolean;
  cwd?: string;
  verbose?: boolean;
  config?: boolean;
  configKey?: string;
  configVal?: string;
  configGet?: boolean;
  update?: boolean;
  historyClear?: boolean;
  webSearch?: boolean;
  webExtract?: boolean;
  auth?: boolean;
  authAction?: "login" | "logout" | "list";
  authProvider?: string;
  authKey?: string;
  modelsList?: boolean;
  modelsSelect?: boolean;
  modelsSet?: string;
  eval?: boolean;
  evalSuite?: string;
  evalModel?: string;
  evalCompare?: string;
  evalJudge?: string;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" || a === "--prompt") opts.prompt = argv[++i];
    else if (a === "--scripted") opts.scripted = true;
    else if (a === "-v" || a === "--verbose") opts.verbose = true;
    else if (a === "-c" || a === "--cwd") opts.cwd = argv[++i];
    else if (a === "config") {
      opts.config = true;
      const sub = argv[++i];
      if (sub === "set") {
        opts.configKey = argv[++i];
        opts.configVal = argv[++i];
      } else if (sub === "get") {
        opts.configGet = true;
        opts.configKey = argv[++i];
      } else if (sub === "list") {
        opts.configGet = true;
      }
    }
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
    else if (a === "update") opts.update = true;
    else if (a === "auth") {
      opts.auth = true;
      const sub = argv[++i];
      if (sub === "login") {
        opts.authAction = "login";
        opts.authProvider = argv[++i];
        // Optional inline key: `helix auth login zen <key>` (not recommended;
        // prefer the hidden prompt). Also supports `--key <key>`.
        const next = argv[i + 1];
        if (next && next !== "--key" && !next.startsWith("-")) opts.authKey = argv[++i];
        if (argv[i + 1] === "--key") { i++; opts.authKey = argv[++i]; }
      } else if (sub === "logout") {
        opts.authAction = "logout";
        opts.authProvider = argv[++i];
      } else if (sub === "list" || sub === "ls" || sub === undefined) {
        opts.authAction = "list";
      }
    }
    else if (a === "history" && argv[i + 1] === "clear") {
      opts.historyClear = true;
      i++; // skip "clear"
    }
    else if (a === "models") {
      const sub = argv[i + 1];
      if (sub === "select" || sub === "set") {
        opts.modelsSelect = true;
        if (sub === "set" && argv[i + 2] && !argv[i + 2].startsWith("-")) {
          opts.modelsSet = argv[i + 2];
        }
      } else {
        opts.modelsList = true;
      }
    }
    else if (a === "eval") {
      opts.eval = true;
      // `helix eval --suite <file> [--model <slug>] [--compare <slug>] [--judge <slug>]`
      let j = i + 1;
      while (argv[j] && argv[j].startsWith("--")) {
        if (argv[j] === "--suite" && argv[j + 1]) opts.evalSuite = argv[++j];
        else if (argv[j] === "--model" && argv[j + 1]) opts.evalModel = argv[++j];
        else if (argv[j] === "--compare" && argv[j + 1]) opts.evalCompare = argv[++j];
        else if (argv[j] === "--judge" && argv[j + 1]) opts.evalJudge = argv[++j];
        j++;
      }
      i = j - 1;
    }
    else if (a === "--web") opts.webSearch = opts.webExtract = true;
    else if (a === "--web-search") opts.webSearch = true;
    else if (a === "--web-extract") opts.webExtract = true;
  }
  return opts;
}

function printHelp() {
  console.log(chalk.bold("helix") + chalk.gray(" — minimal coding agent CLI (helix-agent)\n"));

  console.log(chalk.bold("USAGE"));
  console.log(`  ${chalk.cyan("helix -p \"prompt\"")}          run a single prompt and exit`);
  console.log(`  ${chalk.cyan("helix")}                        interactive REPL`);
  console.log(`  ${chalk.cyan("helix -v")}                   verbose: show tool calls`);
  console.log(`  ${chalk.cyan("helix config set <k> <v>")}  save a config value`);
  console.log(`  ${chalk.cyan("helix config get [k]")}         show config (or one key)`);
  console.log(`  ${chalk.cyan("helix config list")}            show full config path + values`);
  console.log(`  ${chalk.cyan("helix auth login <provider>")} store an API key (hidden prompt)`);
  console.log(`  ${chalk.cyan("helix auth list")}              show configured keys (masked)`);
  console.log(`  ${chalk.cyan("helix auth logout <provider>")} remove a stored key`);
  console.log(`  ${chalk.cyan("helix history clear")}        clear conversation history`);
  console.log(`  ${chalk.cyan("helix update")}               update to latest release\n`);
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
  console.log(`  ${chalk.cyan("openai")}  OpenAI                              → set provider openai; key=OPENAI_API_KEY\n`);

  console.log(chalk.bold("CONFIG KEYS"));
  console.log(`  ${chalk.cyan("provider")}      one of: zen | hf | openrouter | openai`);
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
  const models = await fetchZenModels().catch(() => ZEN_MODELS);
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
    if (Object.keys(cfg).length === 0) console.log(`  ${chalk.gray("(empty — run `helix config set provider <x>`)")}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

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

  let llm;
  try {
    llm = loadProvider({ scripted: opts.scripted });
  } catch (e: any) {
    console.error(chalk.red("✗") + " " + e.message);
    process.exit(1);
  }

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

  // Load persistent history and seed the agent
  const savedHistory = loadHistory(20);
  const initialHistory: ChatMessage[] = savedHistory.map((e) => ({
    role: e.role,
    content: e.content,
  }));

  // Load MCP servers from ~/.helix/helix.mcp.json or ./helix.mcp.json.
  const plugins: HelixPlugin[] = [];
  const mcpPath = (() => {
    const local = join(process.cwd(), "helix.mcp.json");
    const home = join(homedir(), ".helix", "helix.mcp.json");
    return existsSync(local) ? local : existsSync(home) ? home : null;
  })();
  if (mcpPath) {
    try {
      const raw = JSON.parse(readFileSync(mcpPath, "utf8"));
      const servers = raw.servers ?? raw; // accept {servers:{}} or bare map
      plugins.push(makeMcpPlugin({ servers }));
      console.log(chalk.gray(`[mcp] loaded from ${mcpPath}`));
    } catch (e: any) {
      console.warn(chalk.yellow("!") + ` failed to parse ${mcpPath}: ${e.message}`);
    }
  }

  const agent = await buildAgent(llm, {
    config: {
      web: { search: !!opts.webSearch, extract: !!opts.webExtract },
    },
    plugins,
    onToolCall,
    initialHistory,
  });

  if (opts.prompt) {
    if (opts.verbose) console.log(chalk.gray("→ prompt: " + opts.prompt));
    // Streaming: print chunks as they arrive
    const onChunk = (text: string) => {
      process.stdout.write(chalk.white(text));
    };
    const reply = await agent.run(opts.prompt, onChunk);
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

    // Streaming in REPL
    const onChunk = (text: string) => {
      process.stdout.write(chalk.white(text));
    };
    const reply = await agent.run(userInput, onChunk);
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
