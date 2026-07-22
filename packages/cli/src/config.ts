// Persistent config for Helix, stored at ~/.helix/config.json.
// `helix config` reads/writes this. Provider loader merges it with env vars.

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

export const CONFIG_DIR = join(homedir(), ".helix");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export type HelixConfig = {
  provider?: "zen" | "hf" | "openrouter" | "openai";
  model?: string;
  zenBaseUrl?: string;
  hfBaseUrl?: string;
};

export function loadConfig(): HelixConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveConfig(cfg: HelixConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
