// helix-agent — minimal agent orchestration SDK (usable core)
// Lightweight, transparent alternative to heavy agent frameworks.

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type Tool = {
  name: string;
  description: string;
  run: (input: unknown) => Promise<unknown>;
};

export type LLMProvider = {
  // Receives the full message history; returns the model's text reply.
  // If the model wants to call a tool, it should emit the marker:
  //   @@TOOL@@ <name> <json-or-empty>
  // (openAIProvider converts native function_calls into this marker for you.)
  complete: (messages: ChatMessage[]) => Promise<string>;
};

export type AgentOptions = {
  name: string;
  system: string;
  llm: LLMProvider;
  tools?: Tool[];
  // Max tool-call iterations per run() to avoid infinite loops. Default 5.
  maxSteps?: number;
};

// Marker the model uses to request a tool invocation.
export const TOOL_MARKER = "@@TOOL@@";

// Parse a tool-call input payload, tolerating non-JSON.
function parseInput(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export class Agent {
  name: string;
  private system: string;
  private llm: LLMProvider;
  private tools: Map<string, Tool>;
  private maxSteps: number;
  private history: ChatMessage[] = [];

  constructor(opts: AgentOptions) {
    this.name = opts.name;
    this.system = opts.system;
    this.llm = opts.llm;
    this.tools = new Map((opts.tools ?? []).map((t) => [t.name, t]));
    this.maxSteps = opts.maxSteps ?? 5;
  }

  private parseToolCall(text: string): { name: string; input: unknown } | null {
    // Format 1: @@TOOL@@ <name> <json>
    const markerIdx = text.lastIndexOf(TOOL_MARKER);
    if (markerIdx !== -1) {
      const rest = text.slice(markerIdx + TOOL_MARKER.length).trim();
      const space = rest.indexOf(" ");
      const name = (space === -1 ? rest : rest.slice(0, space)).trim();
      const raw = space === -1 ? "" : rest.slice(space + 1).trim();
      return { name, input: parseInput(raw) };
    }

    // Format 2: <tool_call>name<arg_key>k</arg_key><arg_value>v</arg_value>...</tool_call>
    const tc = text.match(/<tool_call>\s*([\w-]+)\s*([\s\S]*?)<\/tool_call>/);
    if (tc) {
      const name = tc[1].trim();
      const argBlock = tc[2];
      const input: Record<string, string> = {};
      const re = /<arg_key>(.*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(argBlock)) !== null) input[m[1]] = m[2];
      return { name, input };
    }

    // Format 3: ```json tool call style { "name": "...", "input": {...} }
    const jsonBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonBlock) {
      try {
        const obj = JSON.parse(jsonBlock[1]);
        if (obj && obj.name && obj.input !== undefined) {
          return { name: String(obj.name), input: obj.input };
        }
      } catch { /* ignore */ }
    }

    // Format 4: <name>\n```json { ... } (model names tool then JSON)
    const named = text.match(/([\w-]+)\s*```json\s*(\{[\s\S]*?\})\s*```/);
    if (named) {
      try {
        return { name: named[1].trim(), input: JSON.parse(named[2]) };
      } catch { /* ignore */ }
    }

    // Format 5: Anthropic-style <tool_call><function=name><parameter=k>v</parameter>
    const tc5 = text.match(/<tool_call>\s*<function=([\w-]+)>\s*([\s\S]*?)<\/function>\s*<\/tool_call>/);
    if (tc5) {
      const name = tc5[1].trim();
      const argBlock = tc5[2];
      const input: Record<string, string> = {};
      const re5 = /<parameter=([\w-]+)>([\s\S]*?)<\/parameter>/g;
      let m5: RegExpExecArray | null;
      while ((m5 = re5.exec(argBlock)) !== null) input[m5[1]] = m5[2];
      return { name, input };
    }

    // Format 6: <tool_invocation name="x" arguments={...} />
    const tc6 = text.match(/<tool_invocation\s+name="([\w-]+)"\s+arguments=(\{[\s\S]*?\})\s*\/>/);
    if (tc6) {
      try {
        return { name: tc6[1].trim(), input: JSON.parse(tc6[2]) };
      } catch { /* ignore */ }
    }

    // Format 7 (universal fallback): any known tool name mentioned, with
    // path/content extracted loosely from the text (handles erratic models).
    const loose = text.match(/\b(write_file|read_file|list_dir|run_bash)\b/);
    if (loose) {
      const name = loose[1];
      const input: Record<string, string> = {};
      const pathM = text.match(/("path"|path)\s*[:=]\s*"?([^"\n,}>]+)"?/);
      if (pathM) input.path = pathM[2].trim().replace(/^["']|["']$/g, "");
      const contentM = text.match(/("content"|content)\s*[:=]\s*"?([^"\n,}>]+)"?/);
      if (contentM) input.content = contentM[2].trim().replace(/^["']|["']$/g, "");
      const cmdM = text.match(/("command"|command)\s*[:=]\s*"?([^"\n,}>]+)"?/);
      if (cmdM) input.command = cmdM[2].trim().replace(/^["']|["']$/g, "");
      if (Object.keys(input).length || name === "list_dir") {
        return { name, input };
      }
    }

    return null;
  }

  /** Run one user turn through the agent (multi-turn + tool loop). */
  async run(userMessage: string): Promise<string> {
    this.history.push({ role: "user", content: userMessage });

    const messages: ChatMessage[] = [
      { role: "system", content: this.system },
      ...this.history,
    ];

    let reply = await this.llm.complete(messages);

    for (let step = 0; step < this.maxSteps; step++) {
      const call = this.parseToolCall(reply);
      if (!call) break;

      const tool = this.tools.get(call.name);
      let result: string;
      if (!tool) {
        result = `Error: unknown tool "${call.name}"`;
      } else {
        try {
          const out = await tool.run(call.input);
          result = JSON.stringify(out);
        } catch (e) {
          result = `Error: ${(e as Error).message}`;
        }
      }

      const toolMsg = `Result of ${call.name}: ${result}`;

      // Last allowed step: return the tool result directly so an infinite
      // tool-loop still yields something useful instead of a raw marker.
      if (step === this.maxSteps - 1) {
        this.history.push({ role: "assistant", content: reply });
        this.history.push({ role: "tool", content: toolMsg });
        this.history.push({ role: "assistant", content: toolMsg });
        return toolMsg;
      }

      // Feed the tool result back into the conversation and continue.
      this.history.push({ role: "assistant", content: reply });
      this.history.push({ role: "tool", content: toolMsg });

      reply = await this.llm.complete([
        { role: "system", content: this.system },
        ...this.history,
      ]);
    }

    this.history.push({ role: "assistant", content: reply });
    return reply;
  }

  /** Reset conversation memory. */
  reset(): void {
    this.history = [];
  }
}

export function defineTool<TIn, TOut>(
  name: string,
  description: string,
  run: (input: TIn) => Promise<TOut>
): Tool {
  return { name, description, run: run as (i: unknown) => Promise<unknown> };
}

// Providers live in providers.ts but are part of the public SDK surface.
export { scriptedLLM, openAIProvider } from "./providers.js";

