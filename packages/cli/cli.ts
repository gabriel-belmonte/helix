#!/usr/bin/env node
// helix-agent-cli — a minimal, transparent coding agent on top of helix-agent.

import chalk from "chalk";
import ora from "ora";
import { buildAgent } from "./src/agent.js";
import { loadProvider } from "./src/provider.js";
import { loadConfig, saveConfig, CONFIG_PATH, type HelixConfig } from "./src/config.js";
import { runUpdate } from "./src/update.js";
import { appendHistory, loadHistory, clearHistory } from "./src/history.js";
import type { ChatMessage } from "helix-agent";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
    else if (a === "history" && argv[i + 1] === "clear") {
      opts.historyClear = true;
      i++; // skip "clear"
    }
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
  console.log(`  ${chalk.cyan("helix history clear")}        clear conversation history`);
  console.log(`  ${chalk.cyan("helix update")}               update to latest release\n`);

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

  console.log(chalk.gray("NOTE: API keys are still read from ENV vars (never stored in config)."));
  console.log(chalk.gray("      config holds only provider + model choice."));
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

  const agent = buildAgent(llm, { onToolCall, initialHistory });

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
