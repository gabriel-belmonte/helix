// web_extract tool — OPT-IN, granular feature (config.features.web.extract).
//
// Extract clean markdown from a URL via the bundled Firecrawl-compatible
// server (trafilatura + fallbacks). If it isn't running locally, `ensureExtract`
// starts Helix's own Python extract server (zero-config, no Docker needed).
// Loopback-only.
//
// Standalone tool named `web_extract` so a user can override JUST the extract
// piece via a plugin's `ctx.overrideTool(...)` without touching `web_search`.

import { defineTool } from "helix-agent";
import { ensureExtract, type WebInfraConfig } from "./web-infra.js";

export function createWebExtractTool(infra?: Partial<WebInfraConfig>) {
  const firecrawlUrl = infra?.firecrawlUrl || "http://127.0.0.1:8787";

  let ensured: Promise<void> | null = null;
  function ensureOnce() {
    if (!ensured) {
      ensured = ensureExtract({
        firecrawlUrl,
        firecrawlPort: infra?.firecrawlPort,
      }).then((st) => {
        if (st.error) console.warn(`[web_extract] ${st.error}`);
      });
    }
    return ensured;
  }

  return defineTool(
    "web_extract",
    `Extract clean markdown from a URL via self-hosted Firecrawl-compatible
server. Zero-config: Helix starts its own extract server if not running.
Input: { url: string, formats?: string[] }
Returns: { url, success, markdown, title }.
Example: web_extract({ url: "https://example.com" })`,
    async (input: { url: string; formats?: string[] }) => {
      await ensureOnce();
      try {
        const body = JSON.stringify({
          url: input.url,
          formats: input.formats ?? ["markdown"],
        });
        const res = await fetch(`${firecrawlUrl}/v1/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await res.json();
        return {
          url: input.url,
          success: data.success ?? true,
          markdown: data.data?.markdown ?? data.markdown ?? "",
          title: data.data?.metadata?.title ?? data.title ?? "",
        };
      } catch (e: any) {
        return { url: input.url, success: false, error: String(e.message ?? e) };
      }
    }
  );
}
