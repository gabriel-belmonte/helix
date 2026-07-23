// Provider Router — chain multiple LLM providers into one with automatic
// fallback. Tries each provider in order. On error it logs the failure and
// moves to the next. If all fail the last error is thrown.
//
// Usage:
//   import { makeProviderRouter } from "helix-core";
//   const llm = makeProviderRouter([
//     { provider: zenProvider, name: "zen:big-pickle" },
//     { provider: hfProvider,   name: "hf:Qwen/Qwen3-Coder-Next" },
//   ]);
//   const reply = await llm.complete(messages);

import type { ChatMessage, LLMProvider } from "helix-agent";

export type RoutedProvider = {
  /** The wrapped LLM provider. */
  provider: LLMProvider;
  /** Human label for logs/status (e.g. "zen:big-pickle"). */
  name: string;
};

export type RouterStats = {
  name: string;
  ok: number;
  err: number;
  totalLatencyMs: number;
  lastError?: string;
};

/**
 * Create an LLMProvider that forwards calls to the first successful provider
 * in the chain. Failed providers are skipped (with a warning) and the next
 * one is tried. If every provider fails, the last error is thrown.
 */
export function makeProviderRouter(
  chain: RoutedProvider[]
): LLMProvider & { stats: RouterStats[] } {
  const stats: RouterStats[] = chain.map((p) => ({
    name: p.name,
    ok: 0,
    err: 0,
    totalLatencyMs: 0,
  }));

  async function tryComplete(
    messages: ChatMessage[],
    startIdx = 0,
    onChunk?: (text: string) => void
  ): Promise<string> {
    for (let i = startIdx; i < chain.length; i++) {
      const entry = chain[i];
      const st = stats[i];
      const t0 = performance.now();
      try {
        let result: string;
        if (onChunk && entry.provider.stream) {
          result = await entry.provider.stream(messages, onChunk);
        } else {
          result = await entry.provider.complete(messages);
        }
        st.ok++;
        st.totalLatencyMs += performance.now() - t0;
        return result;
      } catch (err: unknown) {
        st.err++;
        st.totalLatencyMs += performance.now() - t0;
        const msg = err instanceof Error ? err.message : String(err);
        st.lastError = msg;
        console.warn(`[router] ${entry.name} failed: ${msg} — trying next…`);
      }
    }
    // All providers exhausted.
    const details = stats
      .map((s) => `${s.name} (ok=${s.ok} err=${s.err})`)
      .join("; ");
    throw new Error(`all ${chain.length} providers failed: ${details}`);
  }

  return {
    stats,
    complete: (messages) => tryComplete(messages),
    stream: (messages, onChunk) => tryComplete(messages, 0, onChunk),
  };
}
