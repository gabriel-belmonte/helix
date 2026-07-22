// File-system + shell tools for the Helix coding agent.
// Each is a helix-agent Tool: { name, description, run }.

import { defineTool } from "helix-agent";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

function safePath(p: string): string {
  // Resolve relative to cwd and keep it absolute-ish for clarity.
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

export const tools = [readFile, writeFile, listDir, runBash];
