// Secret storage for Helix — API keys and provider credentials.
//
// DESIGN (mirrors the industry standard used by Hermes, OpenCode, Codex,
// Claude Code): plain JSON at ~/.helix/auth.json with chmod 600, SEPARATE from
// the non-secret config.json. No at-rest encryption by default — on a local
// machine the decrypt key would live next to the ciphertext, so 0600 file
// perms are the real boundary. OS keychain is a future opt-in.
//
// Resolution order for a provider's key (first hit wins):
//   1. Environment variable (e.g. OPENCODE_ZEN_API_KEY)  → CI / containers
//   2. auth.json stored secret                            → `helix auth login`
//
// Stored entries support indirection so power users never hardcode a secret:
//   { "source": "env:MY_VAR" }        → read from an env var at use time
//   { "source": "file:~/.secret" }    → read from a file at use time
//   { "source": "stored", secret }    → the secret lives inline (0600)

import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";

export function helixDir(): string {
  // Honor an explicit override (HELIX_HOME, then HOME) before falling back to
  // the OS home directory. On POSIX, os.homedir() ignores $HOME, so we must
  // check the env vars ourselves for tools/tests that redirect HOME.
  const base = process.env.HELIX_HOME || process.env.HOME;
  return join(base ?? homedir(), ".helix");
}
export function authPath(): string {
  return join(helixDir(), "auth.json");
}
// Back-compat constants (computed once at import; code that must honor a
// changed HOME — e.g. tests — should call the functions above instead).
export const HELIX_DIR = helixDir();
export const AUTH_PATH = authPath();

// Known providers and the env var each one reads (also its default key name).
export const PROVIDER_ENV: Record<string, string> = {
  zen: "OPENCODE_ZEN_API_KEY",
  hf: "HF_TOKEN",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export type StoredCredential = {
  auth_type: "api_key";
  // Where the secret comes from: "stored" (inline), "env:VAR", or "file:path".
  source: string;
  // Present only when source === "stored".
  secret?: string;
  base_url?: string;
  // sha256 of the resolved secret — lets us display "…4f2a" without exposing it.
  fingerprint?: string;
  updated_at: string;
};

export type AuthFile = {
  version: 1;
  credentials: Record<string, StoredCredential>;
};

function emptyAuth(): AuthFile {
  return { version: 1, credentials: {} };
}

export function loadAuth(): AuthFile {
  try {
    const p = authPath();
    if (!existsSync(p)) return emptyAuth();
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    if (!parsed || typeof parsed !== "object") return emptyAuth();
    return { version: 1, credentials: parsed.credentials ?? {} };
  } catch {
    return emptyAuth();
  }
}

export function saveAuth(auth: AuthFile): void {
  mkdirSync(helixDir(), { recursive: true });
  const p = authPath();
  writeFileSync(p, JSON.stringify(auth, null, 2) + "\n", "utf8");
  // Lock it down: owner read/write only.
  try {
    chmodSync(p, 0o600);
  } catch {
    /* best effort on platforms without POSIX perms */
  }
}

export function fingerprint(secret: string): string {
  return "sha256:" + createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

// A short, safe-to-display hint like "…a1b2" for a secret.
export function maskSecret(secret: string): string {
  if (secret.length <= 4) return "****";
  return "…" + secret.slice(-4);
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

// Resolve a stored credential's `source` into the actual secret string.
function resolveSource(cred: StoredCredential): string | undefined {
  const src = cred.source;
  if (src === "stored") return cred.secret;
  if (src.startsWith("env:")) return process.env[src.slice(4)] || undefined;
  if (src.startsWith("file:")) {
    try {
      return readFileSync(expandHome(src.slice(5)), "utf8").trim();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Substitute {env:VAR} and {file:path} placeholders inside any config string.
// Mirrors OpenCode's config substitution so power users can reference secrets.
export function substitute(value: string): string {
  return value
    .replace(/\{env:([A-Z0-9_]+)\}/gi, (_m, name) => process.env[name] ?? "")
    .replace(/\{file:([^}]+)\}/g, (_m, path) => {
      try {
        return readFileSync(expandHome(path.trim()), "utf8").trim();
      } catch {
        return "";
      }
    });
}

/**
 * Resolve the API key for a provider.
 * Order: env var (PROVIDER_ENV) > auth.json stored credential.
 * Returns undefined if nothing is configured.
 */
export function resolveKey(provider: string): string | undefined {
  const envName = PROVIDER_ENV[provider];
  if (envName && process.env[envName]) return process.env[envName];

  const cred = loadAuth().credentials[provider];
  if (cred) return resolveSource(cred);

  return undefined;
}

/** Store (or update) a provider's key inline. Writes 0600. */
export function setKey(
  provider: string,
  secret: string,
  opts: { baseUrl?: string } = {}
): void {
  const auth = loadAuth();
  auth.credentials[provider] = {
    auth_type: "api_key",
    source: "stored",
    secret,
    base_url: opts.baseUrl,
    fingerprint: fingerprint(secret),
    updated_at: new Date().toISOString(),
  };
  saveAuth(auth);
}

/** Point a provider at an env var or file instead of storing the secret inline. */
export function setKeySource(
  provider: string,
  source: string,
  opts: { baseUrl?: string } = {}
): void {
  const auth = loadAuth();
  const resolved = resolveSource({ auth_type: "api_key", source, updated_at: "" });
  auth.credentials[provider] = {
    auth_type: "api_key",
    source,
    base_url: opts.baseUrl,
    fingerprint: resolved ? fingerprint(resolved) : undefined,
    updated_at: new Date().toISOString(),
  };
  saveAuth(auth);
}

/** Remove a provider's stored credential. Returns true if one existed. */
export function removeKey(provider: string): boolean {
  const auth = loadAuth();
  if (!auth.credentials[provider]) return false;
  delete auth.credentials[provider];
  saveAuth(auth);
  return true;
}

export type CredentialStatus = {
  provider: string;
  source: string;
  fingerprint?: string;
  fromEnv: boolean;
  configured: boolean;
};

/** List every known provider and where its key (if any) comes from. */
export function listCredentials(): CredentialStatus[] {
  const auth = loadAuth();
  const providers = new Set([
    ...Object.keys(PROVIDER_ENV),
    ...Object.keys(auth.credentials),
  ]);
  return [...providers].sort().map((provider) => {
    const envName = PROVIDER_ENV[provider];
    const fromEnv = !!(envName && process.env[envName]);
    const cred = auth.credentials[provider];
    return {
      provider,
      source: fromEnv ? `env:${envName}` : cred?.source ?? "(none)",
      fingerprint: cred?.fingerprint,
      fromEnv,
      configured: fromEnv || !!cred,
    };
  });
}
