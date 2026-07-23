// helix-agent — minimal agent orchestration SDK
// Lightweight, transparent alternative to heavy agent frameworks.
//
// DESIGN:
//   The LLM emits tool calls via the @@TOOL@@ marker.
//   Providers (openAIProvider, etc.) convert native function_calls into this
//   marker so the core Agent stays provider-agnostic.
//   Text-based format parsers (<tool_call>, JSON blocks, etc.) are NOT included —
//   that's the provider's job, not the engine's.

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type Tool = {
  name: string;
  description: string;
  run: (input: unknown) => Promise<unknown>;
  // Optional JSON-schema describing the tool's input. Used by MCP and other
  // structured-tool sources so the model knows the parameters. When present,
  // it is surfaced in the system prompt; when absent, free-form input is used.
  schema?: Record<string, unknown>;
};

export type LLMProvider = {
  // Receives the full message history; returns the model's text reply.
  // If the model wants to call tools, it should emit markers:
  //   @@TOOL@@ <name> <json-or-empty>
  // (one per tool call; providers convert native function_calls for you.)
  complete: (messages: ChatMessage[]) => Promise<string>;
  // Optional streaming variant. If provided, the agent will use this
  // instead of complete() when available. Chunks are text deltas.
  stream?: (messages: ChatMessage[], onChunk: (text: string) => void) => Promise<string>;
};

export type AgentOptions = {
  name: string;
  system: string;
  llm: LLMProvider;
  tools?: Tool[];
  // Max tool-call iterations per run() to avoid infinite loops. Default 5.
  maxSteps?: number;
  // Called for each tool invocation. Useful for --verbose logging.
  onToolCall?: (name: string, input: unknown) => void;
  // Seed conversation history (e.g. from persistent REPL history).
  initialHistory?: ChatMessage[];
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
  private onToolCall?: (name: string, input: unknown) => void;
  private history: ChatMessage[] = [];

  constructor(opts: AgentOptions) {
    this.name = opts.name;
    this.system = opts.system;
    this.llm = opts.llm;
    this.tools = new Map((opts.tools ?? []).map((t) => [t.name, t]));
    this.maxSteps = opts.maxSteps ?? 5;
    this.onToolCall = opts.onToolCall;
    if (opts.initialHistory) {
      this.history = [...opts.initialHistory];
    }
  }

  /**
   * Parse ALL @@TOOL@@ markers from a reply.
   * Returns an array because modern models can request multiple tools per turn.
   */
  private parseToolCalls(text: string): { name: string; input: unknown }[] {
    const calls: { name: string; input: unknown }[] = [];
    const marker = TOOL_MARKER;
    let searchFrom = 0;

    while (true) {
      const idx = text.indexOf(marker, searchFrom);
      if (idx === -1) break;

      const rest = text.slice(idx + marker.length).trim();
      const space = rest.indexOf(" ");
      const name = (space === -1 ? rest : rest.slice(0, space)).trim();
      const raw = space === -1 ? "" : rest.slice(space + 1).trim();

      if (name) {
        calls.push({ name, input: parseInput(raw) });
      }

      searchFrom = idx + marker.length + rest.length;
    }

    return calls;
  }

  /** Execute a single tool call and return the result string. */
  private async execTool(call: { name: string; input: unknown }): Promise<string> {
    this.onToolCall?.(call.name, call.input);

    const tool = this.tools.get(call.name);
    if (!tool) {
      return `Error: unknown tool "${call.name}"`;
    }
    try {
      const out = await tool.run(call.input);
      return JSON.stringify(out);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  }

  /** Run one user turn through the agent (multi-turn + tool loop). */
  async run(
    userMessage: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    this.history.push({ role: "user", content: userMessage });

    let reply = await this._callLLM(onChunk);

    for (let step = 0; step < this.maxSteps; step++) {
      const calls = this.parseToolCalls(reply);
      if (calls.length === 0) break;

      // Execute all tool calls from this turn
      const results: string[] = [];
      for (const call of calls) {
        results.push(await this.execTool(call));
      }

      // Build tool result messages
      const toolMsgs = results.map(
        (r, i) => `Result of ${calls[i].name}: ${r}`
      );

      // On the last allowed step, return the tool results directly
      if (step === this.maxSteps - 1) {
        this.history.push({ role: "assistant", content: reply });
        for (const msg of toolMsgs) {
          this.history.push({ role: "tool", content: msg });
        }
        this.history.push({ role: "assistant", content: toolMsgs.join("\n") });
        return toolMsgs.join("\n");
      }

      // Feed tool results back and continue the loop
      this.history.push({ role: "assistant", content: reply });
      for (const msg of toolMsgs) {
        this.history.push({ role: "tool", content: msg });
      }

      reply = await this._callLLM(onChunk);
    }

    this.history.push({ role: "assistant", content: reply });
    return reply;
  }

  /** Internal: call LLM with streaming support if available. */
  private async _callLLM(onChunk?: (text: string) => void): Promise<string> {
    const messages = [
      { role: "system" as const, content: this.system },
      ...this.history,
    ];

    if (this.llm.stream && onChunk) {
      return this.llm.stream(messages, onChunk);
    }

    return this.llm.complete(messages);
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
