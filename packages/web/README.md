# helix-web

Helix Dashboard — web control panel (config, keys, skills, MCP, files) over the same core.

## Overview

`helix-web` provides a web-based dashboard for managing Helix configuration, API keys, skills, MCP servers, memory, and file browsing. Built with Hono (server) and React (UI), it serves both the JSON API and the SPA from a single port.

## Quick Start

```bash
# Via CLI
helix dashboard

# From source
cd packages/web
bun run server/index.ts
```

The dashboard runs on `http://localhost:8799` by default.

## Features

- **Config management** — change provider, model, and settings
- **API key management** — add, remove, and view stored keys (masked)
- **Model catalog** — browse Zen models with free highlighting
- **Skills browser** — view discovered skills
- **MCP server management** — configure MCP server connections
- **File browser** — navigate project files
- **Live chat** — interact with the agent in the browser
- **Memory viewer** — browse and manage agent memories

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | Get current config |
| POST | `/api/config` | Update config |
| GET | `/api/auth` | List API keys (masked) |
| POST | `/api/auth` | Add API key |
| DELETE | `/api/auth/:provider` | Remove API key |
| GET | `/api/zen-models` | List available models |
| GET | `/api/skills` | List discovered skills |
| GET | `/api/mcp` | Get MCP server config |
| POST | `/api/mcp` | Update MCP server config |
| POST | `/api/chat` | Send message to agent |
| GET | `/api/memory` | List memories |
| POST | `/api/memory` | Store a memory |
| DELETE | `/api/memory` | Clear memories |
| GET | `/api/soul` | Read agent persona |
| GET | `/api/files` | Browse files |

## Chat API

```bash
curl -X POST http://localhost:8799/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "sessionId": "default"}'
```

Response:

```json
{ "reply": "Hello! How can I help?" }
```

For demo mode (no API key needed):

```json
{"message": "Hello!", "demo": true}
```

## Docker

```bash
docker run -d \
  --name helix-web \
  -p 8799:8799 \
  -v "$HOME/.helix:/root/.helix" \
  ghcr.io/gabriel-belmonte/helix/helix-web:latest
```

## Development

```bash
# API server (hot reload)
bun --hot server/index.ts

# Frontend dev server
bun run dev:ui

# Both concurrently
bun run dev
```

## Architecture

```
┌──────────────────────────────────────┐
│            helix-web                 │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  Hono API   │  │  React SPA   │  │
│  │  (server/)  │  │  (src/)      │  │
│  └──────┬──────┘  └──────────────┘  │
│         │                            │
│  ┌──────▼──────────────────────┐    │
│  │        helix-core           │    │
│  │  Config · Auth · Skills     │    │
│  │  MCP · Memory · Agent       │    │
│  └─────────────────────────────┘    │
└──────────────────────────────────────┘
```

## License

MIT
