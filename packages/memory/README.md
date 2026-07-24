# helix-memory

Modular memory for Helix — swappable MemoryStore backends (JSONL default) + remember/recall/reflect tools.

## Overview

`helix-memory` provides persistent memory for AI agents. The agent depends only on the `MemoryStore` interface — the default backend is a JSONL file (`~/.helix/memory.jsonl`), but you can swap it for SQLite, Postgres, a vector store, or any custom implementation.

## Installation

This package is internal to the Helix monorepo. Use via the CLI or as a workspace dependency:

```bash
bun add helix-memory
```

## Quick Start

```ts
import { makeMemoryTools, JsonlMemoryStore } from "helix-memory";

const store = new JsonlMemoryStore(); // default: ~/.helix/memory.jsonl
const tools = makeMemoryTools(store);

// Use with helix-agent
import { Agent } from "helix-agent";

const agent = new Agent({
  name: "memory-agent",
  system: "You remember things for the user.",
  llm: myProvider,
  tools,
});

await agent.run("Remember that my birthday is March 15");
await agent.run("When is my birthday?"); // uses recall
```

## Memory Tools

`makeMemoryTools(store)` returns three tools:

| Tool | Description | Input |
|------|-------------|-------|
| `remember` | Store a durable fact, preference, or note | `{ text, type?, bank?, importance? }` |
| `recall` | Retrieve relevant memories by keyword | `{ query, bank?, n? }` |
| `reflect` | Synthesize an answer from accumulated memory | `{ query, bank? }` |

## Memory Types

```ts
type MemoryType = "fact" | "preference" | "project" | "episodic";
```

| Type | Use Case |
|------|----------|
| `fact` | Factual information (default) |
| `preference` | User preferences and settings |
| `project` | Project-specific notes |
| `episodic` | Event/experience records |

## Banks (Scoping)

Memories are scoped by `bank`. The default bank is `"global"`. Use project-specific banks to isolate memories:

```ts
store.remember({
  type: "project",
  text: "Uses PostgreSQL with Prisma ORM",
  bank: "project:myapp",
  importance: 0.8,
});

store.recall("database", { bank: "project:myapp" });
```

## Custom Backend

Implement the `MemoryStore` interface to use any storage:

```ts
import type { MemoryStore, MemoryEntry } from "helix-memory";

class SqliteMemoryStore implements MemoryStore {
  remember(entry: Omit<MemoryEntry, "ts">): MemoryEntry {
    // Insert into SQLite
  }
  recall(query: string, opts?) {
    // Query SQLite with FTS
  }
  reflect(query: string, opts?) {
    // Synthesize from recalled entries
  }
  list(opts?) {
    // List all entries
  }
  clear(opts?) {
    // Clear entries in a bank
  }
}

const store = new SqliteMemoryStore();
const tools = makeMemoryTools(store);
```

## Soul Persona

Read an optional agent persona from `~/.helix/soul.md`:

```ts
import { readSoul } from "helix-memory";

const persona = readSoul(); // returns "" if file doesn't exist
```

## API Reference

### `makeMemoryTools(store?)`

Creates three memory tools (`remember`, `recall`, `reflect`) backed by the given store. Defaults to `JsonlMemoryStore`.

### `JsonlMemoryStore`

Append-only JSONL file store. Reads the full file on query (suitable for thousands of entries).

- Constructor: `new JsonlMemoryStore(path?)` — defaults to `~/.helix/memory.jsonl`
- Implements `MemoryStore` interface

### `readSoul(path?)`

Reads the optional `soul.md` persona file. Returns `""` if absent.

### Types

| Type | Description |
|------|-------------|
| `MemoryStore` | Interface: `remember`, `recall`, `reflect`, `list`, `clear` |
| `MemoryEntry` | `{ ts, type, text, bank, importance }` |
| `MemoryType` | `"fact" \| "preference" \| "project" \| "episodic"` |

## License

MIT
