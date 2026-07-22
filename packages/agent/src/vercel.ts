// helix-agent/vercel — Adapter to use Vercel AI SDK as the LLM provider.
//
// This lets you use ANY Vercel AI SDK provider (OpenAI, Anthropic, Google,
// Mistral, etc.) with helix-agent's Agent loop.
//
// Usage:
//   import { Agent } from "helix-agent";
//   import { vercelProvider } from "helix-agent/vercel";
//   import { openai } from "@ai-sdk/openai";
//
//   const agent = new Agent({
//     llm: vercelProvider({ model: openai("gpt-4o") }),
//     tools: [...],
//   });

import type { LLMProvider, ChatMessage } from "./index.js";

// Vercel AI SDK's LanguageModel type (we don't import it directly to keep
// this as a peer-dependency adapter — users install `ai` themselves).
type LanguageModel = any;

export type VercelProviderOpts = {
  /** A Vercel AI SDK model instance (e.g. openai("gpt-4o"), anthropic("claude-sonnet-4-20250514")). */
  model: LanguageModel;
  /** Max retries on transient errors. Default 2. */
  maxRetries?: number;
};

// Convert helix messages → Vercel AI SDK format (cast to avoid strict type issues)
function toVercelMessages(messages: ChatMessage[]): any[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

/**
 * Create an LLMProvider backed by Vercel AI SDK.
 *
 * This adapter:
 * 1. Converts helix ChatMessage[] → Vercel prompt format
 * 2. Calls generateText() with the model
 * 3. Returns the text response
 * 4. Handles retries for transient errors
 */
export function vercelProvider(opts: VercelProviderOpts): LLMProvider {
  const { model, maxRetries = 2 } = opts;

  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      // Dynamic import so `ai` is optional at the engine level.
      // Users who use vercelProvider MUST have `ai` installed.
      const { generateText } = await import("ai");

      const systemMsg = messages.find((m) => m.role === "system");

      const result = await generateText({
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages) as any,
        maxRetries,
      });

      return result.text;
    },
  };
}

/**
 * Create an LLMProvider with Vercel's native tool calling.
 *
 * Unlike vercelProvider(), this passes tools to Vercel's generateText()
 * so the model can use native function calling. Tool calls are converted
 * to @@TOOL@@ markers for helix-agent's Agent loop.
 *
 * Usage:
 *   import { vercelToolProvider } from "helix-agent/vercel";
 *   import { openai } from "@ai-sdk/openai";
 *   import { z } from "zod";
 *
 *   const agent = new Agent({
 *     llm: vercelToolProvider({
 *       model: openai("gpt-4o"),
 *       tools: [
 *         { name: "read_file", description: "Read a file", parameters: z.object({ path: z.string() }) },
 *       ],
 *     }),
 *     tools: [...],
 *   });
 */
export function vercelToolProvider(
  opts: VercelProviderOpts & {
    tools: Array<{ name: string; description: string; parameters: any }>;
  }
): LLMProvider {
  const { model, tools, maxRetries = 2 } = opts;

  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      const { generateText, isStepCount } = await import("ai");

      const systemMsg = messages.find((m) => m.role === "system");

      // Convert helix tool format → Vercel tool format
      const vercelTools: Record<string, any> = {};
      for (const t of tools) {
        vercelTools[t.name] = {
          description: t.description,
          parameters: t.parameters,
        };
      }

      const result = await generateText({
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages) as any,
        tools: vercelTools,
        stopWhen: isStepCount(1), // Let helix-agent handle the loop
        maxRetries,
      });

      // Convert native tool calls → @@TOOL@@ markers
      if (result.toolCalls?.length) {
        return result.toolCalls
          .map((tc: any) => `@@TOOL@@ ${tc.toolName} ${JSON.stringify(tc.args)}`)
          .join("\n");
      }

      return result.text;
    },
  };
}
