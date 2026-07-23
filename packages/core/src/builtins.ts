// Built-in tools: file-system + shell. Always available (no feature flag).

import { defineTool } from "helix-agent";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { execSync } from "node:child_process";

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
  "Write text to a file (overwrites). Input: { path: string, content: string }",
  async (input: { path: string; content: string }) => {
    writeFileSync(safePath(input.path), input.content, "utf8");
    return { path: input.path, written: input.content.length };
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
      try {
        const cmd = `find ${JSON.stringify(dir)} -name ${JSON.stringify(input.pattern)} -type f 2>/dev/null | head -50`;
        const out = execSync(cmd, { encoding: "utf8", timeout: 10_000 });
        const files = out.trim().split("\n").filter(Boolean).map((f) => relative(dir, f));
        return { pattern: input.pattern, matches: files, count: files.length };
      } catch {
        return { pattern: input.pattern, matches: [], count: 0 };
      }
    }

    try {
      const globArg = input.file_glob ? `--include=${JSON.stringify(input.file_glob)}` : "";
      const cmd = `grep -rn ${globArg} ${JSON.stringify(input.pattern)} ${JSON.stringify(dir)} 2>/dev/null | head -50`;
      const out = execSync(cmd, { encoding: "utf8", timeout: 10_000 });
      const lines = out.trim().split("\n").filter(Boolean).map((l) => {
        const rel = l.startsWith(dir) ? l.slice(dir.length + 1) : l;
        return rel;
      });
      return { pattern: input.pattern, matches: lines, count: lines.length };
    } catch {
      return { pattern: input.pattern, matches: [], count: 0 };
    }
  }
);

export const builtinTools = [readFile, writeFile, listDir, runBash, searchFiles];
