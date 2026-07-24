import { test } from "node:test";
import assert from "node:assert";

test("helix-cli binary exists", () => {
  const { existsSync } = require("node:fs");
  const { join } = require("node:path");
  const bin = join(__dirname, "..", "cli.ts");
  assert.ok(existsSync(bin), `cli.ts exists at ${bin}`);
});
