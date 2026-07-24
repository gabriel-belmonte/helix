// Delegate plugin — spawn sub-agents as isolated processes (Pi-style).
//
// Architecture:
//   1. `delegate_task` tool in the parent agent → receives goal + context
//   2. Finds the helix CLI binary (HELIX_BIN env or argv detection)
//   3. Writes task to a temp JSON file
//   4. Spawns `helix submit-task <task.json>` as a child process
//   5. Captures stdout (JSON result)
//   6. Returns structured result to the parent
//
// Modes:
//   single   → one sub-agent, one result (default)
//   parallel → N sub-agents concurrently via Promise.allSettled
//   chain    → sub-agents sequentially, each gets the prior result as context

import { spawnSync, spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

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

  // User agents
  const userDir = join(homedir(), ".helix", "agents");
  try {
    for (const f of readdirSync(userDir)) {
      if (!f.endsWith(".json")) continue;
      const cfg: AgentConfig = JSON.parse(readFileSync(join(userDir, f), "utf-8"));
      cfg.source = "user";
      cfg.filePath = join(userDir, f);
      agents.push(cfg);
    }
  } catch { /* dir may not exist */ }

  // Project agents
  const projectDir = join(cwd, ".helix", "agents");
  try {
    for (const f of readdirSync(projectDir)) {
      if (!f.endsWith(".json")) continue;
      const cfg: AgentConfig = JSON.parse(readFileSync(join(projectDir, f), "utf-8"));
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
  const args = buildArgs(bin, taskFile, resultFile);

  // Spawn
  const proc = spawnSync(args.executable, args.args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, HELIX_SUBAGENT: "1" },
    timeout: 120_000, // 2 min
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  const stdout = proc.stdout?.toString() ?? "";
  const stderr = proc.stderr?.toString() ?? "";

  // Clean up
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

  // Read result file
  return readTaskResult(resultFile, stdout, stderr, proc.status ?? -1);
}

/**
 * Build the executable + args array from a binary spec string.
 * e.g. "bun run cli.ts" → { executable: "bun", args: ["run", "cli.ts", ...] }
 * e.g. "/usr/local/bin/helix" → { executable: "/usr/local/bin/helix", args: [...] }
 */
function buildArgs(
  bin: string,
  taskFile: string,
  resultFile: string
): { executable: string; args: string[] } {
  const args: string[] = [];
  let executable = bin;
  if (bin.includes(" ")) {
    const parts = bin.split(" ");
    executable = parts[0];
    args.push(...parts.slice(1));
  }
  args.push("submit-task", taskFile, "--result", resultFile);
  return { executable, args };
}

/**
 * Read a subtask result from a result file, or synthesize one from raw output.
 */
function readTaskResult(
  resultFile: string,
  stdout: string,
  stderr: string,
  exitCode: number
): SubTaskResult {
  try {
    if (!existsSync(resultFile)) {
      return {
        result: stdout || stderr || "(no output)",
        agent: "sub-agent",
        exitCode,
      };
    }
    const resultData: SubTaskResult = JSON.parse(readFileSync(resultFile, "utf-8"));
    try { rmSync(resultFile, { force: true }); } catch { /* ignore */ }
    return resultData;
  } catch {
    return {
      result: stdout || stderr || "(no output)",
      agent: "sub-agent",
      exitCode,
    };
  }
}

/**
 * Async version of runSubtask — uses spawn() instead of spawnSync() so
 * multiple tasks can run concurrently via Promise.allSettled.
 */
function runSubtaskAsync(input: SubTaskInput): Promise<SubTaskResult> {
  return new Promise((resolve) => {
    const bin = findHelixBin();
    const cwd = process.cwd();

    // Each child gets its own temp dir so parallel tasks don't collide
    const tmpDir = mkdtempSync(join(tmpdir(), "helix-task-"));
    const taskFile = join(tmpDir, "task.json");
    const resultFile = join(tmpDir, "result.json");
    writeFileSync(taskFile, JSON.stringify(input, null, 2));

    const { executable, args } = buildArgs(bin, taskFile, resultFile);

    const proc = spawn(executable, args, {
      cwd,
      stdio: "pipe",
      env: { ...process.env, HELIX_SUBAGENT: "1" },
      timeout: 120_000, // 2 min — Node will kill if exceeded
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("error", () => {
      // Clean up on error
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      resolve({
        result: stderr || "(sub-process error)",
        agent: "sub-agent",
        exitCode: 1,
        error: stderr || "process error",
      });
    });

    proc.on("close", (code) => {
      // Clean up temp dir
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

      const result = readTaskResult(resultFile, stdout, stderr, code ?? -1);
      resolve(result);
    });
  });
}

// ── Plugin factory ───────────────────────────────────────────────

export function makeDelegatePlugin(_llm?: LLMProvider): HelixPlugin {
  const delegateTool: HelixTool = {
    name: "delegate_task",
    description: `Delegate a task to an isolated sub-agent process (Pi-style).

The sub-agent runs in its own process, with its own tools and context.
Use this for tasks that benefit from isolation — sandboxed execution,
parallel work, or long-running analysis.

Modes:
  single   — one sub-agent, returns one result (default)
  parallel — N sub-agents run concurrently via Promise.allSettled.
             Provide an 'agents' array to label each worker; without
             it, 2 instances run with the same goal.
  chain    — sub-agents run sequentially; each gets the prior result
             as additional context. Provide 'agents' to name each step.

Input:
  goal         — what the sub-agent should accomplish (required)
  context      — background info, file paths, constraints (optional)
  mode         — "single" | "parallel" | "chain" (default: "single")
  agents       — array of labels/counts for parallel/chain mode (optional)

Examples:
  Single:  { "goal": "Review src/index.ts", "context": "file: src/index.ts" }
  Parallel: { "goal": "Generate unit tests",
              "mode": "parallel", "agents": ["reviewer", "tester"] }
  Chain:   { "goal": "Refactor this module",
              "mode": "chain", "agents": ["analyzer", "implementer", "reviewer"] }

Returns:
  { result, agent, exitCode, usage, results? }`,

    schema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        context: { type: "string" },
        mode: { type: "string", enum: ["single", "parallel", "chain"] },
        agents: {
          type: "array",
          items: { type: "string" },
          description: "Agent labels for parallel/chain mode — controls how many workers run and how they're named",
        },
      },
      required: ["goal"],
    },
    run: async (input: unknown) => {
      const { goal, context, mode = "single", agents } = input as {
        goal: string; context?: string; mode?: string; agents?: string[];
      };

      if (mode === "parallel") {
        // Parallel mode: spawn N sub-agents concurrently
        // If agents[] is provided, each gets the same goal+context
        // Otherwise spawn 2 instances for parallelism
        const count = agents?.length ?? 2;
        const tasks = Array.from({ length: count }, (_, i) => ({
          goal: agents?.[i]
            ? `[agent: ${agents[i]}] ${goal}`
            : goal,
          context,
        }));

        const results = await Promise.allSettled(
          tasks.map((t) => runSubtaskAsync(t))
        );

        const outputs: SubTaskResult[] = results.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          return {
            result: "",
            agent: agents?.[i] ?? `sub-agent-${i}`,
            exitCode: 1,
            error: r.reason?.message ?? "unknown error",
          };
        });

        // Combine all results into a structured response
        const combined = outputs
          .map(
            (o, i) =>
              `[#${i + 1} ${o.agent}] (exit ${o.exitCode})${o.error ? ` ERROR: ${o.error}` : ""}\n${o.result}`
          )
          .join("\n\n---\n\n");

        return {
          result: combined,
          agent: "parallel-delegation",
          exitCode: outputs.some((o) => o.exitCode !== 0) ? 1 : 0,
          usage: outputs.reduce(
            (acc, o) => {
              if (o.usage) {
                acc.input += o.usage.input;
                acc.output += o.usage.output;
                acc.turns += o.usage.turns;
              }
              return acc;
            },
            { input: 0, output: 0, turns: 0 }
          ),
          results: outputs,
        };
      }

      if (mode === "chain") {
        // Chain mode: pipe each sub-agent's result as context for the next
        const count = agents?.length ?? 2;
        const outputs: SubTaskResult[] = [];
        let accumulatedContext = context ?? "";

        for (let i = 0; i < count; i++) {
          const task: SubTaskInput = {
            goal: agents?.[i]
              ? `[agent: ${agents[i]}] ${goal}`
              : goal,
            context: i === 0 ? context : accumulatedContext,
          };

          const result = await runSubtaskAsync(task);
          outputs.push(result);

          if (result.exitCode === 0 && result.result) {
            accumulatedContext =
              (accumulatedContext ? accumulatedContext + "\n\n" : "") +
              `[Step ${i + 1} output]\n${result.result}`;
          } else {
            accumulatedContext =
              (accumulatedContext ? accumulatedContext + "\n\n" : "") +
              `[Step ${i + 1} FAILED: exit ${result.exitCode}${result.error ? ` — ${result.error}` : ""}]`;
            // Continue chain even on failure — let the next agent see the partial result
          }
        }

        const combined = outputs
          .map(
            (o, i) =>
              `[#${i + 1} ${o.agent}] (exit ${o.exitCode})${o.error ? ` ERROR: ${o.error}` : ""}\n${o.result}`
          )
          .join("\n\n---\n\n");

        return {
          result: combined,
          agent: "chain-delegation",
          exitCode: outputs.some((o) => o.exitCode !== 0) ? 1 : 0,
          usage: outputs.reduce(
            (acc, o) => {
              if (o.usage) {
                acc.input += o.usage.input;
                acc.output += o.usage.output;
                acc.turns += o.usage.turns;
              }
              return acc;
            },
            { input: 0, output: 0, turns: 0 }
          ),
          results: outputs,
        };
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
