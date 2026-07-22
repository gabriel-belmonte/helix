// LLM providers for helix-agent.
// Bring your own — helix-agent only needs { complete(messages) => string }.

import type { ChatMessage, LLMProvider } from "./index.js";

// Tool metadata only (no `run`) — the OpenAI provider just needs name +
// description to build the function schema; execution stays in the core Agent.
type ToolMeta = { name: string; description: string };

export type RetryOpts = {
  maxRetries?: number;    // default 2
  backoffMs?: number;     // initial backoff, default 1000
};

// A trivial provider for demos/tests. It obeys a tiny script so the
// tool-loop is verifiable without any network or API key.
export function scriptedLLM(
  script: (turn: number, lastToolResult?: string) => string
): LLMProvider {
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
export function openAIProvider(
  opts: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    tools?: ToolMeta[];
  } & RetryOpts
): LLMProvider {
  const baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  const model = opts.model ?? "gpt-4o-mini";
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 1000;

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
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = backoffMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }

        try {
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
            const errText = await res.text();
            // Don't retry on 4xx (client errors) except 429 (rate limit)
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
              throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
            }
            throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
          }

          const data = (await res.json()) as any;
          const choice = data.choices?.[0];
          const msg = choice?.message;

          if (msg?.tool_calls?.length) {
            // Convert native tool calls into helix-agent's marker format.
            // Support multiple tool calls per turn (one per line).
            const markers = msg.tool_calls.map((tc: any) => {
              const name = tc.function?.name;
              const args = tc.function?.arguments ?? "{}";
              return `@@TOOL@@ ${name} ${args}`;
            });
            return markers.join("\n");
          }

          return msg?.content ?? "";
        } catch (e: any) {
          lastError = e;
          // Don't retry on client errors
          if (e.message.includes("failed: 4")) {
            throw e;
          }
        }
      }

      throw lastError ?? new Error("request failed after retries");
    },
  };
}
