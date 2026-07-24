// Context References (@-refs)
//
// Pre-process user messages for @path, @url, @git-diff patterns and inline
// the referenced content before it reaches the agent loop.
//
// Patterns:
//   @<path>        → inline file contents (e.g. @src/index.ts)
//   @src/**/*.ts   → glob: inline all matching files with headers
//   @url           → fetch and inline (e.g. @https://example.com/doc.md)
//   @git-diff      → git diff output (e.g. @git-diff or @git-diff --cached)

import { readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execSync } from "node:child_process";

// ── Regex patterns ─────────────────────────────────────────────────────────

/** Match @git-diff with optional args like `@git-diff --cached` */
const GIT_DIFF_RE = /@git-diff(?:\s+(--\S+(?:\s+--\S+)*))?/g;

/** Match @https?:// URLs */
const URL_RE = /@(https?:\/\/[^\s\)\]\}]+)/g;

/**
 * Match @path references — any `@` followed by a non-whitespace token that
 * isn't a URL and isn't `git-diff`.
 * Uses \S+ (non-whitespace) and then filters non-path entries in the resolver.
 */
const PATH_RE = /@(\S+)/g;

// ── Helpers ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 1024 * 512; // 512 KB per file

/** Check if a path string looks like a glob (contains *, ?, or {). */
function isGlob(pattern: string): boolean {
  return /[\*\?\{]/.test(pattern);
}

/** Resolve a glob pattern to matching files using `find`. */
function expandGlob(pattern: string): string[] {
  try {
    const cwd = process.cwd();
    // Make pattern relative if absolute
    const relPattern = pattern.startsWith("/") ? relative(cwd, pattern) : pattern;
    const cmd = `find ${JSON.stringify(cwd)} -path ${JSON.stringify(joinPath(cwd, relPattern))} -type f 2>/dev/null | sort`;
    const out = execSync(cmd, { encoding: "utf8", timeout: 10_000 });
    const files = out.trim().split("\n").filter(Boolean);
    return files.map((f) => relative(cwd, f));
  } catch {
    return [];
  }
}

/** Join path segments safely. */
function joinPath(...parts: string[]): string {
  // Simple join with forward slash (works on POSIX)
  return parts.join("/").replace(/\/+/g, "/");
}

/** Read a single file, returning its content or an error message. */
function readFileContent(path: string): { content: string; error?: string } {
  const cwd = process.cwd();
  const abs = resolve(cwd, path);
  try {
    const stat = statSync(abs);
    if (!stat.isFile()) return { content: "", error: `Not a file: ${path}` };
    if (stat.size > MAX_FILE_SIZE) {
      return { content: "", error: `File too large (${(stat.size / 1024).toFixed(1)} KB, max ${MAX_FILE_SIZE / 1024} KB): ${path}` };
    }
    const content = readFileSync(abs, "utf8");
    return { content };
  } catch (e: any) {
    if (e.code === "ENOENT") return { content: "", error: `File not found: ${path}` };
    return { content: "", error: `Error reading ${path}: ${e.message}` };
  }
}

/** Format a single reference block. */
function formatRef(title: string, content: string): string {
  return `[Referenced: ${title}]\n\`\`\`\n${content}\n\`\`\``;
}

/** Format an error block. */
function formatError(title: string, error: string): string {
  return `[Referenced: ${title}]\n> ⚠ ${error}`;
}

// ── Resolvers ──────────────────────────────────────────────────────────────

/** Resolve @git-diff references. */
function resolveGitDiff(text: string): { text: string; blocks: string[] } {
  let result = text;
  const blocks: string[] = [];

  result = result.replace(GIT_DIFF_RE, (_match, args?: string) => {
    try {
      const cmd = `git diff${args ? ` ${args}` : ""}`;
      const output = execSync(cmd, {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
      });
      const title = args ? `git diff ${args}` : "git diff";
      if (output.trim()) {
        blocks.push(formatRef(title, output.trim()));
      } else {
        blocks.push(formatError(title, "No changes"));
      }
    } catch (e: any) {
      blocks.push(formatError("git diff", e.message));
    }
    return ""; // Remove the @git-diff reference from the text
  });

  return { text: result, blocks };
}

/** Resolve @url references. */
async function resolveUrls(text: string): Promise<{ text: string; blocks: string[] }> {
  let result = text;
  const blocks: string[] = [];
  const seen = new Set<string>();

  // Collect all unique URLs
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  const urlRegex = new RegExp(URL_RE.source, "g");
  while ((m = urlRegex.exec(result)) !== null) {
    const url = m[1];
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  // Fetch all URLs concurrently
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const content = await resp.text();
      return { url, content: content.slice(0, MAX_FILE_SIZE) };
    })
  );

  const urlBlockMap = new Map<string, string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      urlBlockMap.set(r.value.url, formatRef(r.value.url, r.value.content));
    } else {
      urlBlockMap.set(urls[results.indexOf(r)], formatError(urls[results.indexOf(r)], r.reason?.message ?? "Fetch failed"));
    }
  }

  // Replace URLs in order (process from end to start to preserve positions)
  const urlReplacements: { index: number; original: string; block: string }[] = [];
  const positionRegex = new RegExp(URL_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = positionRegex.exec(result)) !== null) {
    const url = match[1];
    const block = urlBlockMap.get(url) ?? formatError(url, "Unknown error");
    urlReplacements.push({ index: match.index, original: match[0], block });
  }

  // Replace from right to left to preserve indices
  urlReplacements.sort((a, b) => b.index - a.index);
  for (const repl of urlReplacements) {
    result = result.slice(0, repl.index) + result.slice(repl.index + repl.original.length);
  }

  // Collect blocks in original order
  const seenBlocks = new Set<string>();
  for (const repl of urlReplacements) {
    if (!seenBlocks.has(repl.block)) {
      seenBlocks.add(repl.block);
      blocks.push(repl.block);
    }
  }

  return { text: result, blocks: blocks.reverse() };
}

