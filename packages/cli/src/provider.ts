// Load an LLM provider from environment variables OR ~/.helix/config.json.
// Supports OpenCode Zen (Big Pickle, free), HuggingFace (free router),
// OpenRouter (free tier), and OpenAI.

import { openAIProvider, scriptedLLM, type LLMProvider } from "helix-agent";
import { loadConfig } from "./config.js";

export function loadProvider(opts: { scripted?: boolean } = {}): LLMProvider {
  if (opts.scripted) {
    // A tiny demo brain: it lists the dir, then answers.
    return scriptedLLM((t) => {
      if (t === 0) return "@@TOOL@@ list_dir {}";
      return "Here are the files in the current directory (see the tool result above).";
    });
  }

  const cfg = loadConfig();

  // 1) OpenCode Zen — gives free access to "Big Pickle" and other curated models.
  const zenKey = process.env.OPENCODE_ZEN_API_KEY ?? process.env.OPENCODE_ZEN_KEY;
  if (zenKey) {
    return openAIProvider({
      apiKey: zenKey,
      baseUrl: process.env.OPENCODE_ZEN_BASE_URL ?? cfg.zenBaseUrl ?? "https://opencode.ai/zen/v1",
      model: process.env.HELIX_MODEL ?? cfg.model ?? "big-pickle",
    });
  }

  // 2) HuggingFace Inference Providers (free router).
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    return openAIProvider({
      apiKey: hfToken,
      baseUrl: process.env.HF_BASE_URL ?? cfg.hfBaseUrl ?? "https://router.huggingface.co/v1",
      model: process.env.HELIX_MODEL ?? cfg.model ?? "Qwen/Qwen3-Coder-Next",
    });
  }

  // 3) OpenRouter / OpenAI
  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No LLM provider configured. Run `helix config` to set a provider+key, " +
        "or set OPENCODE_ZEN_API_KEY / HF_TOKEN / OPENROUTER_API_KEY / OPENAI_API_KEY."
    );
  }

  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
  return openAIProvider({
    apiKey,
    baseUrl: isOpenRouter
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1",
    model: process.env.HELIX_MODEL ?? cfg.model ?? (isOpenRouter ? "cohere/north-mini-code:free" : "gpt-4o-mini"),
  });
}
