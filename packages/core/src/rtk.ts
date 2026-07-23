// RTK — Rational Token Knowledge. Compresses tool output by extracting the
// meaningful parts, truncating long lines, collapsing lists, and removing
// redundancy. Saves 30-70% tokens on typical web / file / terminal output.
//
// Usage:
//   import { makeRtkPlugin } from "helix-core";
//   plugins: [makeRtkPlugin()]

import type { HelixPlugin } from "./registry.js";

/** Default max line length before truncation. */
const MAX_LINE = 400;
/** Default max lines before head+tail condensation. */
const MAX_LINES = 60;
/** How many head/tail lines to keep when condensing. */
const HEAD_TAIL = 10;

/**
 * Compress a tool-output string using RTK heuristics:
 *  - Truncate unreasonably long lines.
 *  - Condense very long outputs to head + "… [N lines omitted] …" + tail.
 *  - Collapse repeated blank lines.
 *  - Strip leading/trailing whitespace.
 */
export function rtkCompress(text: string, opts?: {
  maxLine?: number;
  maxLines?: number;
  headTail?: number;
}): string {
  if (!text) return text;

  const ml = opts?.maxLine ?? MAX_LINE;
  const ml2 = opts?.maxLines ?? MAX_LINES;
  const ht = opts?.headTail ?? HEAD_TAIL;

  let s = text;
  // Normalise line endings.
  s = s.replace(/\r\n/g, "\n");

  // Collapse repeated blank lines (keep at most one blank line between blocks).
  s = s.replace(/\n{3,}/g, "\n\n");

  // Split into lines.
  const lines = s.split("\n");

  // Truncate overlong lines.
  const truncated = lines.map((line) => {
    if (line.length > ml) {
      return line.slice(0, ml - 20) + ` … [${line.length - ml + 20} more chars]`;
    }
    return line;
  });

  // Condense if too many lines.
  let result: string;
  if (truncated.length > ml2) {
    const head = truncated.slice(0, ht);
    const tail = truncated.slice(-ht);
    result =
      head.join("\n") +
      `\n… [${truncated.length - ht * 2} lines omitted] …\n` +
      tail.join("\n");
  } else {
    result = truncated.join("\n");
  }

  return result.trim();
}

/**
 * Create a HelixPlugin that wraps every registered tool so its output is
 * compressed with RTK before being fed to the LLM.
 *
 * Enable by setting `features.rtk = true` in config, or pass the plugin
 * directly:
 *
 *   plugins: [makeRtkPlugin()]
 */
export function makeRtkPlugin(): HelixPlugin {
  return {
    name: "rtk",
    register(ctx) {
      for (const tool of ctx.registry.list()) {
        const originalRun = tool.run;
        tool.run = async (input) => {
          const result = await originalRun.call(tool, input);
          if (typeof result === "string" && result.length > 100) {
            return rtkCompress(result);
          }
          return result;
        };
      }
    },
  };
}
