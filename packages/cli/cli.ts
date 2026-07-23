#!/usr/bin/env node
// helix-agent-cli — a minimal, transparent coding agent on top of helix-agent.

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
  console.log(`helix — minimal coding agent CLI (helix-agent)

USAGE
  helix -p "prompt"          run a single prompt and exit
  helix                        interactive REPL
  helix -v                   verbose: show tool calls
  helix config set <k> <v>  save a config value
  helix config get [k]         show config (or one key)
  helix config list            show full config path + values
  helix history clear        clear conversation history
  helix update               update to latest release

PROVIDERS (set via config or env)
  zen     OpenCode Zen (free Big Pickle)  → set provider zen; key=OPENCODE_ZEN_API_KEY
  hf      HuggingFace router (free)        → set provider hf;   key=HF_TOKEN
  openrouter  OpenRouter free tier            → set provider openrouter; key=OPENROUTER_API_KEY
  openai  OpenAI                              → set provider openai; key=OPENAI_API_KEY

CONFIG KEYS
  provider      one of: zen | hf | openrouter | openai
  model         model slug (e.g. big-pickle, Qwen/Qwen3-Coder-Next)
  zenBaseUrl   override Zen endpoint
  hfBaseUrl    override HF endpoint

EXAMPLES
  helix config set provider zen
  helix config set model big-pickle
  helix -p "refactor utils.ts to async/await"
  helix -v -p "list files in src/"

NOTE: API keys are still read from ENV vars (never stored in config).
      config holds only provider + model choice.`);
}

function printConfig(cfg: HelixConfig, key?: string) {
  console.log(`config: ${CONFIG_PATH}`);
  if (key) {
    console.log(`  ${key} = ${cfg[key as keyof HelixConfig] ?? "(unset)"}`);
  } else {
    for (const k of Object.keys(cfg) as (keyof HelixConfig)[]) {
      console.log(`  ${String(k)} = ${cfg[k] ?? "(unset)"}`);
    }
    if (Object.keys(cfg).length === 0) console.log("  (empty — run `helix config set provider <x>`)");
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
    console.log("✓ history cleared");
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
      console.log(`✓ saved ${opts.configKey} = ${opts.configVal}`);
      console.log("  (set your API key in the environment, e.g. OPENCODE_ZEN_API_KEY)");
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
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  // Verbose callback: log each tool call in real time
  const onToolCall = opts.verbose
    ? (name: string, input: unknown) => {
        const preview = typeof input === "object" ? JSON.stringify(input) : String(input);
        console.log(`  🔧 ${name}(${preview.length > 120 ? preview.slice(0, 120) + "..." : preview})`);
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
    if (opts.verbose) console.log(`→ prompt: ${opts.prompt}`);
    // Streaming: print chunks as they arrive
    const onChunk = (text: string) => {
      process.stdout.write(text);
    };
    const reply = await agent.run(opts.prompt, onChunk);
    // Persist this turn
    appendHistory("user", opts.prompt);
    appendHistory("assistant", reply);
    console.log();
    return;
  }

  // Interactive REPL
  const turnCount = initialHistory.length > 0 ? `(${savedHistory.length} messages in history) ` : "";
  console.log(`Helix coding agent (helix-agent). ${turnCount}Type 'exit' to quit.\n`);
  const rl = readline.createInterface({ input, output });
  while (true) {
    const userInput = await rl.question("you> ");
    if (userInput.trim().toLowerCase() === "exit") break;
    if (!userInput.trim()) continue;
    const reply = await agent.run(userInput);
    // Persist this turn
    appendHistory("user", userInput);
    appendHistory("assistant", reply);
    console.log(`Helix: ${reply}\n`);
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
