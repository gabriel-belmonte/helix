// CLI provider loader. Re-exports the shared loader from helix-core and adds
// a chalk-formatted error for a nicer CLI experience. CLI-specific config
// (merging ~/.helix/config.json) is handled by the caller.

import chalk from "chalk";
import { type LLMProvider } from "helix-agent";
import { loadProvider as coreLoadProvider } from "helix-core";

export function loadProvider(opts: { scripted?: boolean } = {}): LLMProvider {
  try {
    return coreLoadProvider(opts);
  } catch (e: any) {
    // Re-throw with chalk styling so the CLI surfaces a friendly message.
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
