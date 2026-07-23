// Shared LLM provider loader — used by every Helix surface (CLI, TUI, web…).
// Pure logic, no UI deps (no chalk) so helix-core stays surface-agnostic.
//
// Key resolution (per provider) is delegated to auth.ts resolveKey():
//   env var  >  ~/.helix/auth.json stored credential
// So `helix auth login` persists a key, but an env var always wins (CI-safe).

import { scriptedLLM, type LLMProvider } from "helix-agent";
import { vercelStreamingProvider } from "helix-agent/vercel";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { resolveKey } from "./auth.js";

type ProviderConfig = {
  provider?: "zen" | "hf" | "openrouter" | "openai" | "anthropic";
  model?: string;
  zenBaseUrl?: string;
  hfBaseUrl?: string;
};

function resolveConfig(): ProviderConfig {
  return {
    provider: process.env.HELIX_PROVIDER as ProviderConfig["provider"],
    model: process.env.HELIX_MODEL,
    zenBaseUrl: process.env.OPENCODE_ZEN_BASE_URL,
    hfBaseUrl: process.env.HF_BASE_URL,
  };
}

// Default model per provider.
const DEFAULT_MODEL: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  openrouter: "cohere/north-mini-code:free",
  hf: "Qwen/Qwen3-Coder-Next",
  zen: "big-pickle",
};

export function loadProvider(opts: { scripted?: boolean } = {}): LLMProvider {
  if (opts.scripted) {
    return scriptedLLM((t) => {
      if (t === 0) return "@@TOOL@@ list_dir {}";
      return "Here are the files in the current directory (see the tool result above).";
    });
  }

  const cfg = resolveConfig();

  // OpenAI
  const openaiKey = resolveKey("openai");
  if (openaiKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(openaiKey, cfg.model ?? DEFAULT_MODEL.openai),
    });
  }

  // Anthropic
  const anthropicKey = resolveKey("anthropic");
  if (anthropicKey) {
    return vercelStreamingProvider({
      model: createAnthropicModel(anthropicKey, cfg.model ?? DEFAULT_MODEL.anthropic),
    });
  }

  // OpenRouter (OpenAI SDK w/ custom base URL)
  const openrouterKey = resolveKey("openrouter");
  if (openrouterKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        openrouterKey,
        cfg.model ?? DEFAULT_MODEL.openrouter,
        "https://openrouter.ai/api/v1"
      ),
    });
  }

  // HuggingFace Inference Providers
  const hfToken = resolveKey("hf");
  if (hfToken) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        hfToken,
        cfg.model ?? DEFAULT_MODEL.hf,
        cfg.hfBaseUrl ?? "https://router.huggingface.co/v1"
      ),
    });
  }

  // OpenCode Zen
  const zenKey = resolveKey("zen");
  if (zenKey) {
    return vercelStreamingProvider({
      model: createOpenAIModel(
        zenKey,
        cfg.model ?? DEFAULT_MODEL.zen,
        cfg.zenBaseUrl ?? "https://opencode.ai/zen/v1"
      ),
    });
  }

  // Generic OpenAI-compatible endpoint
  const customKey = process.env.LLM_API_KEY;
  const customUrl = process.env.LLM_BASE_URL;
  if (customKey && customUrl) {
    return vercelStreamingProvider({
      model: createOpenAIModel(customKey, cfg.model ?? "default", customUrl),
    });
  }

  throw new Error(
    "No LLM provider configured. Set a key via `helix auth login <provider>` " +
      "or an env var:\n" +
      "  OPENAI_API_KEY        -> OpenAI\n" +
      "  ANTHROPIC_API_KEY     -> Anthropic\n" +
      "  OPENROUTER_API_KEY    -> OpenRouter\n" +
      "  HF_TOKEN              -> HuggingFace\n" +
      "  OPENCODE_ZEN_API_KEY  -> OpenCode Zen\n" +
      "  LLM_API_KEY+LLM_BASE_URL -> Custom OpenAI-compatible\n"
  );
}

function createOpenAIModel(apiKey: string, model: string, baseUrl?: string) {
  const config: any = { apiKey };
  if (baseUrl) config.baseURL = baseUrl;
  const provider = createOpenAI(config);
  return provider(model);
}

function createAnthropicModel(apiKey: string, model: string) {
  const provider = createAnthropic({ apiKey });
  return provider(model);
}
