import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  checkpointBeforeWrite,
  listCheckpoints,
  rollbackFile,
  restoreById,
  rollbackTool,
} from "../src/checkpoint.js";

// Override CHECKPOINT_DIR for tests by tricking homedir.
// We mock homedir by patching before imports... Instead, we use the env variable
// or just test with the real ~/.helix/checkpoints and clean up.

// Simpler: we create checkpoints, read/write files in temp dir, and verify.
// checkpointBeforeWrite uses ~/.helix/checkpoints which persists across tests.
// For isolation we'll test the core logic directly.

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync("/tmp/helix-ckpt-");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test("checkpointBeforeWrite returns null for non-existent file", () => {
  const result = checkpointBeforeWrite(join(tmpDir, "nonexistent.txt"));
  assert.strictEqual(result, null);
});

test("checkpointBeforeWrite creates snapshot for existing file", () => {
  const filePath = join(tmpDir, "test.txt");
  writeFileSync(filePath, "original content", "utf8");

  const id = checkpointBeforeWrite(filePath);
  assert.ok(id, "should return a checkpoint id");
  assert.ok(typeof id === "string" && id.length > 0, "id should be a non-empty string");

  // Verify checkpoint was created in ~/.helix/checkpoints/
  const checkpoints = listCheckpoints(filePath, 5);
  assert.ok(checkpoints.length >= 1, "should have at least one checkpoint");
  const matched = checkpoints.find((c) => c.originalPath === filePath);
  assert.ok(matched, "should find a checkpoint matching the file path");
  assert.ok(matched.size > 0, "checkpoint should have content");
});

test("rollbackFile restores original content after overwrite", () => {
  const filePath = join(tmpDir, "rollback-test.txt");
  writeFileSync(filePath, "original content", "utf8");

  const id = checkpointBeforeWrite(filePath);
  assert.ok(id, "checkpoint should be created");

  // Overwrite the file
  writeFileSync(filePath, "new content", "utf8");
  assert.strictEqual(readFileSync(filePath, "utf8"), "new content");

  // Rollback
  const result = rollbackFile(filePath);
  assert.ok(result.success, "rollback should succeed");
  assert.match(result.message, /Restored/);

  // Verify content is restored
  const restoredContent = readFileSync(filePath, "utf8");
  assert.strictEqual(restoredContent, "original content", "should restore original content");
});

test("restoreById restores by checkpoint id", () => {
  const filePath = join(tmpDir, "by-id-test.txt");
  writeFileSync(filePath, "version 1", "utf8");

  const id = checkpointBeforeWrite(filePath);
  assert.ok(id);

  // Overwrite
  writeFileSync(filePath, "version 2", "utf8");

  // Restore by id
  const result = restoreById(id);
  assert.ok(result.success);
  assert.strictEqual(readFileSync(filePath, "utf8"), "version 1");
});

test("restoreById returns error for unknown id", () => {
  const result = restoreById("nonexistent-id-12345");
  assert.ok(!result.success);
  assert.match(result.message, /not found/);
});

test("rollbackFile returns error for file with no checkpoint", () => {
  const filePath = join(tmpDir, "never-checkpointed.txt");
  const result = rollbackFile(filePath);
  assert.ok(!result.success);
  assert.match(result.message, /No checkpoint/);
});

test("listCheckpoints returns newest first", async () => {
  const f1 = join(tmpDir, "alpha.txt");
  const f2 = join(tmpDir, "beta.txt");

  writeFileSync(f1, "alpha v1", "utf8");
  writeFileSync(f2, "beta v1", "utf8");

  const id1 = checkpointBeforeWrite(f1);
  assert.ok(id1);

  // Small delay to ensure different timestamps
  await new Promise((r) => setTimeout(r, 15));
  const id2 = checkpointBeforeWrite(f2);
  assert.ok(id2);

  const all = listCheckpoints(undefined, 10);
  assert.ok(all.length >= 2);
  // id2 (created after delay) should appear before id1
  const idx1 = all.findIndex((c) => c.id === id1);
  const idx2 = all.findIndex((c) => c.id === id2);
  assert.ok(idx1 >= 0, "id1 should be in results");
  assert.ok(idx2 >= 0, "id2 should be in results");
  assert.ok(idx2 < idx1, "newest checkpoint should be first");
});

test("rollbackTool agent tool: path mode", async () => {
  const filePath = join(tmpDir, "agent-tool.txt");
  writeFileSync(filePath, "agent original", "utf8");
  const id = checkpointBeforeWrite(filePath);
  assert.ok(id);

  writeFileSync(filePath, "agent overwrite", "utf8");

  const msg = await rollbackTool({ path: filePath });
  assert.match(msg, /Restored/);
  assert.strictEqual(readFileSync(filePath, "utf8"), "agent original");
});

test("rollbackTool agent tool: last mode", async () => {
  const filePath = join(tmpDir, "agent-last.txt");
  writeFileSync(filePath, "last original", "utf8");
  const id = checkpointBeforeWrite(filePath);
  assert.ok(id);

  writeFileSync(filePath, "last overwrite", "utf8");

  const msg = await rollbackTool({ target: "last" });
  assert.match(msg, /Restored/);
  assert.strictEqual(readFileSync(filePath, "utf8"), "last original");
});

test("rollbackTool agent tool: list mode", async () => {
  const filePath = join(tmpDir, "agent-list.txt");
  writeFileSync(filePath, "list content", "utf8");
  checkpointBeforeWrite(filePath);

  const msg = await rollbackTool({ target: "list" });
  assert.match(msg, /Available checkpoints/);
  assert.match(msg, /agent-list/);
});

test("rollbackTool agent tool: id mode", async () => {
  const filePath = join(tmpDir, "agent-id.txt");
  writeFileSync(filePath, "id original", "utf8");
  const id = checkpointBeforeWrite(filePath);
  assert.ok(id);

  writeFileSync(filePath, "id overwrite", "utf8");

  const msg = await rollbackTool({ id });
  assert.match(msg, /Restored/);
  assert.strictEqual(readFileSync(filePath, "utf8"), "id original");
});

test("rollbackTool returns usage for no params", async () => {
  const msg = await rollbackTool({});
  assert.match(msg, /Usage/);
});
