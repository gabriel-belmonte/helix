// Shared agent builder. Every Helix surface (CLI, TUI, web, Dashboard,
// Desktop) calls `buildAgent` with its provider + config so behaviour is
// identical everywhere. The system prompt + tool set come from `core`.

import { Agent, type LLMProvider, type ChatMessage, type Tool } from "helix-agent";
import { resolveTools, type HelixConfig, type HelixPlugin } from "./registry.js";
import {
  discoverSkills,
  renderSkillGuidance,
  makeSkillTool,
  type HelixSkill,
} from "./skill.js";
import { makeMemoryTools, readSoul } from "helix-memory";

// Default skill directories: evaluated lazily so process.cwd() is current.
import { homedir } from "node:os";
import { join } from "node:path";

function defaultSkillDirs(): string[] {
  const cwd = process.cwd();
  return [
    join(homedir(), ".helix", "skills"),
    join(cwd, "skills"),
    join(homedir(), ".claude", "skills"),
    join(cwd, ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
    join(cwd, ".agents", "skills"),
  ];
}

// Build the tool-list section of the system prompt from the actual tools.
function renderToolList(tools: Tool[]): string {
  const lines = tools.map((t) => {
    let line = `- ${t.name}: ${t.description}`;
    if (t.schema && (t.schema as any).properties) {
      const props = Object.keys((t.schema as any).properties);
      if (props.length) line += ` (params: ${props.join(", ")})`;
    }
    return line;
  });
  return [
    "Available tools (YOU MUST use these, never write code in your reply):",
    ...lines,
  ].join("\n");
}

export async function buildAgent(
  llm: LLMProvider,
  opts?: {
    config?: HelixConfig;
    plugins?: HelixPlugin[];
    onToolCall?: (name: string, input: unknown) => void;
    initialHistory?: ChatMessage[];
    // Extra skill directories to scan (e.g. a user-provided path).
    skillDirs?: string[];
    /** Override tool set (instead of resolving from config/plugins). */
    tools?: Tool[];
  }
): Promise<Agent> {
  const config = opts?.config ?? { web: { search: false, extract: false } };
  const tools = opts?.tools ?? await resolveTools(config, opts?.plugins ?? []);

  // Skills: discover + add the `use_skill` tool + guidance block.
  const skillDirs = [...defaultSkillDirs(), ...(opts?.skillDirs ?? [])];
  const skills: HelixSkill[] = discoverSkills(skillDirs);
  const allTools: Tool[] = [...tools, ...makeSkillTool(skills), ...makeMemoryTools()];

  // Persona (human-authored soul.md) + accumulated memory context.
  const soul = readSoul();
  const soulBlock = soul ? `\n\n# Persona (soul.md)\n${soul}` : "";

  const SYSTEM = [
    "You are Helix, a minimal coding agent that helps with software tasks.",
    "You operate in the user's working directory.",
    renderToolList(allTools),
    "",
    "CRITICAL RULES:",
    "- NEVER output code blocks in your reply. Always call a tool instead.",
    "- To create a file, call write_file with the path and content.",
    "- Prefer small, safe steps. Read before you write.",
    "- When you run bash, keep commands non-destructive unless the user asked.",
    "- Use tools to gather facts; then give a concise answer or apply the change.",
    "- Respond in the same language as the user.",
    "- You have memory tools (remember/recall/reflect). Use `remember` to persist",
    "  durable facts, preferences, or decisions so you don't ask again next session.",
    soulBlock,
  ].join("\n");

  const systemWithSkills = skills.length
    ? SYSTEM + "\n\n" + renderSkillGuidance(skills)
    : SYSTEM;

  return new Agent({
    name: "Helix",
    system: systemWithSkills,
    llm,
    tools: allTools,
    maxSteps: 8,
    onToolCall: opts?.onToolCall,
    initialHistory: opts?.initialHistory,
  });
}
