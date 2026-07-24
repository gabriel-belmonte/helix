// Built-in tools: file-system + shell. Always available (no feature flag).

import { defineTool } from "helix-agent";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { execSync } from "node:child_process";
import { checkpointBeforeWrite, rollbackTool } from "./checkpoint.js";

function safePath(p: string): string {
  return resolve(process.cwd(), p);
}

export const readFile = defineTool(
  "read_file",
  "Read a file's contents. Input: { path: string }",
  async (input: { path: string }) => {
    const content = readFileSync(safePath(input.path), "utf8");
    return { path: input.path, content };
  }
);

export const writeFile = defineTool(
  "write_file",
  "Write text to a file (overwrites). Snapshot is auto-created before overwriting so you can rollback later. Input: { path: string, content: string }",
  async (input: { path: string; content: string }) => {
    const abs = safePath(input.path);
    const ckpt = checkpointBeforeWrite(abs);
    writeFileSync(abs, input.content, "utf8");
    const extra = ckpt ? ` (checkpoint: ${ckpt})` : "";
    return { path: input.path, written: input.content.length, checkpoint: ckpt ?? undefined };
  }
);

export const listDir = defineTool(
  "list_dir",
  "List files in a directory. Input: { path?: string } (defaults to cwd)",
  async (input: { path?: string }) => {
    const dir = safePath(input.path ?? ".");
    const entries = readdirSync(dir).map((name) => {
      const full = join(dir, name);
      let kind = "file";
      try {
        kind = statSync(full).isDirectory() ? "dir" : "file";
      } catch {
        /* ignore */
      }
      return { name, kind };
    });
    return { path: input.path ?? ".", entries };
  }
);

export const runBash = defineTool(
  "run_bash",
  "Run a shell command and return its stdout/stderr. Input: { command: string }",
  async (input: { command: string }) => {
    try {
      const out = execSync(input.command, {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 8,
        timeout: 30_000,
      });
      return { command: input.command, stdout: out };
    } catch (e: any) {
      return {
        command: input.command,
        stdout: e.stdout?.toString() ?? "",
        stderr: e.stderr?.toString() ?? String(e.message),
        exitCode: e.status ?? 1,
      };
    }
  }
);

// Convert a simple glob to a regex (e.g. "*.ts" -> /\.ts$/, "src/**" -> /src\/.*/).
function globToRegex(glob: string): RegExp {
  let re = "";
  for (const ch of glob) {
    if (ch === "*") re += ".*";
    else if (ch === "?" || ch === "." || ch === "+" || ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "^" || ch === "$") re += "\\" + ch;
    else re += ch;
  }
  return new RegExp("^" + re + "$", "i");
}

// BFS directory walk limited to maxResults files.
function walkDir(root: string, maxResults = 50): string[] {
  const results: string[] = [];
  const queue = [root];
  while (queue.length > 0 && results.length < maxResults) {
    const current = queue.pop()!;
    let entries: string[];
    try { entries = readdirSync(current); } catch { continue; }
    for (const name of entries) {
      if (results.length >= maxResults) break;
      const full = join(current, name);
      let st: ReturnType<typeof statSync> | undefined;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (name.startsWith(".") || name === "node_modules") continue;
        queue.push(full);
      } else if (st.isFile()) {
        results.push(full);
      }
    }
  }
  return results;
}

export const searchFiles = defineTool(
  "search_files",
  `Search for files by name pattern or grep content.
Input: { pattern: string, mode?: "files" | "content", path?: string, file_glob?: string }
- mode="files" (default): find files matching a glob pattern (e.g. "*.ts", "src/**")
- mode="content": grep for regex pattern inside files
- file_glob: filter to specific file types (e.g. "*.ts") in content mode
Returns matching file paths and/or content lines.`,
  async (input: {
    pattern: string;
    mode?: "files" | "content";
    path?: string;
    file_glob?: string;
  }) => {
    const dir = safePath(input.path ?? ".");
    const mode = input.mode ?? "files";

    if (mode === "files") {
      const nameRx = globToRegex(input.pattern);
      const all = walkDir(dir, 50);
      const matched = all.filter((f) => nameRx.test(basename(f))).map((f) => relative(dir, f));
      return { pattern: input.pattern, matches: matched, count: matched.length };
    }

    // Content mode: walk dir, filter by file_glob, grep each file.
    const fileRx = input.file_glob ? globToRegex(input.file_glob) : null;
    const all = walkDir(dir, 200);
    const matches: string[] = [];
    let contentRx: RegExp;
    try { contentRx = new RegExp(input.pattern, "gi"); } catch { return { pattern: input.pattern, matches: [], count: 0 }; }

    for (const filePath of all) {
      if (matches.length >= 50) break;
      if (fileRx && !fileRx.test(basename(filePath))) continue;
      let content: string;
      try { content = readFileSync(filePath, "utf8"); } catch { continue; }
      const relPath = relative(dir, filePath);
      contentRx.lastIndex = 0;
      const found = content.match(contentRx);
      if (found) {
        matches.push(`${relPath}:${found.length} match(es)`);
      }
    }

    return { pattern: input.pattern, matches: matches.length <= 50 ? matches : matches.slice(0, 50), count: Math.min(matches.length, 50) };
  }
);

export const builtinTools = [readFile, writeFile, listDir, runBash, searchFiles, {
  name: "rollback",
  description: "Restore a file from a checkpoint (snapshot created before last write_file). Use rollback({ path: '<file>' }), rollback({ target: 'last' }), or rollback({ target: 'list' }).",
  run: rollbackTool,
}];
