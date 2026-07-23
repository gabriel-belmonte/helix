// web_search tool — OPT-IN, granular feature (config.features.web.search).
//
// Search via SearXNG (self-hosted, free). If SearXNG isn't running locally,
// `ensureSearch` brings it up via Docker (zero-config). Loopback-only.
//
// This is a standalone tool named `web_search` so a user can override JUST
// the search piece with their own implementation via a plugin's
// `ctx.overrideTool(...)` without touching `web_extract`.

import { defineTool } from "helix-agent";
import { ensureSearch, type WebInfraConfig } from "./web-infra.js";

export function createWebSearchTool(infra?: Partial<WebInfraConfig>) {
  const searxngUrl = infra?.searxngUrl || "http://127.0.0.1:8888";

  let ensured: Promise<void> | null = null;
  function ensureOnce() {
    if (!ensured) {
      ensured = ensureSearch({
        searxngUrl,
        searxngImage: infra?.searxngImage,
      }).then((st) => {
        if (st.error) console.warn(`[web_search] ${st.error}`);
      });
    }
    return ensured;
  }

  return defineTool(
    "web_search",
    `Search the web via self-hosted SearXNG. Zero-config: Helix starts
SearXNG via Docker if it isn't already running.
Input: { q: string, limit?: number }
Returns: { query, results: [{ title, url, content }] }.
Example: web_search({ q: "rust async runtime" })`,
    async (input: { q: string; limit?: number }) => {
      await ensureOnce();
      try {
        const u = `${searxngUrl}/search?q=${encodeURIComponent(input.q)}&format=json`;
        const res = await fetch(u);
        const data = await res.json();
        return {
          query: input.q,
          results: (data.results ?? []).slice(0, input.limit ?? 10).map((r: any) => ({
            title: r.title,
            url: r.url,
            content: (r.content ?? "").slice(0, 300),
          })),
        };
      } catch (e: any) {
        return { query: input.q, success: false, error: String(e.message ?? e) };
      }
    }
  );
}
