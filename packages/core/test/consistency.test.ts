import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---- PROVIDER_ENV must stay in sync with PROVIDERS and HelixConfig ----
//
// Three places define the list of known providers:
//   1. PROVIDER_ENV        in core/src/auth.ts      (env var per provider)
//   2. PROVIDERS           in web/src/sections/Config.tsx  (dashboard dropdown)
//   3. HelixConfig.provider in core/src/registry.ts (type union)
//
// This test catches drift when a new provider is added to only one location.

const EXPECTED_PROVIDERS = [
  "zen",
  "hf",
  "openrouter",
  "openai",
  "anthropic",
] as const;

test("PROVIDER_ENV covers all known providers", () => {
  // Dynamic import so Bun resolves it from the compiled output
  const { PROVIDER_ENV } = require("../src/auth.js");
  const keys = Object.keys(PROVIDER_ENV).sort();
  assert.deepStrictEqual(
    keys,
    [...EXPECTED_PROVIDERS].sort(),
    `PROVIDER_ENV keys ${JSON.stringify(keys)} don't match expected ${JSON.stringify(EXPECTED_PROVIDERS)}`
  );
});

test("PROVIDER_ENV env vars are non-empty and unique", () => {
  const { PROVIDER_ENV } = require("../src/auth.js");
  const seen = new Set<string>();
  for (const [provider, envVar] of Object.entries(PROVIDER_ENV)) {
    assert.ok(
      typeof envVar === "string" && envVar.length > 0,
      `PROVIDER_ENV.${provider} should be a non-empty string`
    );
    assert.ok(
      !seen.has(envVar),
      `PROVIDER_ENV env var "${envVar}" is duplicated`
    );
    seen.add(envVar);
  }
});

test("Config.tsx PROVIDERS list matches expected providers", () => {
  // Read the source file directly; it's a small constant.
  const configTsxPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../web/src/sections/Config.tsx"
  );
  const src = readFileSync(configTsxPath, "utf8");

  // Match the PROVIDERS array literal. Example: const PROVIDERS = ["zen", "hf", ...];
  const match = src.match(/const\s+PROVIDERS\s*=\s*(\[[^\]]+\])/);
  assert.ok(match, "Could not find PROVIDERS array in Config.tsx");
  const parsed: string[] = JSON.parse(match[1]);
  assert.deepStrictEqual(
    [...parsed].sort(),
    [...EXPECTED_PROVIDERS].sort(),
    `Config.tsx PROVIDERS ${JSON.stringify(parsed)} don't match expected ${JSON.stringify(EXPECTED_PROVIDERS)}`
  );
});

test("HelixConfig.provider type includes all expected providers", () => {
  // Validate that the HelixConfig type definition contains all providers.
  // We check the registry source for the provider union in the type.
  const registryPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../src/registry.ts"
  );
  const src = readFileSync(registryPath, "utf8");

  // The type definition is: provider?: "zen" | "hf" | "openrouter" | "openai" | "anthropic";
  const providerMatch = src.match(/provider\??:\s*("[^"]*"(?:\s*\|\s*"[^"]*")*)/);
  assert.ok(providerMatch, "Could not find HelixConfig.provider type in registry.ts");

  // Extract the union members
  const typeStr = providerMatch[1];
  const members = typeStr.split(/\s*\|\s*/).map((s) => s.replace(/^"|"$/g, ""));
  assert.deepStrictEqual(
    [...members].sort(),
    [...EXPECTED_PROVIDERS].sort(),
    `HelixConfig.provider members ${JSON.stringify(members)} don't match expected ${JSON.stringify(EXPECTED_PROVIDERS)}`
  );
});
