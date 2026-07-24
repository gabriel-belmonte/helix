#!/usr/bin/env bun
// Verify examples compile and run correctly.
// Usage: bun run verify-examples.ts

import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "packages/agent/examples");
const files = (await readdir(examplesDir)).filter(f => f.endsWith(".ts"));

console.log(`Found ${files.length} examples\n`);

let passed = 0;
let failed = 0;

for (const file of files) {
  const path = join(examplesDir, file);
  process.stdout.write(`  ${file} ... `);
  try {
    const out = execSync(`bun run ${path}`, {
      timeout: 15000,
      encoding: "utf8",
      cwd: join(__dirname, "packages/agent"),
    });
    console.log(`✓ (${out.trim().split("\n").length} lines)`);
    passed++;
  } catch (e: any) {
    console.log(`✗ ${e.stderr?.slice(0, 200) ?? e.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} examples passed`);
if (failed > 0) process.exit(1);
