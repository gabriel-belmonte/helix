// helix-core — single source of truth for every Helix surface.
//
// CLI, TUI, web UI, Dashboard and Desktop all import from here. The runtime
// layer (agent loop, tool registry, plugin system, config) lives in `core`;
// each surface is a thin adapter that feeds user input in and renders output.
//
// Design rules (kept intentionally small + legible):
//   - No hidden magic: tools are plain { name, description, run } objects.
//   - Plugins are plain functions that register tools / hooks / surfaces.
//   - Features are toggled by the config object, never by env-side effects.

import type { Tool } from "helix-agent";
import { builtinTools } from "./builtins.js";
import { createWebTool } from "./web.js";

// --------------------------------------------------------------------------
// Tool registry
// --------------------------------------------------------------------------

export type HelixTool = Tool;

/**
 * Central registry of tools. Surfaces call `getTools(config)` to obtain the
 * active tool set; plugins call `registerTool` to contribute.
 */
export class ToolRegistry {
  private tools = new Map<string, HelixTool>();

  register(tool: HelixTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): HelixTool | undefined {
    return this.tools.get(name);
  }

  list(): HelixTool[] {
    return [...this.tools.values()];
  }
}

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

export type HelixConfig = {
  /** Enable the `web` tool (search + extract via self-hosted infra). */
  web?: boolean;
  /** Extra features toggled by plugins / future surfaces. */
  features?: Record<string, boolean>;
  /** Endpoints for self-hosted infra (overridable per deploy). */
  infra?: {
    searxngUrl?: string;
    firecrawlUrl?: string;
  };
};

export const defaultConfig: HelixConfig = {
  web: false,
  features: {},
  infra: {
    searxngUrl: "http://127.0.0.1:8888",
    firecrawlUrl: "http://127.0.0.1:8787",
  },
};

// --------------------------------------------------------------------------
// Plugin system
// --------------------------------------------------------------------------

export type HelixPluginContext = {
  registry: ToolRegistry;
  config: HelixConfig;
};

export type HelixPlugin = {
  name: string;
  /** Register tools/hooks. Called once at startup with the live context. */
  register: (ctx: HelixPluginContext) => void | Promise<void>;
};

/**
 * Resolve the active tool list for a given config.
 *
 * Built-in tools are always present; optional features (web, …) are added
 * only when enabled in config. Plugins receive the same registry so they can
 * contribute their own tools.
 */
export async function resolveTools(
  config: HelixConfig,
  plugins: HelixPlugin[] = []
): Promise<HelixTool[]> {
  const registry = new ToolRegistry();

  // 1. Always-on built-in tools.
  for (const t of builtinTools) registry.register(t);

  // 2. Feature-gated tools.
  if (config.web) {
    registry.register(createWebTool(config.infra));
  }

  // 3. Plugins.
  const ctx: HelixPluginContext = { registry, config };
  for (const p of plugins) await p.register(ctx);

  return registry.list();
}
