// Wires the helix-agent Agent with the coding-agent system prompt and tools.

import { Agent, type LLMProvider, type ChatMessage } from "helix-agent";
import { tools } from "./tools.js";

const SYSTEM = [
  "You are Helix, a minimal coding agent that helps with software tasks.",
  "You operate in the user's working directory.",
  "Available tools (YOU MUST use these, never write code in your reply):",
  "- read_file: read a file",
  "- write_file: write/overwrite a file",
  "- list_dir: list a directory",
  "- search_files: find files by name or grep content",
  "- run_bash: run a shell command",
  "",
  "CRITICAL RULES:",
  "- NEVER output code blocks in your reply. Always call a tool instead.",
  "- To create a file, call write_file with the path and content.",
  "- Prefer small, safe steps. Read before you write.",
  "- When you run bash, keep commands non-destructive unless the user asked.",
  "- Use tools to gather facts; then give a concise answer or apply the change.",
  "- Respond in the same language as the user.",
].join("\n");

export function buildAgent(
  llm: LLMProvider,
  opts?: {
    onToolCall?: (name: string, input: unknown) => void;
    initialHistory?: ChatMessage[];
  }
): Agent {
  return new Agent({
    name: "Helix",
    system: SYSTEM,
    llm,
    tools,
    maxSteps: 8,
    onToolCall: opts?.onToolCall,
    initialHistory: opts?.initialHistory,
  });
}
