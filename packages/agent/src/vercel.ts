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

// Convert helix messages → Vercel AI SDK v7 CoreMessage format.
//
// Helix uses a simple message format:
//   { role: "assistant", content: "text @@TOOL@@ name {args}" }
//   { role: "tool", content: "Result of name: ..." }
//
// AI SDK v7 requires structured content parts:
//   assistant → content: ["text", { type: "tool-call", toolCallId, toolName, args }]
//   tool      → content: [{ type: "tool-result", toolCallId, toolName, result, content }]
//
// This converter parses @@TOOL@@ markers from assistant messages and converts
// them to proper tool-call parts, correlating toolCallIds with tool-result parts.
function toVercelMessages(messages: ChatMessage[]): any[] {
  let toolCallIdCounter = 0;
  // Map from (toolName + sequential index) -> generated toolCallId for correlation.
  const toolCallMap = new Map<string, string>();

  const result: any[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "assistant") {
      const content = m.content;
      // Split on @@TOOL@@ markers.
      const parts: string[] = content.split(/(?=@@TOOL@@)/g);
      const contentParts: any[] = [];

      for (const part of parts) {
        if (part.startsWith("@@TOOL@@")) {
          const rest = part.slice(8).trim();
          const spaceIdx = rest.indexOf(" ");
          const toolName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
          const argsStr = spaceIdx === -1 ? "{}" : rest.slice(spaceIdx + 1);
          let args: unknown;
          try { args = JSON.parse(argsStr); } catch { args = argsStr; }
          const tcId = `call_${++toolCallIdCounter}`;
          toolCallMap.set(`${toolName}_${toolCallIdCounter}`, tcId);
          contentParts.push({ type: "tool-call" as const, toolCallId: tcId, toolName, args });
        } else {
          const trimmed = part.trim();
          if (trimmed) contentParts.push(trimmed);
        }
      }

      if (contentParts.length === 1 && typeof contentParts[0] === "string") {
        result.push({ role: "assistant", content: contentParts[0] });
      } else if (contentParts.length > 0) {
        result.push({ role: "assistant", content: contentParts });
      }
      continue;
    }

    if (m.role === "tool") {
      // Parse "Result of toolName: {result}" format
      const toolContent = m.content;
      let toolName = "unknown";
      let resultData: unknown = toolContent;
      const match = toolContent.match(/^Result of (\w+):\s*(.*)/s);
      if (match) {
        toolName = match[1];
        try { resultData = JSON.parse(match[2]); } catch { resultData = match[2]; }
      }

      // Find a matching toolCallId. The tool result correlates to the assistant's
      // tool call with the same name, in order. We use the next unused ID for
      // this tool name.
      const key = `${toolName}_${toolCallIdCounter}`;
      // Walk backwards from the current counter to find the matching tool call.
      let toolCallId = `call_${toolCallIdCounter}`;
      for (let i = toolCallIdCounter; i > 0; i--) {
        const candidate = toolCallMap.get(`${toolName}_${i}`);
        if (candidate) { toolCallId = candidate; break; }
      }

      result.push({
        role: "tool",
        content: [{
          type: "tool-result" as const,
          toolCallId,
          toolName,
          result: resultData,
        }],
      });
      continue;
    }

    // User messages pass through as-is.
    result.push({ role: m.role, content: m.content });
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
