// Shared LLM provider loader — used by every Helix surface (CLI, TUI, web…).
// Pure logic, no UI deps (no chalk) so helix-core stays surface-agnostic.
//
// Resolution order (env var OR ~/.helix/config.json):
//   OPENAI_API_KEY        → OpenAI
//   ANTHROPIC_API_KEY     → Anthropic
//   OPENROUTER_API_KEY    → OpenRouter
//   HF_TOKEN              → HuggingFace Inference Providers
//   OPENCODE_ZEN_API_KEY  → OpenCode Zen
//   LLM_API_KEY+LLM_BASE_URL → generic OpenAI-compatible

import { scriptedLLM, type LLMProvider } from "helix-agent";
import { vercelStreamingProvider } from "helix-agent/vercel";

type ProviderConfig = {
  provider?: "zen" | "hf" | "openrouter" | "openai";
  model?: string;
  zenBaseUrl?: string;
  hfBaseUrl?: string;
};

function resolveConfig(): ProviderConfig {
  // Subclasses/surfaces may pass a config; here we only read env. The CLI
  // merges ~/.helix/config.json before calling. Kept minimal on purpose.
  return {
    model: process.env.HELIX_MODEL,
    zenBaseUrl: process.env.OPENCODE_ZEN_BASE_URL,
    hfBaseUrl: process.env.HF_BASE_URL,
  };
}

export function loadProvider(opts: { scripted?: boolean } = {}): LLMProvider {
  if (opts.scripted) {
    return scriptedLLM((t) => {
      if (t === 0) return "@@TOOL@@ list_dir {}";
      return "Here are the files in the current directory (see the tool result above).";
    });
  }

  const cfg = resolveConfig();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(openaiKey, cfg.model ?? "gpt-4o-mini"),
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return vercelStreamingProvider({
      model: createAnthropicModel(anthropicKey, cfg.model ?? "claude-sonnet-4-20250514"),
    });
  }

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

  const zenKey = process.env.OPENCODE_ZEN_API_KEY ?? process.env.OPENCODE_ZEN_KEY;
  if (zenKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        zenKey,
        cfg.model ?? "big-pickle",
        cfg.zenBaseUrl ?? "https://opencode.ai/zen/v1"
      ),
    });
  }

  const customKey = process.env.LLM_API_KEY;
  const customUrl = process.env.LLM_BASE_URL;
  if (customKey && customUrl) {
    return vercelStreamingProvider({
      model: createOpenAIModel(customKey, cfg.model ?? "default", customUrl),
    });
  }

  throw new Error(
    "No LLM provider configured. Set one of:\n" +
      "  OPENAI_API_KEY        -> OpenAI\n" +
      "  ANTHROPIC_API_KEY     -> Anthropic\n" +
      "  OPENROUTER_API_KEY    -> OpenRouter\n" +
      "  HF_TOKEN              -> HuggingFace\n" +
      "  OPENCODE_ZEN_API_KEY  -> OpenCode Zen\n" +
      "  LLM_API_KEY+LLM_BASE_URL -> Custom OpenAI-compatible\n"
  );
}

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
