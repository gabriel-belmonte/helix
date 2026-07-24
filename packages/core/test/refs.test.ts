import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRefs } from "../src/refs.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync("/tmp/helix-refs-");
  process.chdir(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ── @path (single file) ───────────────────────────────────────────────────

test("resolveRefs inlines a single file reference", async () => {
  writeFileSync(join(dir, "hello.ts"), "const x = 1;\n");
  const result = await resolveRefs("review @hello.ts");
  assert.match(result, /review/);
  assert.match(result, /\[Referenced: hello\.ts\]/);
  assert.match(result, /const x = 1;/);
  assert.match(result, /```/);
});

test("resolveRefs handles multiple @path references", async () => {
  writeFileSync(join(dir, "a.ts"), "// a");
  writeFileSync(join(dir, "b.ts"), "// b");
  const result = await resolveRefs("diff @a.ts and @b.ts");

  // Both files should be referenced
  assert.match(result, /\[Referenced: a\.ts\]/);
  assert.match(result, /\[Referenced: b\.ts\]/);
  assert.match(result, /\/\/ a/);
  assert.match(result, /\/\/ b/);
});

test("resolveRefs reports error for missing file", async () => {
  const result = await resolveRefs("check @nonexistent.ts");
  assert.match(result, /\[Referenced: nonexistent\.ts\]/);
  assert.match(result, /⚠ File not found/);
});

test("resolveRefs returns original text when no @-refs", async () => {
  const result = await resolveRefs("just some text without refs");
  assert.strictEqual(result, "just some text without refs");
});

test("resolveRefs handles @path with no content after at-sign (edge case)", async () => {
  const result = await resolveRefs("trailing @");
  assert.strictEqual(result, "trailing @");
});

// ── @git-diff ─────────────────────────────────────────────────────────────

test("resolveRefs resolves @git-diff reference", async () => {
  // Create a git repo with a change
  const { execSync } = await import("node:child_process");
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "file.ts"), "initial content\n");
  execSync("git add -A && git commit -m init", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "file.ts"), "modified content\n");

  const result = await resolveRefs("what changed? @git-diff");
  assert.match(result, /\[Referenced: git diff\]/);
  assert.match(result, /-initial content/);
  assert.match(result, /\+modified content/);
});

test("@git-diff with no changes produces error block", async () => {
  const { execSync } = await import("node:child_process");
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "file.ts"), "content\n");
  execSync("git add -A && git commit -m init", { cwd: dir, stdio: "pipe" });

  const result = await resolveRefs("status @git-diff");
  assert.match(result, /\[Referenced: git diff\]/);
  assert.match(result, /No changes/);
});

// ── @url ──────────────────────────────────────────────────────────────────

test("resolveRefs fetches @url content", async () => {
  // Use a known stable URL
  const result = await resolveRefs("check @https://example.com");
  assert.match(result, /\[Referenced: https:\/\/example\.com\]/);
  assert.match(result, /Example Domain/);
});

test("resolveRefs reports error for unreachable URL", async () => {
  const result = await resolveRefs("check @https://nonexistent.example.test/foo");
  assert.match(result, /\[Referenced: https:\/\/nonexistent\.example\.test\/foo\]/);
  // Should report some kind of fetch error
  assert.ok(
    result.includes("⚠") || result.toLowerCase().includes("error") || result.toLowerCase().includes("failed"),
    `Expected error indicator in: ${result.slice(0, 200)}`
  );
});

// ── Mixed ─────────────────────────────────────────────────────────────────

test("resolveRefs handles @path and @git-diff together", async () => {
  writeFileSync(join(dir, "readme.md"), "# Hello");
  const { execSync } = await import("node:child_process");
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name Test", { cwd: dir, stdio: "pipe" });
  execSync("git add -A && git commit -m init", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "readme.md"), "# Hello\n\nUpdated");

  const result = await resolveRefs("check @readme.md and @git-diff");
  assert.match(result, /\[Referenced: readme\.md\]/);
  assert.match(result, /\[Referenced: git diff\]/);
  assert.match(result, /# Hello/);
  assert.match(result, /\+Updated/);
});

// ── Edge cases ────────────────────────────────────────────────────────────

test("resolveRefs handles @ in string that isn't a reference", async () => {
  const result = await resolveRefs("email me at test@example.com");
  // The email domain might be picked up — that's OK, should try to read a file
  assert.ok(result.length > 0);
});

test("resolveRefs handles repeated same @path (dedup)", async () => {
  writeFileSync(join(dir, "shared.ts"), "// shared code");
  const result = await resolveRefs("look at @shared.ts and @shared.ts again");
  // The file content should appear only once
  const occurrences = result.match(/\[Referenced: shared\.ts\]/g);
  assert.strictEqual(occurrences?.length, 1);
});

test("resolveRefs handles @ in punctuation context", async () => {
  const result = await resolveRefs("no ref here just an @.");
  assert.ok(result.length > 0);
});
