# helix-core

Helix shared core: agent runtime, tool registry, plugin system, config schema. Single source of truth for all Helix surfaces (CLI, TUI, web, Dashboard, Desktop).

## Overview

`helix-core` is the internal foundation that every Helix surface imports from. It provides the tool registry, plugin system, web infrastructure, authentication, skill discovery, and agent builder. You typically do not install this package directly — it is consumed by the CLI, TUI, and Dashboard.

## Installation

This package is internal to the Helix monorepo. If you need its functionality, use the CLI or import from `helix-agent` (the public SDK).

```bash
# As a workspace dependency
bun add helix-core
```

## Key Exports

### Tool Registry

```ts
import { ToolRegistry } from "helix-core";

const registry = new ToolRegistry();
registry.register({ name: "my_tool", description: "...", run: async () => "result" });
registry.get("my_tool"); // => Tool
registry.list();         // => Tool[]
```

### Plugin System

Plugins are functions that register tools, hooks, or surfaces:

```ts
import type { HelixPlugin } from "helix-core";

const myPlugin: HelixPlugin = {
  name: "my-plugin",
  async register(ctx) {
    ctx.registry.register({
      name: "custom_tool",
      description: "A custom tool",
      run: async (input) => `Result: ${input}`,
    });
  },
};
```

### Agent Builder

```ts
import { buildAgent } from "helix-core";

const agent = await buildAgent(provider, { config: helixConfig });
const reply = await agent.run("Hello!");
```

### Web Infrastructure

- `createWebSearchTool()` — SearXNG-backed web search tool
- `createWebExtractTool()` — Content extraction tool

### Authentication

```ts
import { listCredentials, setKey, removeKey, maskSecret } from "helix-core";

setKey("openai", "sk-...");
listCredentials(); // => [{ provider: "openai", configured: true, ... }]
```

### Skill Discovery

```ts
import { discoverSkills, defaultSkillDirs } from "helix-core";

const skills = discoverSkills(defaultSkillDirs());
// => [{ name: "my-skill", description: "...", dir: "/path/to/skill" }]
```

### Config

```ts
import { loadConfig, saveConfig } from "helix-core";

const cfg = loadConfig();
cfg.model = "gpt-4o";
saveConfig(cfg);
```

### Sub-agents (Pi-style)

```ts
import { makeDelegatePlugin } from "helix-core";

// Delegate to an isolated child process
const result = await delegateTask({ goal: "Review this code", context: "..." });
```

### Compression Plugins

- `makeCavemanPlugin()` — Ultra-compressed output mode
- `makeRtkPlugin()` — Round-trip context compression

### Memory

Re-exported from `helix-memory`:

```ts
import { makeMemoryTools, JsonlMemoryStore, readSoul } from "helix-core";
```

## Architecture

`helix-core` sits between the agent engine (`helix-agent`) and the surfaces (CLI, TUI, web). It owns:

- **ToolRegistry** — central tool store, shared across all surfaces
- **Plugin system** — `HelixPlugin` interface for extending capabilities
- **Config** — `HelixConfig` schema, load/save from `~/.helix/config.json`
- **Auth** — credential management (`~/.helix/auth.json`)
- **Skills** — discovery from skill directories
- **Web infra** — SearXNG and extract server integration
- **Provider resolution** — load LLM providers from config/env

## License

MIT
