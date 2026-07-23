import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlMemoryStore, makeMemoryTools, readSoul, type MemoryStore } from "../src/index.js";

let dir: string;
function freshStore(): JsonlMemoryStore {
  dir = mkdtempSync(join(tmpdir(), "helix-mem-"));
  return new JsonlMemoryStore(join(dir, "memory.jsonl"));
}

test("remember persists and recall finds by keyword", () => {
  const s = freshStore();
  s.remember({ type: "fact", text: "The VPS has 24GB RAM", bank: "global", importance: 0.7 });
  s.remember({ type: "preference", text: "User prefers Bun toolchain", bank: "global", importance: 0.9 });
  const hits = s.recall("Bun toolchain");
  assert.ok(hits.length >= 1);
  assert.ok(hits.some((h) => h.text.includes("Bun")));
});

test("recall respects bank scoping", () => {
  const s = freshStore();
  s.remember({ type: "fact", text: "helix detail", bank: "project:helix", importance: 0.5 });
  s.remember({ type: "fact", text: "global detail", bank: "global", importance: 0.5 });
  const projectHits = s.recall("detail", { bank: "project:helix" });
  assert.equal(projectHits.length, 1);
  assert.equal(projectHits[0].bank, "project:helix");
});

test("clear removes entries in a bank only", () => {
  const s = freshStore();
  s.remember({ type: "fact", text: "a", bank: "global", importance: 0.5 });
  s.remember({ type: "fact", text: "b", bank: "project:x", importance: 0.5 });
  s.clear({ bank: "global" });
  assert.equal(s.list({ bank: "global" }).length, 0);
  assert.equal(s.list({ bank: "project:x" }).length, 1);
});

test("makeMemoryTools exposes remember/recall/reflect", async () => {
  const s: MemoryStore = freshStore();
  const tools = makeMemoryTools(s);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["recall", "reflect", "remember"]);

  const r1 = await tools[0].run!({ text: "User likes concise replies", type: "preference", importance: 0.8 });
  assert.match(String(r1), /Remembered/);

  const r2 = await tools[2].run!({ query: "concise" });
  assert.match(String(r2), /concise replies/);

  const r3 = await tools[1].run!({ query: "style" });
  assert.match(String(r3), /concise replies/);
});

test("readSoul returns empty when file absent", () => {
  const soul = readSoul(join(dir ?? tmpdir(), "nonexistent-soul.md"));
  assert.equal(soul, "");
});
