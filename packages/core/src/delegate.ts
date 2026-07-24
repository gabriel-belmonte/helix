// Delegate plugin — spawn sub-agents as isolated processes (Pi-style).
//
// Architecture:
//   1. `delegate_task` tool in the parent agent → receives goal + context
//   2. Finds the helix CLI binary (HELIX_BIN env or argv detection)
//   3. Writes task to a temp JSON file
//   4. Spawns `helix submit-task <task.json>` as a child process
//   5. Captures stdout (JSON result)
//   6. Returns structured result to the parent

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { HelixPlugin, HelixTool } from "./registry.js";
import type { LLMProvider } from "helix-agent";

// ── Agent discovery ──────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  /** Tools the sub-agent can use. Default: read-only */
  tools?: string[];
  /** Model override (e.g. "zen:deepseek-v4-flash-free") */
  model?: string;
  source: "user" | "project";
  filePath: string;
}

/**
 * Discover agent configurations from:
 *   ~/.helix/agents/*.json  (user-level, reusable agents)
 *   .helix/agents/*.json    (project-level, per-repo agents)
 */
export function discoverAgents(cwd: string): AgentConfig[] {
  const agents: AgentConfig[] = [];
  const fs = require("node:fs");
  const os = require("node:os");

  // User agents
  const userDir = join(os.homedir(), ".helix", "agents");
  try {
    for (const f of fs.readdirSync(userDir)) {
      if (!f.endsWith(".json")) continue;
      const cfg: AgentConfig = JSON.parse(fs.readFileSync(join(userDir, f), "utf-8"));
      cfg.source = "user";
      cfg.filePath = join(userDir, f);
      agents.push(cfg);
    }
  } catch { /* dir may not exist */ }

  // Project agents
  const projectDir = join(cwd, ".helix", "agents");
  try {
    for (const f of fs.readdirSync(projectDir)) {
      if (!f.endsWith(".json")) continue;
      const cfg: AgentConfig = JSON.parse(fs.readFileSync(join(projectDir, f), "utf-8"));
      cfg.source = "project";
      cfg.filePath = join(projectDir, f);
      agents.push(cfg);
    }
  } catch { /* dir may not exist */ }

  return agents;
}

// ── Binary discovery ─────────────────────────────────────────────

function findHelixBin(): string {
  // 1. Explicit env override
  const envBin = process.env.HELIX_BIN;
  if (envBin) return envBin;

  // 2. Same directory as current script (compiled binary)
  const argv = process.argv[1];
  if (argv && !argv.includes("node_modules")) {
    return argv;
  }

  // 3. In development (bun run)
  return "bun run cli.ts";
}

// ── Task I/O ─────────────────────────────────────────────────────

export interface SubTaskInput {
  goal: string;
  context?: string;
  tools?: string[];
  model?: string;
}

export interface SubTaskResult {
  result: string;
  agent: string;
  exitCode: number;
  usage?: {
    input: number;
    output: number;
    turns: number;
  };
  error?: string;
}

function runSubtask(input: SubTaskInput): SubTaskResult {
  const bin = findHelixBin();
  const cwd = process.cwd();

  // Write task to a temp file
  const tmpDir = mkdtempSync(join(tmpdir(), "helix-task-"));
  const taskFile = join(tmpDir, "task.json");
  const resultFile = join(tmpDir, "result.json");
  writeFileSync(taskFile, JSON.stringify(input, null, 2));

  // Build args
  const args: string[] = [];
  let executable = bin;
  if (bin.includes(" ")) {
    // e.g. "bun run cli.ts"
    const parts = bin.split(" ");
    executable = parts[0];
    args.push(...parts.slice(1));
  }
  args.push("submit-task", taskFile, "--result", resultFile);

  // Spawn
  const proc = spawnSync(executable, args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, HELIX_SUBAGENT: "1" },
    timeout: 120_000, // 2 min
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();

  // Clean up
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

  // Read result file
  try {
    const resultData: SubTaskResult = JSON.parse(readFileSync(resultFile, "utf-8"));
    try { rmSync(resultFile, { force: true }); } catch { /* ignore */ }
    return resultData;
  } catch {
    // Result file not written — return raw output
    return {
      result: stdout || stderr || "(no output)",
      agent: "sub-agent",
      exitCode: proc.status ?? -1,
    };
  }
}

// ── Plugin factory ───────────────────────────────────────────────

export function makeDelegatePlugin(_llm?: LLMProvider): HelixPlugin {
  const delegateTool: HelixTool = {
    name: "delegate_task",
    description: `Delegate a task to an isolated sub-agent process (Pi-style).

The sub-agent runs in its own process, with its own tools and context.
Use this for tasks that benefit from isolation — sandboxed execution,
parallel work, or long-running analysis.

Input:
  goal         — what the sub-agent should accomplish (required)
  context      — background info, file paths, constraints (optional)
  mode         — "single" | "parallel" | "chain" (default: "single")
  agents       — array of agent names for parallel/chain mode (optional)

Example:
  { "goal": "Review the code in src/index.ts for bugs",
    "context": "file path: src/index.ts" }

Returns:
  { result, agent, exitCode, usage }`,
    schema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        context: { type: "string" },
        mode: { type: "string", enum: ["single", "parallel", "chain"] },
        agents: { type: "array", items: { type: "string" } },
      },
      required: ["goal"],
    },
    run: async (input: unknown) => {
      const { goal, context, mode = "single" } = input as {
        goal: string; context?: string; mode?: string; agents?: string[];
      };

      if (mode === "parallel") {
        return { error: "parallel mode not yet implemented" };
      }
      if (mode === "chain") {
        return { error: "chain mode not yet implemented" };
      }

      const task: SubTaskInput = { goal, context };
      const result = runSubtask(task);
      return {
        result: result.result,
        agent: result.agent,
        exitCode: result.exitCode,
        usage: result.usage,
      };
    },
  };

  return {
    name: "delegate",
    register(ctx) {
      ctx.registry.override(delegateTool);
    },
  };
}
