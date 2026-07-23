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
import { createWebSearchTool } from "./web_search.js";
import { createWebExtractTool } from "./web_extract.js";

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

  /**
   * Register a tool. By default, registering a name that already exists throws
   * (prevents silent collisions). Pass `override=true` to replace an existing
   * tool — this is how plugins swap a built-in for their own implementation.
   */
  register(tool: HelixTool, override = false): void {
    if (this.tools.has(tool.name) && !override) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Replace an existing tool (or add if absent). Convenience for plugins. */
  override(tool: HelixTool): void {
    this.register(tool, true);
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
  /** Web feature group (granular). Each piece is independently toggleable. */
  web?: {
    search?: boolean; // web_search tool (SearXNG)
    extract?: boolean; // web_extract tool (Firecrawl-compatible local server)
  };
  /** Extra features toggled by plugins / future surfaces. */
  features?: Record<string, boolean>;
  /** Endpoints for self-hosted infra (overridable per deploy). */
  infra?: {
    searxngUrl?: string;
    firecrawlUrl?: string;
  };
  /** Provider configuration (used by CLI surfaces). */
  provider?: string;
  model?: string;
  fallback?: string[];
};

export const defaultConfig: HelixConfig = {
  web: { search: false, extract: false },
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
  /**
   * Register a tool, replacing any built-in/feature tool with the same name.
   * Use this to swap Helix's default `web` (or any built-in) for your own.
   *   ctx.overrideTool(myWebTool);  // replaces built-in `web` if present
   */
  overrideTool: (tool: HelixTool) => void;
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

  // 2. Feature-gated tools (granular web group).
  const web = config.web ?? {};
  if (web.search) registry.register(createWebSearchTool(config.infra));
  if (web.extract) registry.register(createWebExtractTool(config.infra));

  // 3. Plugins (may override built-ins/features via ctx.overrideTool).
  const ctx: HelixPluginContext = {
    registry,
    config,
    overrideTool: (tool) => registry.override(tool),
  };
  for (const p of plugins) await p.register(ctx);

  return registry.list();
}
