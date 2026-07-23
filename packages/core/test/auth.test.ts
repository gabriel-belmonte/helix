import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import os from "node:os";
import {
  setKey,
  resolveKey,
  removeKey,
  fingerprint,
  substitute,
  listCredentials,
} from "../src/auth.js";
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Point auth at a temp HOME so we don't touch the real ~/.helix.
// `helixDir()` resolves via os.homedir(), which does NOT reliably honor
// process.env.HOME (and caches the result), so we override os.homedir() too.
let tmp: string;
const ORIG_HOME = process.env.HOME;
const ORIG_HOMEDIR = os.homedir;

beforeEach(() => {
  tmp = mkdtempSync("/tmp/helix-auth-");
  process.env.HOME = tmp;
  os.homedir = () => tmp;
  delete process.env.OPENCODE_ZEN_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  process.env.HOME = ORIG_HOME;
  os.homedir = ORIG_HOMEDIR;
});

test("setKey writes 0600 file with fingerprint; list never leaks the secret", () => {
  setKey("zen", "sk-very-secret-value");
  const path = join(tmp, ".helix", "auth.json");
  assert.ok(existsSync(path), "auth.json should exist");
  const mode = statSync(path).mode & 0o777;
  assert.strictEqual(mode, 0o600, "auth.json must be chmod 600");

  const data = JSON.parse(readFileSync(path, "utf8"));
  assert.strictEqual(data.credentials.zen.source, "stored");
  assert.strictEqual(data.credentials.zen.secret, "sk-very-secret-value");
  assert.match(data.credentials.zen.fingerprint, /^sha256:/);

  assert.strictEqual(resolveKey("zen"), "sk-very-secret-value");

  const zen = listCredentials().find((c) => c.provider === "zen")!;
  assert.strictEqual(zen.configured, true);
  assert.strictEqual(zen.fingerprint, data.credentials.zen.fingerprint);
  // listCredentials returns no raw secret field
  assert.strictEqual((zen as any).secret, undefined);
});

test("env var takes precedence over stored key", () => {
  setKey("zen", "stored-key");
  process.env.OPENCODE_ZEN_API_KEY = "env-key";
  assert.strictEqual(resolveKey("zen"), "env-key");
});

test("removeKey deletes the credential", () => {
  setKey("openai", "sk-test");
  assert.strictEqual(removeKey("openai"), true);
  assert.strictEqual(resolveKey("openai"), undefined);
  assert.strictEqual(removeKey("openai"), false);
});

test("fingerprint is a stable sha256 prefix", () => {
  const expected = "sha256:" + createHash("sha256").update("abc").digest("hex").slice(0, 12);
  assert.strictEqual(fingerprint("abc"), expected);
});

test("substitute expands {env:VAR} and {file:path}", () => {
  process.env.MY_TOKEN = "tok-123";
  assert.strictEqual(substitute("{env:MY_TOKEN}"), "tok-123");

  const f = join(tmp, "secret.txt");
  writeFileSync(f, "file-secret\n");
  assert.strictEqual(substitute("{file:" + f + "}"), "file-secret");

  // unknown env -> empty string (matches OpenCode behavior)
  assert.strictEqual(substitute("{env:DOES_NOT_EXIST_XYZ}"), "");
});
