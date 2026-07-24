// web-infra — zero-config local provisioning for Helix's web tool.
//
// If SearXNG (search) and/or the Helix extract server (extract) are not already
// running, this module brings them up so the `web` tool works out-of-the-box:
//   - SearXNG  -> `sudo docker run searxng/searxng`   (official, lightweight)
//   - extract  -> `python3 <core>/extract-server/extract_server.py` (bundled, zero-dep)
//
// The extract server is a self-contained Firecrawl-compatible endpoint (same
// API the `web` tool calls) backed by trafilatura + fallbacks — no API key,
// no paid service, no Docker needed for extraction. Containers/processes are
// loopback-only and survive reboots (Docker: unless-stopped; server: nohup).
//
// Design: health-check first, provision only what's missing, wait for ready.
// If Docker is unavailable, SearXNG is skipped (extract still works). Never
// throws for missing infra — sets `error` so the caller can surface it.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const execFileP = promisify(execFile);

// Resolve the bundled extract server next to this compiled file:
// dist/web-infra.js  ->  ../extract-server/extract_server.py
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTRACT_SERVER = join(__dirname, "..", "extract-server", "extract_server.py");

export type WebInfraConfig = {
  searxngUrl?: string;
  firecrawlUrl?: string;
  searxngImage?: string;
  searxngPort?: number;
  firecrawlPort?: number;
};

const DEFAULTS = {
  searxngUrl: "http://127.0.0.1:8888",
  firecrawlUrl: "http://127.0.0.1:8787",
  searxngImage: "searxng/searxng:latest",
  searxngPort: 8888,
  firecrawlPort: 8787,
};

async function urlUp(url: string, timeoutMs = 1500, method: "GET" | "POST" = "GET"): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      ...(method === "POST"
        ? { body: "{}", headers: { "Content-Type": "application/json" } }
        : {}),
    });
    clearTimeout(t);
    // Any HTTP response (even 400/501) means the server is reachable.
    return res.status > 0;
  } catch {
    return false;
  }
}

async function dockerCmd(): Promise<string> {
  try {
    await execFileP("docker", ["info"], { timeout: 5000 });
    return "docker";
  } catch {
    try {
      await execFileP("sudo", ["docker", "info"], { timeout: 8000 });
      return "sudo docker";
    } catch {
      return "";
    }
  }
}

async function dockerAvailable(): Promise<boolean> {
  return (await dockerCmd()).length > 0;
}

