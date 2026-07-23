// Web tool — OPT-IN feature. Only included when config.web === true.
//
// Search  -> SearXNG  (self-hosted, free, http://127.0.0.1:8888)
// Extract -> Firecrawl (self-hosted local, trafilatura, http://127.0.0.1:8787)
//
// Both are loopback-only, no API keys. If an endpoint is down the tool returns
// a clear error instead of throwing.

import { defineTool } from "helix-agent";

export type InfraEndpoints = {
  searxngUrl: string;
  firecrawlUrl: string;
};

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export function createWebTool(infra?: Partial<InfraEndpoints>) {
  const searxngUrl = infra?.searxngUrl || "http://127.0.0.1:8888";
  const firecrawlUrl = infra?.firecrawlUrl || "http://127.0.0.1:8787";

  return defineTool(
    "web",
    `Search the web or extract a URL's content. No API key — uses self-hosted infra.
Input: { q?: string, url?: string, formats?: string[] }
- To SEARCH:  provide q (e.g. "helix agent framework"). Returns results via SearXNG.
- To EXTRACT: provide url. Returns clean markdown via Firecrawl (local, trafilatura).
- formats: Firecrawl output formats (default ["markdown"]).
Examples:
  web({ q: "rust async runtime" })
  web({ url: "https://example.com" })`,
    async (input: { q?: string; url?: string; formats?: string[] }) => {
      if (input.url) {
        try {
          const body = JSON.stringify({
            url: input.url,
            formats: input.formats ?? ["markdown"],
          });
          const data = await fetchJson(`${firecrawlUrl}/v1/scrape`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
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

      if (input.q) {
        try {
          const u = `${searxngUrl}/search?q=${encodeURIComponent(input.q)}&format=json`;
          const data = await fetchJson(u);
          return {
            query: input.q,
            results: (data.results ?? []).slice(0, 10).map((r: any) => ({
              title: r.title,
              url: r.url,
              content: (r.content ?? "").slice(0, 300),
            })),
          };
        } catch (e: any) {
          return { query: input.q, success: false, error: String(e.message ?? e) };
        }
      }

      return { success: false, error: "provide either q (search) or url (extract)" };
    }
  );
}
