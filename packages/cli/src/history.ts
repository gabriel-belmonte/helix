// Persistent conversation history for the Helix REPL.
// Stores the last N conversations in ~/.helix/history.json
// so the REPL can restore context across sessions.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "./config.js";

export type HistoryEntry = {
  ts: number;
  role: "user" | "assistant";
  content: string;
};

const HISTORY_PATH = join(CONFIG_DIR, "history.json");
const MAX_ENTRIES = 200; // keep last 200 messages (~100 turns)

let _cache: HistoryEntry[] | null = null;

function loadRaw(): HistoryEntry[] {
  if (_cache) return _cache;
  try {
    if (!existsSync(HISTORY_PATH)) { _cache = []; return _cache; }
    const data = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
    _cache = Array.isArray(data) ? data : [];
  } catch {
    _cache = [];
  }
  return _cache!;
}

function flush(entries: HistoryEntry[]): void {
  // Trim to max entries
  const trimmed = entries.slice(-MAX_ENTRIES);
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2) + "\n", "utf8");
  _cache = trimmed;
}

/** Append a message to persistent history. */
export function appendHistory(role: "user" | "assistant", content: string): void {
  const entries = loadRaw();
  entries.push({ ts: Date.now(), role, content });
  flush(entries);
}

/** Load the last N history entries (for seeding a new agent session). */
export function loadHistory(n = 20): HistoryEntry[] {
  return loadRaw().slice(-n);
}

/** Clear all history. */
export function clearHistory(): void {
  flush([]);
}
