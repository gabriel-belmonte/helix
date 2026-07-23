// helix-memory — modular, swappable memory for Helix.
//
// The agent only depends on the `MemoryStore` *interface*. The default
// backend is a JSONL file (~/.helix/memory.jsonl), but you can swap it for
// any implementation (SQLite, Postgres, an embeddings-backed vector store, a
// remote API…) by passing a different `MemoryStore` to `makeMemoryTools`.
//
// This mirrors Helix's plugin philosophy: the agent never knows which backend
// is active, so changing the memory system is a one-line change.

import type { Tool } from "helix-agent";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type MemoryType = "fact" | "preference" | "project" | "episodic";

export type MemoryEntry = {
  /** Unix epoch ms when stored. */
  ts: number;
  type: MemoryType;
  text: string;
  /**
   * Scope / "bank". `global` is shared everywhere; `project:<name>` isolates
   * per project (like Hindsight's bank IDs). Recall filters by bank.
   */
  bank: string;
  /** 0..1 — used to rank recall results. */
  importance: number;
};

// --------------------------------------------------------------------------
// Store interface (the swappable boundary)
// --------------------------------------------------------------------------

export interface MemoryStore {
  /** Persist one memory. Returns the stored entry. */
  remember(entry: Omit<MemoryEntry, "ts">): MemoryEntry;
  /** Return up to `n` entries relevant to `query` within `bank`. */
  recall(query: string, opts?: { n?: number; bank?: string }): MemoryEntry[];
  /** Synthesize a short answer from memories relevant to `query`. */
  reflect(query: string, opts?: { bank?: string }): string;
  /** All entries (optionally filtered by bank). */
  list(opts?: { bank?: string }): MemoryEntry[];
  /** Remove all entries in a bank (default: global). */
  clear(opts?: { bank?: string }): void;
}

// --------------------------------------------------------------------------
// Default backend: JSONL file
// --------------------------------------------------------------------------

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

export const MEMORY_DIR = join(homedir(), ".helix");
export const MEMORY_PATH = join(MEMORY_DIR, "memory.jsonl");

/**
 * Append-only JSONL store. Each line is one MemoryEntry. Append-only keeps
 * writes cheap and corruption-free; we read the whole file on query (fine for
 * the thousands-of-entries scale an agent needs).
 */
export class JsonlMemoryStore implements MemoryStore {
  constructor(private path: string = MEMORY_PATH) {}

  private readAll(): MemoryEntry[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, "utf8").trim();
    if (!raw) return [];
    return raw
      .split("\n")
      .map((l) => {
        try {
          return JSON.parse(l) as MemoryEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is MemoryEntry => x !== null);
  }

  private writeAll(entries: MemoryEntry[]): void {
    mkdirSync(this.dirname(), { recursive: true });
    writeFileSync(this.path, entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }

  private dirname(): string {
    const i = this.path.lastIndexOf("/");
    return i === -1 ? "." : this.path.slice(0, i);
  }

  remember(entry: Omit<MemoryEntry, "ts">): MemoryEntry {
    const full: MemoryEntry = { ts: Date.now(), ...entry };
    mkdirSync(this.dirname(), { recursive: true });
    appendFileSync(this.path, JSON.stringify(full) + "\n", "utf8");
    return full;
  }

  recall(query: string, opts: { n?: number; bank?: string } = {}): MemoryEntry[] {
    const n = opts.n ?? 5;
    const all = this.readAll().filter((e) => !opts.bank || e.bank === opts.bank);
    const q = query.toLowerCase();
    // Rank: keyword overlap (weighted) + recency + importance.
    const scored = all.map((e) => {
      const text = e.text.toLowerCase();
      let score = 0;
      for (const term of q.split(/\s+/).filter(Boolean)) {
        if (text.includes(term)) score += 2;
      }
      score += e.importance * 1.5;
      score += (e.ts / 1e15); // small recency boost
      return { e, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n).map((s) => s.e);
  }

  reflect(query: string, opts: { bank?: string } = {}): string {
    const hits = this.recall(query, { n: 5, bank: opts.bank });
    if (hits.length === 0) return "(no relevant memories)";
    const lines = hits.map((h) => `- [${h.type}] ${h.text}`);
    return `Based on memory:\n${lines.join("\n")}`;
  }

  list(opts: { bank?: string } = {}): MemoryEntry[] {
    return this.readAll().filter((e) => !opts.bank || e.bank === opts.bank);
  }

  clear(opts: { bank?: string } = {}): void {
    const keep = this.readAll().filter((e) => opts.bank && e.bank !== opts.bank);
    this.writeAll(keep);
  }
}

// --------------------------------------------------------------------------
// Agent tools (remember / recall / reflect) — backend-agnostic
// --------------------------------------------------------------------------

export type MemoryTools = Tool[];

/**
 * Build the three memory tools backed by the given store. Because they only
 * depend on the `MemoryStore` interface, swapping the backend (e.g. for a
 * SQLite or vector store) requires no change here.
 */
export function makeMemoryTools(store: MemoryStore = new JsonlMemoryStore()): MemoryTools {
  return [
    {
      name: "remember",
      description:
        "Store a durable fact, preference, or project note the agent should keep across sessions. Input: { text, type?, bank?, importance? }.",
      run: async (input: unknown) => {
        const i = (input ?? {}) as Record<string, unknown>;
        const text = typeof i.text === "string" ? i.text : String(i.text ?? "");
        if (!text) return "Error: remember requires a 'text' field.";
        const entry = store.remember({
          type: (i.type as MemoryType) ?? "fact",
          text,
          bank: typeof i.bank === "string" ? i.bank : "global",
          importance: typeof i.importance === "number" ? i.importance : 0.6,
        });
        return `Remembered (${entry.type}, bank=${entry.bank}).`;
      },
    },
    {
      name: "recall",
      description:
        "Retrieve relevant memories by keyword/meaning. Input: { query, bank? }. Returns matching entries.",
      run: async (input: unknown) => {
        const i = (input ?? {}) as Record<string, unknown>;
        const query = typeof i.query === "string" ? i.query : String(i.query ?? "");
        if (!query) return "Error: recall requires a 'query' field.";
        const hits = await store.recall(query, {
          n: typeof i.n === "number" ? i.n : 5,
          bank: typeof i.bank === "string" ? i.bank : "global",
        });
        if (hits.length === 0) return "(no relevant memories)";
        return hits.map((h) => `[${h.type}] ${h.text}`).join("\n");
      },
    },
    {
      name: "reflect",
      description:
        "Synthesize a short answer from accumulated memory relevant to a question. Input: { query, bank? }.",
      run: async (input: unknown) => {
        const i = (input ?? {}) as Record<string, unknown>;
        const query = typeof i.query === "string" ? i.query : String(i.query ?? "");
        if (!query) return "Error: reflect requires a 'query' field.";
        return await store.reflect(query, {
          bank: typeof i.bank === "string" ? i.bank : "global",
        });
      },
    },
  ];
}

/**
 * Read the optional `soul.md` (agent persona) if present. Returns "" if absent
 * so callers can inject it unconditionally. Kept separate from memory.jsonl
 * because it's human-authored Markdown, not agent-accumulated data.
 */
export function readSoul(soulPath: string = join(MEMORY_DIR, "soul.md")): string {
  if (!existsSync(soulPath)) return "";
  return readFileSync(soulPath, "utf8").trim();
}
