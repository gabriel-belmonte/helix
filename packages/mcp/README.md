# helix-mcp

MCP (Model Context Protocol) client plugin for Helix — exposes remote MCP tools as local Helix tools.

## Overview

`helix-mcp` connects to MCP servers (stdio, HTTP, or SSE transports) and registers each remote tool as a local Helix tool. From the agent's perspective, MCP tools are ordinary tools — the plugin proxies `run` calls to the MCP server's `callTool`.

## Installation

This package is internal to the Helix monorepo. Use via the CLI or as a workspace dependency:

```bash
bun add helix-mcp
```

## Quick Start

Configure MCP servers in `~/.helix/helix.mcp.json`:

```json
{
  "servers": {
    "fs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

Tools are namespaced as `<server>__<tool>` (e.g. `fs__read_file`, `context7__get_docs`).

## Programmatic Usage

```ts
import { makeMcpPlugin } from "helix-mcp";
import type { McpConfig } from "helix-mcp";

const config: McpConfig = {
  servers: {
    filesystem: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    },
    remote: {
      type: "http",
      url: "https://mcp.example.com/api",
      headers: { Authorization: "Bearer token" },
    },
  },
};

const plugin = makeMcpPlugin(config);

// Register with Helix's plugin system
await plugin.register({ registry });
```

## Transport Types

| Transport | Config `type` | Use Case |
|-----------|---------------|----------|
| **Stdio** | `"stdio"` | Local server launched as a subprocess |
| **HTTP** | `"http"` | Remote server via Streamable HTTP |
| **SSE** | `"sse"` | Remote server via Server-Sent Events |

### Stdio

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
  "env": { "MY_VAR": "value" }
}
```

### HTTP

```json
{
  "type": "http",
  "url": "https://mcp.example.com/api",
  "headers": { "Authorization": "Bearer token" }
}
```

### SSE

```json
{
  "type": "sse",
  "url": "https://mcp.example.com/sse",
  "headers": { "X-Custom": "header" }
}
```

## How It Works

1. `makeMcpPlugin(config)` returns a `HelixPlugin`
2. On `register()`, it connects to each configured MCP server
3. Lists available tools via `client.listTools()`
4. Registers each tool with the Helix tool registry as `<server>__<toolName>`
5. Tool `run` calls proxy to `client.callTool()` and flatten the response

## API

### `makeMcpPlugin(config: McpConfig): HelixPlugin`

Creates a Helix plugin from MCP server configurations.

### Types

| Type | Description |
|------|-------------|
| `McpConfig` | `{ servers: Record<string, McpServerConfig> }` |
| `McpServerConfig` | Union of stdio, http, or sse transport configs |

## License

MIT
