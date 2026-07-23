// helix-mcp — an MCP (Model Context Protocol) client plugin for Helix.
//
// It connects to one or more MCP servers and registers each remote tool as a
// local Helix tool. From the agent's point of view they are ordinary tools:
// the plugin just proxies `run` -> the MCP server's callTool.
//
// Inspired by OpenCode's MCP client (which uses @modelcontextprotocol/sdk
// with Stdio / StreamableHTTP / SSE transports). Helix keeps it minimal:
// a single `makeMcpPlugin(config)` returns a HelixPlugin.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { HelixPlugin, HelixTool } from "helix-core";

// A single MCP server definition (Helix-flavoured, simpler than OpenCode's).
export type McpServerConfig =
  | {
      // Stdio server: launched as a subprocess.
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      // HTTP (Streamable HTTP) server.
      type: "http";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      // Server-Sent Events server.
      type: "sse";
      url: string;
      headers?: Record<string, string>;
    };

export type McpConfig = {
  // Named servers. Each becomes a group of tools, namespaced as `<server>__<tool>`.
  servers: Record<string, McpServerConfig>;
};

function createTransport(cfg: McpServerConfig) {
  switch (cfg.type) {
    case "stdio":
      return new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env,
      });
    case "http":
      return new StreamableHTTPClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      });
    case "sse":
      return new SSEClientTransport(new URL(cfg.url), {
        requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      });
  }
}

async function connectServer(name: string, cfg: McpServerConfig): Promise<Client> {
  const client = new Client(
    { name: "helix", version: "0.1.0" },
    { capabilities: {} }
  );
  await client.connect(createTransport(cfg));
  return client;
}

/**
 * Build a Helix plugin that exposes every tool from every configured MCP
 * server. Tool names are namespaced: `<server>__<mcpTool>`.
 */
export function makeMcpPlugin(config: McpConfig): HelixPlugin {
  return {
    name: "helix-mcp",
    async register(ctx) {
      for (const [serverName, serverCfg] of Object.entries(config.servers)) {
        let client: Client;
        try {
          client = await connectServer(serverName, serverCfg);
        } catch (e: any) {
          console.warn(`[helix-mcp] failed to connect to "${serverName}": ${e?.message ?? e}`);
          continue;
        }

        const { tools } = await client.listTools();
        for (const t of tools) {
          const localName = `${serverName}__${t.name}`;
          const tool: HelixTool = {
            name: localName,
            description: t.description ?? `MCP tool ${t.name} (server: ${serverName})`,
            // MCP tools declare a JSON input schema — surface it so the model
            // knows the parameters.
            schema: (t.inputSchema as Record<string, unknown>) ?? undefined,
            run: async (input: unknown) => {
              const res = await client.callTool({
                name: t.name,
                arguments: (input as Record<string, unknown>) ?? {},
              });
              // MCP returns content blocks; flatten to a string for the agent.
              const content = (res as any).content;
              if (Array.isArray(content)) {
                return content
                  .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
                  .join("\n");
              }
              return res;
            },
          };
          ctx.registry.register(tool);
        }
      }
    },
  };
}
