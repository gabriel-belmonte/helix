// Load an LLM provider from environment variables OR ~/.helix/config.json.
// Uses Vercel AI SDK under the hood — supports OpenAI, Anthropic, Google, etc.

import chalk from "chalk";
import { scriptedLLM, type LLMProvider } from "helix-agent";
import { vercelStreamingProvider } from "helix-agent/vercel";
import { loadConfig } from "./config.js";

export function loadProvider(opts: { scripted?: boolean } = {}): LLMProvider {
  if (opts.scripted) {
    return scriptedLLM((t) => {
      if (t === 0) return "@@TOOL@@ list_dir {}";
      return "Here are the files in the current directory (see the tool result above).";
    });
  }

  const cfg = loadConfig();

  // 1) OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(openaiKey, cfg.model ?? "gpt-4o-mini"),
    });
  }

  // 2) Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return vercelStreamingProvider({
      model: createAnthropicModel(anthropicKey, cfg.model ?? "claude-sonnet-4-20250514"),
    });
  }

  // 3) OpenRouter (via OpenAI SDK with custom base URL)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        openrouterKey,
        cfg.model ?? "cohere/north-mini-code:free",
        "https://openrouter.ai/api/v1"
      ),
    });
  }

  // 4) HuggingFace Inference Providers (via OpenAI SDK)
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        hfToken,
        cfg.model ?? "Qwen/Qwen3-Coder-Next",
        "https://router.huggingface.co/v1"
      ),
    });
  }

  // 5) OpenCode Zen (via OpenAI SDK)
  const zenKey = process.env.OPENCODE_ZEN_API_KEY ?? process.env.OPENCODE_ZEN_KEY;
  if (zenKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        zenKey,
        cfg.model ?? "big-pickle",
        process.env.OPENCODE_ZEN_BASE_URL ?? cfg.zenBaseUrl ?? "https://opencode.ai/zen/v1"
      ),
    });
  }

  // 6) Generic OpenAI-compatible endpoint
  const customKey = process.env.LLM_API_KEY;
  const customUrl = process.env.LLM_BASE_URL;
  if (customKey && customUrl) {
    return vercelStreamingProvider({
      model: createOpenAIModel(customKey, cfg.model ?? "default", customUrl),
    });
  }

  throw new Error(
    chalk.red("No LLM provider configured. Set one of:") + "\n" +
    chalk.gray("  OPENAI_API_KEY      → OpenAI\n") +
    chalk.gray("  ANTHROPIC_API_KEY   → Anthropic\n") +
    chalk.gray("  OPENROUTER_API_KEY  → OpenRouter\n") +
    chalk.gray("  HF_TOKEN            → HuggingFace\n") +
    chalk.gray("  OPENCODE_ZEN_API_KEY → OpenCode Zen\n") +
    chalk.gray("  LLM_API_KEY + LLM_BASE_URL → Custom endpoint\n\n") +
    chalk.gray("Or run `helix config set provider <name>` + `helix config set model <slug>`.")
  );
}

// Lazy import helpers — only load the provider SDK when needed
async function createOpenAIModel(apiKey: string, model: string, baseUrl?: string) {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const config: any = { apiKey };
  if (baseUrl) config.baseURL = baseUrl;
  const provider = createOpenAI(config);
  return provider(model);
}

async function createAnthropicModel(apiKey: string, model: string) {
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  const provider = createAnthropic({ apiKey });
  return provider(model);
}