async function ensureDocker(
  name: string,
  image: string,
  hostPort: number,
  containerPort: number,
  health: { path: string; method?: "GET" | "POST" }
): Promise<void> {
  try {
    const dCmd = await dockerCmd();
    if (!dCmd) throw new Error("Docker not available");
    const [bin, ...sudoParts] = dCmd.split(" ");
    const { stdout } = await execFileP(bin, [...sudoParts, "ps", "-q", "-f", `name=^${name}$`], {
      timeout: 8000,
    });
    if (stdout.trim()) return; // already running
  } catch {
    /* fall through */
  }

  const dCmd = await dockerCmd();
  if (!dCmd) throw new Error("Docker not available");
  const [bin, ...sudoParts] = dCmd.split(" ");
  await execFileP(
    bin,
    [
      ...sudoParts,
      "run",
      "-d",
      "--name",
      name,
      "--restart",
      "unless-stopped",
      "-p",
      `127.0.0.1:${hostPort}:${containerPort}`,
      image,
    ],
    { timeout: 180_000 }
  );

  const url = `http://127.0.0.1:${hostPort}${health.path}`;
  for (let i = 0; i < 30; i++) {
    const up =
      health.method === "POST" ? await urlUp(url, 1000, "POST") : await urlUp(url, 1000);
    if (up) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function ensureExtractServer(url: string, port: number): Promise<boolean> {
  if (await urlUp(url)) return true; // already up (e.g. Hermes' local-firecrawl)
  if (!existsSync(EXTRACT_SERVER)) {
    console.warn(`[web-infra] extract server not found at ${EXTRACT_SERVER}`);
    return false;
  }
  try {
    const { spawn } = await import("node:child_process");
    spawn("python3", [EXTRACT_SERVER], {
      env: { ...process.env, HELIX_FC_PORT: String(port) },
      detached: true,
      stdio: "ignore",
    }).unref();
  } catch (e: any) {
    console.warn(`[web-infra] failed to start extract server: ${e.message}`);
    return false;
  }

  // wait for readiness
  for (let i = 0; i < 30; i++) {
    if (await urlUp(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export type WebInfraStatus = {
  searxng: { url: string; running: boolean; provisioned: boolean };
  firecrawl: { url: string; running: boolean; provisioned: boolean };
  dockerAvailable: boolean;
  error?: string;
};

/** Ensure only the SearXNG (search) side is up. */
export async function ensureSearch(cfg: WebInfraConfig = {}): Promise<WebInfraStatus> {
  const searxngUrl = cfg.searxngUrl ?? DEFAULTS.searxngUrl;
  const status: WebInfraStatus = {
    searxng: { url: searxngUrl, running: false, provisioned: false },
    firecrawl: { url: "", running: false, provisioned: false },
    dockerAvailable: false,
  };
  const docker = await dockerAvailable();
  status.dockerAvailable = docker;
  if (await urlUp(searxngUrl)) {
    status.searxng.running = true;
  } else if (docker) {
    const port = cfg.searxngPort ?? DEFAULTS.searxngPort;
    await ensureDocker(
      "helix-searxng",
      cfg.searxngImage ?? DEFAULTS.searxngImage,
      port,
      8080,
      { path: "/search?q=test&format=json", method: "GET" }
    ).catch(() => {});
    status.searxng.running = await urlUp(searxngUrl);
    status.searxng.provisioned = true;
  } else {
    status.error = "Docker unavailable — cannot auto-provision SearXNG. Install Docker or run it manually.";
  }
  return status;
}

/** Ensure only the extract (Firecrawl-compatible) side is up. */
export async function ensureExtract(cfg: WebInfraConfig = {}): Promise<WebInfraStatus> {
  const firecrawlUrl = cfg.firecrawlUrl ?? DEFAULTS.firecrawlUrl;
  const status: WebInfraStatus = {
    searxng: { url: "", running: false, provisioned: false },
    firecrawl: { url: firecrawlUrl, running: false, provisioned: false },
    dockerAvailable: false,
  };
  status.dockerAvailable = await dockerAvailable();
  status.firecrawl.running = await ensureExtractServer(
    firecrawlUrl,
    cfg.firecrawlPort ?? DEFAULTS.firecrawlPort
  );
  status.firecrawl.provisioned =
    !status.firecrawl.running && (await urlUp(firecrawlUrl)) === false;
  if (!status.firecrawl.running) {
    status.error =
      "Extract server unavailable — ensure python3 + trafilatura are installed (Helix bundles extract_server.py).";
  }
  return status;
}

/**
 * Ensure local web infra is up. Returns the URLs to use (provisioning any
 * missing pieces). Never throws for missing infra — sets `error`.
 */
export async function ensureWebInfra(cfg: WebInfraConfig = {}): Promise<WebInfraStatus> {
  const searxngUrl = cfg.searxngUrl ?? DEFAULTS.searxngUrl;
  const firecrawlUrl = cfg.firecrawlUrl ?? DEFAULTS.firecrawlUrl;

  const status: WebInfraStatus = {
    searxng: { url: searxngUrl, running: false, provisioned: false },
    firecrawl: { url: firecrawlUrl, running: false, provisioned: false },
    dockerAvailable: false,
  };

  const docker = await dockerAvailable();
  status.dockerAvailable = docker;

  // --- SearXNG (Docker) ---
  if (await urlUp(searxngUrl)) {
    status.searxng.running = true;
  } else if (docker) {
    const port = cfg.searxngPort ?? DEFAULTS.searxngPort;
    await ensureDocker(
      "helix-searxng",
      cfg.searxngImage ?? DEFAULTS.searxngImage,
      port,
      8080,
      { path: "/search?q=test&format=json", method: "GET" }
    ).catch(() => {});
    status.searxng.running = await urlUp(searxngUrl);
    status.searxng.provisioned = true;
  }

  // --- Extract server (bundled Python, zero-dep) ---
  status.firecrawl.running = await ensureExtractServer(firecrawlUrl, cfg.firecrawlPort ?? DEFAULTS.firecrawlPort);
  status.firecrawl.provisioned = !status.firecrawl.running && (await urlUp(firecrawlUrl)) === false;

  if (!status.searxng.running && !status.firecrawl.running) {
    status.error =
      "Web infra did not become ready. For search, install Docker. For extract, ensure python3 + trafilatura are available.";
  } else if (!status.searxng.running) {
    status.error =
      "SearXNG unavailable (Docker missing or not ready) — extract still works, search disabled.";
  }

  return status;
}