/** Resolve @path references (including glob patterns). */
function resolvePaths(text: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const seen = new Set<string>();

  // Collect all path matches with their positions
  const pathMatches: { index: number; original: string; path: string }[] = [];
  const pathRegex = new RegExp(PATH_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = pathRegex.exec(text)) !== null) {
    const path = m[1];
    // Skip if it's a URL or starts with git-diff (already handled by prior resolvers)
    if (path.startsWith("http://") || path.startsWith("https://")) continue;
    if (path.startsWith("git-diff")) continue;
    pathMatches.push({ index: m.index, original: m[0], path });
  }

  if (pathMatches.length === 0) return { text, blocks };

  // Resolve each unique path to its content (or error) block
  const pathToBlock = new Map<string, string>();

  for (const pm of pathMatches) {
    const { path } = pm;
    if (pathToBlock.has(path)) continue;

    if (isGlob(path)) {
      const files = expandGlob(path);
      if (files.length === 0) {
        pathToBlock.set(path, formatError(path, "No files matched"));
      } else {
        files.sort();
        for (const file of files) {
          if (seen.has(file)) continue;
          seen.add(file);
          const { content, error } = readFileContent(file);
          pathToBlock.set(file, error ? formatError(file, error) : formatRef(file, content));
        }
      }
    } else {
      if (seen.has(path)) continue;
      seen.add(path);
      const { content, error } = readFileContent(path);
      pathToBlock.set(path, error ? formatError(path, error) : formatRef(path, content));
    }
  }

  // Replace @-refs from right to left to keep indices stable
  let result = text;
  // Sort descending by index so earlier removals don't shift later indices
  const sorted = [...pathMatches].sort((a, b) => b.index - a.index);
  // Dedup consecutive same-original-length removals at same position
  const removed = new Set<number>();
  for (const pm of sorted) {
    if (removed.has(pm.index)) continue;
    result = result.slice(0, pm.index) + result.slice(pm.index + pm.original.length);
    removed.add(pm.index);
  }

  // Collect blocks in original text order
  const blockOrder = new Map<string, number>();
  let order = 0;
  for (const pm of pathMatches) {
    if (isGlob(pm.path)) {
      const files = expandGlob(pm.path).sort();
      for (const file of files) {
        if (seen.has(file) && !blockOrder.has(file)) {
          blockOrder.set(file, order++);
        }
      }
    } else {
      if (seen.has(pm.path) && !blockOrder.has(pm.path)) {
        blockOrder.set(pm.path, order++);
      }
    }
  }

  // Build blocks in the order paths first appeared
  const sortedBlocks: { path: string; order: number }[] = [];
  for (const path of pathToBlock.keys()) {
    const o = blockOrder.get(path) ?? 999;
    sortedBlocks.push({ path, order: o });
  }
  sortedBlocks.sort((a, b) => a.order - b.order);

  for (const { path } of sortedBlocks) {
    blocks.push(pathToBlock.get(path)!);
  }

  return { text: result, blocks };
}

// ── Main API ───────────────────────────────────────────────────────────────

/**
 * Pre-process a user message to resolve @-references:
 *
 * - @path           → inline file contents (e.g. @src/index.ts)
 * - @src/** /*.ts   → glob: inline all matching files with headers
 * - @url            → fetch and inline (e.g. @https://example.com)
 * - @git-diff       → git diff output
 *
 * References are replaced with a structured format:
 *
 *   [Referenced: path/to/file]
 *   ```
 *   <content>
 *   ```
 *
 * Non-file references are removed from the text; the blocks are appended
 * at the end of the message.
 */
export async function resolveRefs(text: string): Promise<string> {
  if (!text.includes("@")) return text;

  const allBlocks: string[] = [];

  // 1. Resolve @git-diff (synchronous)
  const afterGitDiff = resolveGitDiff(text);
  allBlocks.push(...afterGitDiff.blocks);
  let currentText = afterGitDiff.text;

  // 2. Resolve @url (async — fetch)
  const afterUrls = await resolveUrls(currentText);
  allBlocks.push(...afterUrls.blocks);
  currentText = afterUrls.text;

  // 3. Resolve @path (synchronous — file reads)
  const afterPaths = resolvePaths(currentText);
  allBlocks.push(...afterPaths.blocks);
  currentText = afterPaths.text;

  // Assemble result: cleaned text + all reference blocks
  if (allBlocks.length === 0) return text;

  const cleaned = currentText.trim();
  const refsSection = allBlocks.join("\n\n");

  if (!cleaned) {
    return refsSection;
  }
  return `${cleaned}\n\n${refsSection}`;
}
