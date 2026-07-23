// Shared agent builder. Every Helix surface (CLI, TUI, web, Dashboard,
// Desktop) calls `buildAgent` with its provider + config so behaviour is
// identical everywhere. The system prompt + tool set come from `core`.

import { Agent, type LLMProvider, type ChatMessage } from "helix-agent";
import { resolveTools, type HelixConfig, type HelixPlugin } from "./registry.js";

const SYSTEM = [
  "You are Helix, a minimal coding agent that helps with software tasks.",
  "You operate in the user's working directory.",
  "Available tools (YOU MUST use these, never write code in your reply):",
  "- read_file: read a file",
  "- write_file: write/overwrite a file",
  "- list_dir: list a directory",
  "- search_files: find files by name or grep content",
  "- run_bash: run a shell command",
  "- web_search: (if enabled) search the web via self-hosted SearXNG",
  "- web_extract: (if enabled) extract a URL's content via self-hosted Firecrawl-compatible server",
  "",
  "CRITICAL RULES:",
  "- NEVER output code blocks in your reply. Always call a tool instead.",
  "- To create a file, call write_file with the path and content.",
  "- Prefer small, safe steps. Read before you write.",
  "- When you run bash, keep commands non-destructive unless the user asked.",
  "- Use tools to gather facts; then give a concise answer or apply the change.",
  "- Respond in the same language as the user.",
].join("\n");

export async function buildAgent(
  llm: LLMProvider,
  opts?: {
    config?: HelixConfig;
    plugins?: HelixPlugin[];
    onToolCall?: (name: string, input: unknown) => void;
    initialHistory?: ChatMessage[];
  }
): Promise<Agent> {
  const config = opts?.config ?? { web: { search: false, extract: false } };
  const tools = await resolveTools(config, opts?.plugins ?? []);

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
