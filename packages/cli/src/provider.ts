// CLI provider loader. Re-exports the shared loader from helix-core and adds
// a fallback router that chains multiple providers.
//
// When `config.fallback` is set (array of "{provider}:{model}" strings), it
// loads each one and wraps them in a ProviderRouter so if the first fails the
// next is tried automatically.
//
// Usage in ~/.helix/config.json:
//   { "provider": "zen", "model": "big-pickle",
//     "fallback": ["zen:mimo-v2.5-free", "hf:Qwen/Qwen3-Coder-Next"] }

import chalk from "chalk";
import { type LLMProvider } from "helix-agent";
import {
  loadProvider as coreLoadProvider,
  makeProviderRouter,
  type RoutedProvider,
  type HelixConfig,
} from "helix-core";

export function loadProvider(
  opts: { scripted?: boolean; config?: HelixConfig } = {}
): LLMProvider {
  const cfg = opts.config;

  // When a fallback list is provided, load each entry and wrap with the router.
  const fallback = cfg?.fallback;
  if (fallback && Array.isArray(fallback) && fallback.length > 0) {
    return loadFallbackChain(fallback, opts.scripted);
  }

  // Standard single-provider path (unchanged).
  try {
    return coreLoadProvider({ scripted: opts.scripted });
  } catch (e: any) {
    throw new Error(
      chalk.red("No LLM provider configured. Set one of:") +
        "\n" +
        chalk.gray("  OPENAI_API_KEY        → OpenAI\n") +
        chalk.gray("  ANTHROPIC_API_KEY     → Anthropic\n") +
        chalk.gray("  OPENROUTER_API_KEY    → OpenRouter\n") +
        chalk.gray("  HF_TOKEN              → HuggingFace\n") +
        chalk.gray("  OPENCODE_ZEN_API_KEY  → OpenCode Zen\n") +
        chalk.gray("  LLM_API_KEY+LLM_BASE_URL → Custom endpoint\n\n") +
        chalk.gray("Or run `helix config set provider <name>` + `helix config set model <slug>`.")
    );
  }
}

/**
 * Load multiple providers from an ordered fallback list and wrap them in a
 * ProviderRouter. Each entry is "{provider}:{model}" (model optional).
 *
 * Example fallback entries:
 *   "zen:big-pickle"     — first try
 *   "zen:mimo-v2.5-free" — fallback
 *   "hf"                 — uses HF default model
 */
function loadFallbackChain(
  entries: string[],
  scripted?: boolean
): LLMProvider {
  const chain: RoutedProvider[] = [];

  // Temporarily override env so coreLoadProvider accepts the specific provider.
  // We do this by setting HELIX_PROVIDER + HELIX_MODEL per entry.
  const savedProvider = process.env.HELIX_PROVIDER;
  const savedModel = process.env.HELIX_MODEL;

  for (const entry of entries) {
    const [prov, model] = entry.split(":");
    try {
      process.env.HELIX_PROVIDER = prov;
      if (model) process.env.HELIX_MODEL = model;
      const p = coreLoadProvider({ scripted });
      chain.push({ provider: p, name: entry });
    } catch {
      // Provider without a key — skip silently (might be configured later).
    }
  }

  // Restore original env.
  process.env.HELIX_PROVIDER = savedProvider;
  process.env.HELIX_MODEL = savedModel;

  if (chain.length === 0) {
    throw new Error(
      chalk.red("No provider in fallback chain has a valid API key.") +
        "\n" +
        chalk.gray("Configure at least one via `helix auth login <provider>` or an env var.") +
        "\n" +
        chalk.gray("Fallback entries: " + entries.join(", "))
    );
  }

  return makeProviderRouter(chain);
}
