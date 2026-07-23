// helix-core — OpenCode Zen model catalog.
//
// Zen is an OpenAI-compatible gateway (https://opencode.ai/zen/v1) that proxies
// many upstream models. This module ships a curated, typed catalog so surfaces
// (CLI, TUI, web) can offer a model picker without a network call. The list is
// refreshed from `GET /v1/models` when a key is available; `ZEN_MODELS` is the
// offline fallback.
//
// Free models are marked with the `-free` suffix in Zen's API. We expose that
// as a first-class `free` boolean so UIs can highlight them.

import { resolveKey } from "./auth.js";

export type ZenModel = {
  id: string;
  /** Free to use (no balance / quota). Zen marks these with a `-free` suffix. */
  free: boolean;
  /** Human-friendly label (same as id for now). */
  label: string;
};

// Curated catalog (from GET /v1/models on 2026-07-23). `big-pickle` is the
// default model Zen gives new keys. Free models carry the `-free` suffix.
export const ZEN_MODELS: ZenModel[] = [
  { id: "big-pickle", free: false, label: "big-pickle (default)" },
  // Free tier
  { id: "deepseek-v4-flash-free", free: true, label: "DeepSeek v4 Flash (free)" },
  { id: "laguna-s-2.1-free", free: true, label: "Laguna S 2.1 (free)" },
  { id: "mimo-v2.5-free", free: true, label: "Mimo v2.5 (free)" },
  { id: "nemotron-3-ultra-free", free: true, label: "Nemotron 3 Ultra (free)" },
  { id: "north-mini-code-free", free: true, label: "North Mini Code (free)" },
  // Claude
  { id: "claude-opus-4-8", free: false, label: "Claude Opus 4.8" },
  { id: "claude-opus-4-7", free: false, label: "Claude Opus 4.7" },
  { id: "claude-opus-4-6", free: false, label: "Claude Opus 4.6" },
  { id: "claude-opus-4-5", free: false, label: "Claude Opus 4.5" },
  { id: "claude-opus-4-1", free: false, label: "Claude Opus 4.1" },
  { id: "claude-sonnet-5", free: false, label: "Claude Sonnet 5" },
  { id: "claude-sonnet-4-6", free: false, label: "Claude Sonnet 4.6" },
  { id: "claude-sonnet-4-5", free: false, label: "Claude Sonnet 4.5" },
  { id: "claude-sonnet-4", free: false, label: "Claude Sonnet 4" },
  { id: "claude-haiku-4-5", free: false, label: "Claude Haiku 4.5" },
  { id: "claude-fable-5", free: false, label: "Claude Fable 5" },
  // GPT
  { id: "gpt-5.6-terra", free: false, label: "GPT-5.6 Terra" },
  { id: "gpt-5.6-sol", free: false, label: "GPT-5.6 Sol" },
  { id: "gpt-5.6-luna", free: false, label: "GPT-5.6 Luna" },
  { id: "gpt-5.5", free: false, label: "GPT-5.5" },
  { id: "gpt-5.5-pro", free: false, label: "GPT-5.5 Pro" },
  { id: "gpt-5.4", free: false, label: "GPT-5.4" },
  { id: "gpt-5.4-pro", free: false, label: "GPT-5.4 Pro" },
  { id: "gpt-5.4-mini", free: false, label: "GPT-5.4 Mini" },
  { id: "gpt-5.4-nano", free: false, label: "GPT-5.4 Nano" },
  { id: "gpt-5.3-codex", free: false, label: "GPT-5.3 Codex" },
  { id: "gpt-5.3-codex-spark", free: false, label: "GPT-5.3 Codex Spark" },
  { id: "gpt-5.2", free: false, label: "GPT-5.2" },
  { id: "gpt-5.2-codex", free: false, label: "GPT-5.2 Codex" },
  { id: "gpt-5.1", free: false, label: "GPT-5.1" },
  { id: "gpt-5.1-codex", free: false, label: "GPT-5.1 Codex" },
  { id: "gpt-5.1-codex-max", free: false, label: "GPT-5.1 Codex Max" },
  { id: "gpt-5.1-codex-mini", free: false, label: "GPT-5.1 Codex Mini" },
  { id: "gpt-5", free: false, label: "GPT-5" },
  { id: "gpt-5-codex", free: false, label: "GPT-5 Codex" },
  { id: "gpt-5-nano", free: false, label: "GPT-5 Nano" },
  // Gemini
  { id: "gemini-3.6-flash", free: false, label: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash", free: false, label: "Gemini 3.5 Flash" },
  { id: "gemini-3.5-flash-lite", free: false, label: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.1-pro", free: false, label: "Gemini 3.1 Pro" },
  { id: "gemini-3-flash", free: false, label: "Gemini 3 Flash" },
  // Others
  { id: "deepseek-v4-flash", free: false, label: "DeepSeek v4 Flash" },
  { id: "deepseek-v4-pro", free: false, label: "DeepSeek v4 Pro" },
  { id: "glm-5.2", free: false, label: "GLM 5.2" },
  { id: "glm-5.1", free: false, label: "GLM 5.1" },
  { id: "glm-5", free: false, label: "GLM 5" },
  { id: "grok-4.5", free: false, label: "Grok 4.5" },
  { id: "grok-build-0.1", free: false, label: "Grok Build 0.1" },
  { id: "kimi-k2.7-code", free: false, label: "Kimi K2.7 Code" },
  { id: "kimi-k2.6", free: false, label: "Kimi K2.6" },
  { id: "kimi-k2.5", free: false, label: "Kimi K2.5" },
  { id: "minimax-m3", free: false, label: "MiniMax M3" },
  { id: "minimax-m2.7", free: false, label: "MiniMax M2.7" },
  { id: "minimax-m2.5", free: false, label: "MiniMax M2.5" },
  { id: "qwen3.6-plus", free: false, label: "Qwen3.6 Plus" },
  { id: "qwen3.5-plus", free: false, label: "Qwen3.5 Plus" },
];

export const ZEN_BASE_URL = "https://opencode.ai/zen/v1";

/** Mark a model id as free if it carries the `-free` suffix. */
export function isFreeModel(id: string): boolean {
  return id.endsWith("-free");
}

/**
 * Fetch the live model list from Zen (requires a key). Falls back to the
 * curated ZEN_MODELS when offline / no key. Free models are detected by the
 * `-free` suffix.
 */
export async function fetchZenModels(opts?: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<ZenModel[]> {
  const key = opts?.apiKey ?? resolveKey("zen");
  const baseUrl = opts?.baseUrl ?? process.env.OPENCODE_ZEN_BASE_URL ?? ZEN_BASE_URL;
  if (!key) return ZEN_MODELS;
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return ZEN_MODELS;
    const data = (await res.json()) as { data?: { id: string }[] };
    if (!data.data?.length) return ZEN_MODELS;
    return data.data
      .map((m) => ({
        id: m.id,
        free: isFreeModel(m.id),
        label: m.id,
      }))
      .sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
  } catch {
    return ZEN_MODELS;
  }
}
