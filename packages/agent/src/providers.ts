// LLM providers for helix-agent.
// Bring your own — helix-agent only needs { complete(messages) => string }.

import type { ChatMessage, LLMProvider } from "./index.js";

// Tool metadata only (no `run`) — the OpenAI provider just needs name +
// description to build the function schema; execution stays in the core Agent.
type ToolMeta = { name: string; description: string };

// A trivial provider for demos/tests. It obeys a tiny script so the
// tool-loop is verifiable without any network or API key.
export function scriptedLLM(script: (turn: number, lastToolResult?: string) => string): LLMProvider {
  let turn = 0;
  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      const lastTool = messages.filter((m) => m.role === "tool").at(-1)?.content;
      const out = script(turn++, lastTool);
      return out;
    },
  };
}

// OpenAI-compatible provider (also works with local LLMs like Ollama/LM Studio
// that expose an OpenAI-style /v1/chat/completions endpoint).
// Native function_calls are converted into helix-agent's @@TOOL@@ marker so the
// core Agent loop stays provider-agnostic.
export function openAIProvider(opts: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  tools?: ToolMeta[];
}): LLMProvider {
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  const model = opts.model ?? "gpt-4o-mini";

  const toolsPayload = (opts.tools ?? []).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: "object", properties: {}, required: [] },
    },
  }));

  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      const body: Record<string, unknown> = {
        model,
        messages,
        tools: toolsPayload.length ? toolsPayload : undefined,
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (msg?.tool_calls?.length) {
        // Convert the first native tool call into helix-agent's marker format.
        const tc = msg.tool_calls[0];
        const name = tc.function?.name;
        const args = tc.function?.arguments ?? "{}";
        return `@@TOOL@@ ${name} ${args}`;
      }

      return msg?.content ?? "";
    },
  };
}
