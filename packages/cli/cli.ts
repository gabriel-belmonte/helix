#!/usr/bin/env node
// helix-agent-cli — a minimal, transparent coding agent on top of helix-agent.

import { buildAgent } from "./src/agent.js";
import { loadProvider } from "./src/provider.js";
import { loadConfig, saveConfig, CONFIG_PATH, type HelixConfig } from "./src/config.js";
import { runUpdate } from "./src/update.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

interface CliOpts {
  prompt?: string;
  scripted?: boolean;
  cwd?: string;
  config?: boolean;
  configKey?: string;
  configVal?: string;
  configGet?: boolean;
  update?: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" || a === "--prompt") opts.prompt = argv[++i];
    else if (a === "--scripted") opts.scripted = true;
    else if (a === "-c" || a === "--cwd") opts.cwd = argv[++i];
    else if (a === "config") {
      opts.config = true;
      // next tokens until a flag: set <key> <val> | get [key]
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
  }
  return opts;
}

function printHelp() {
  console.log(`helix — minimal coding agent CLI (helix-agent)

USAGE
  helix -p "prompt"          run a single prompt and exit
  helix                        interactive REPL
  helix config set <k> <v>  save a config value
  helix config get [k]         show config (or one key)
  helix config list            show full config path + values
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

  const agent = buildAgent(llm);

  if (opts.prompt) {
    const reply = await agent.run(opts.prompt);
    console.log(`\nHelix: ${reply}`);
    return;
  }

  // Interactive REPL
  console.log("Helix coding agent (helix-agent). Type 'exit' to quit.\n");
  const rl = readline.createInterface({ input, output });
  while (true) {
    const userInput = await rl.question("you> ");
    if (userInput.trim().toLowerCase() === "exit") break;
    if (!userInput.trim()) continue;
    const reply = await agent.run(userInput);
    console.log(`Helix: ${reply}\n`);
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
