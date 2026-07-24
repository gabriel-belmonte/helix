// Persistent config for Helix, stored at ~/.helix/config.json.
// Re-exports the canonical type + helpers from helix-core so every surface
// (CLI, TUI, web dashboard) reads the same config through the same code path.

export {
  loadConfig,
  saveConfig,
  CONFIG_DIR,
  CONFIG_PATH,
} from "helix-core";

export type { HelixConfig } from "helix-core";
