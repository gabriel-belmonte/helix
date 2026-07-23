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

// Vercel AI SDK types (we use any here since ai is a peer dependency)
type LanguageModel = any;

export type VercelProviderOpts = {
  /** A Vercel AI SDK model instance (e.g. openai("gpt-4o"), anthropic("claude-sonnet-4-20250514")). */
  model: LanguageModel;
  /** Max retries on transient errors. Default 2. */
  maxRetries?: number;
  /**
   * Tools to expose for native function calling.
   * When provided, Vercel's generateText/streamText passes them to the API
   * as native function definitions. Tool calls are converted to @@TOOL@@ markers.
   */
  tools?: Array<{
    name: string;
    description: string;
    /** JSON Schema object (NOT a Zod schema — use toJSON() if needed). */
    parameters?: Record<string, unknown>;
  }>;
};

// Convert helix messages → Vercel AI SDK format.
// AI SDK v7 is very strict about tool message format. To avoid complex
// conversion, we fold tool results into the following user message.
function toVercelMessages(messages: ChatMessage[]): any[] {
  const result: any[] = [];
  let pendingToolResults: string[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      pendingToolResults.push(m.content);
      continue;
    }

    // Before a user/assistant message, prepend any pending tool results.
    if (pendingToolResults.length > 0) {
      const toolBlock = "Tool results:\n" + pendingToolResults.join("\n");
      // Merge into the next user message if possible, or add a synthetic one.
      if (m.role === "user") {
        result.push({ role: "user", content: toolBlock + "\n\n" + m.content });
      } else {
        result.push({ role: "user", content: toolBlock });
        result.push({ role: m.role, content: m.content });
      }
      pendingToolResults = [];
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }

  // Flush remaining tool results (shouldn't happen, but be safe).
  if (pendingToolResults.length > 0) {
    result.push({ role: "user", content: "Tool results:\n" + pendingToolResults.join("\n") });
  }

  return result;
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
      const ai = await import("ai");
      const systemMsg = messages.find((m) => m.role === "system");

      const result = await ai.generateText({
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages),
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
      const ai = await import("ai");
      const systemMsg = messages.find((m) => m.role === "system");

      // Convert helix tool format → Vercel tool format
      const vercelTools: Record<string, any> = {};
      for (const t of tools) {
        vercelTools[t.name] = {
          description: t.description,
          parameters: t.parameters,
        };
      }

      const result = await ai.generateText({
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages),
        tools: vercelTools,
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

/**
 * Create a streaming LLMProvider backed by Vercel AI SDK.
 *
 * Uses streamText() for real-time text streaming. Chunks are passed
 * to the onChunk callback as they arrive. Tool calls are converted
 * to @@TOOL@@ markers for helix-agent's Agent loop.
 *
 * Usage:
 *   import { vercelStreamingProvider } from "helix-agent/vercel";
 *   import { openai } from "@ai-sdk/openai";
 *
 *   const agent = new Agent({
 *     llm: vercelStreamingProvider({ model: openai("gpt-4o") }),
 *     tools: [...],
 *   });
 *
 *   // In your app:
 *   const reply = await agent.run("Hello", (chunk) => {
 *     process.stdout.write(chunk);
 *   });
 */
export function vercelStreamingProvider(opts: VercelProviderOpts): LLMProvider {
  const { model, maxRetries = 2, tools } = opts;

  // Prepare Vercel tools format (plain JSON Schema, no Zod needed).
  const vercelTools: Record<string, any> | undefined = tools?.length
    ? Object.fromEntries(
        tools.map((t) => [
          t.name,
          { description: t.description, parameters: t.parameters },
        ])
      )
    : undefined;

  return {
    async complete(messages: ChatMessage[]): Promise<string> {
      const ai = await import("ai");
      const systemMsg = messages.find((m) => m.role === "system");
      const generateOpts: any = {
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages),
        maxRetries,
      };
      if (vercelTools) generateOpts.tools = vercelTools;

      const result = await ai.generateText(generateOpts);

      // Convert native tool calls → @@TOOL@@ markers
      if (result.toolCalls?.length) {
        return result.toolCalls
          .map((tc: any) => `@@TOOL@@ ${tc.toolName} ${JSON.stringify(tc.args)}`)
          .join("\n");
      }

      // Fallback: parse XML-style tool calls from the text (common on OpenAI-compatible APIs)
      const text = result.text;
      const xmlToolCallRE = /<tool_call>\s*<function[=> ]+([^\s>]+)\s*>?\s*(.*?)\s*<\/function>\s*<\/tool_call>/gs;
      let match: RegExpExecArray | null;
      const toolResults: string[] = [];
      let lastIndex = 0;

      while ((match = xmlToolCallRE.exec(text)) !== null) {
        const name = match[1];
        let rawArgs = match[2].trim();
        // Try to extract parameters from nested <parameter> tags
        const paramRE = /<parameter=(\w+)>([^<]*)<\/parameter>/g;
        let pmatch: RegExpExecArray | null;
        const args: Record<string, string> = {};
        while ((pmatch = paramRE.exec(rawArgs)) !== null) {
          args[pmatch[1]] = pmatch[2];
        }
        const argsStr = Object.keys(args).length > 0 ? JSON.stringify(args) : (rawArgs || "{}");
        toolResults.push(`@@TOOL@@ ${name} ${argsStr}`);
      }

      if (toolResults.length > 0) return toolResults.join("\n");

      return result.text;
    },

    async stream(
      messages: ChatMessage[],
      onChunk: (text: string) => void
    ): Promise<string> {
      const ai = await import("ai");
      const systemMsg = messages.find((m) => m.role === "system");

      const streamOpts: any = {
        model,
        system: systemMsg?.content,
        messages: toVercelMessages(messages),
        maxRetries,
      };
      if (vercelTools) streamOpts.tools = vercelTools;

      const result = await ai.streamText(streamOpts);

      let fullText = "";
      let toolCalls: any[] = [];

      for await (const chunk of result.textStream) {
        fullText += chunk;
        onChunk(chunk);
      }

      // Check for tool calls in the full response
      try {
        toolCalls = await result.toolCalls;
      } catch {
        // toolCalls may not be available on all providers
      }

      if (toolCalls?.length) {
        return toolCalls
          .map((tc: any) => `@@TOOL@@ ${tc.toolName} ${JSON.stringify(tc.args)}`)
          .join("\n");
      }

      // Fallback: parse XML-style tool calls from streamed text (same as complete).
      const xmlToolCallRE = /<tool_call>\s*<function[=> ]+([^\s>]+)\s*>?\s*(.*?)\s*<\/function>\s*<\/tool_call>/gs;
      let match: RegExpExecArray | null;
      const toolResults: string[] = [];
      while ((match = xmlToolCallRE.exec(fullText)) !== null) {
        const name = match[1];
        let rawArgs = match[2].trim();
        const paramRE = /<parameter=(\w+)>([^<]*)<\/parameter>/g;
        let pmatch: RegExpExecArray | null;
        const args: Record<string, string> = {};
        while ((pmatch = paramRE.exec(rawArgs)) !== null) {
          args[pmatch[1]] = pmatch[2];
        }
        const argsStr = Object.keys(args).length > 0 ? JSON.stringify(args) : (rawArgs || "{}");
        toolResults.push(`@@TOOL@@ ${name} ${argsStr}`);
      }
      if (toolResults.length > 0) return toolResults.join("\n");

      return fullText;
    },
  };
}
