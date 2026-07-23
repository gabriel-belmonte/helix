// Caveman — ultra-compressed text mode for tool outputs.
//
// Drops articles, shortens common words, removes filler, and collapses
// whitespace. Saves 40-60% tokens on typical tool results.
//
// Usage:
//   import { makeCavemanPlugin } from "helix-core";
//   plugins: [makeCavemanPlugin()]

import type { HelixPlugin } from "./registry.js";

/** Compress a single text string into caveman-speak. */
export function cavemanCompress(text: string): string {
  if (!text) return text;

  let s = text;

  // Normalise whitespace first.
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\t/g, " ");
  s = s.replace(/ {2,}/g, " ");

  // Replace common wordy patterns with compact forms.
  // Order matters — longer matches before shorter to avoid partial hits.
  const replacements: [RegExp, string][] = [
    // Articles & determiners
    [/\bthe\b/gi, ""],
    [/\ba(n)?\b/gi, ""],

    // Common verbose → short
    [/\binformation\b/gi, "info"],
    [/\bconfiguration\b/gi, "config"],
    [/\bdocumentation\b/gi, "docs"],
    [/\bapplication\b/gi, "app"],
    [/\bimplementation\b/gi, "impl"],
    [/\bmanagement\b/gi, "mgmt"],
    [/\bdevelopment\b/gi, "dev"],
    [/\benvironment\b/gi, "env"],
    [/\bparameter\b/gi, "param"],
    [/\bfunction\b/gi, "fn"],
    [/\bmessage\b/gi, "msg"],
    [/\bnumber\b/gi, "num"],

    // Verbose phrases → compact
    [/\bdoes not\b/gi, "doesnt"],
    [/\bdo not\b/gi, "dont"],
    [/\bwill not\b/gi, "wont"],
    [/\bis not\b/gi, "isnt"],
    [/\bare not\b/gi, "arent"],
    [/\bcannot\b/gi, "cant"],
    [/\bcould not\b/gi, "couldnt"],
    [/\bshould not\b/gi, "shouldnt"],
    [/\bwould not\b/gi, "wouldnt"],
    [/\bhave not\b/gi, "havent"],
    [/\bhas not\b/gi, "hasnt"],
    [/\bhave been\b/gi, "been"],
    [/\bhas been\b/gi, "been"],
    [/\bthere is\b/gi, "there's"],
    [/\bthere are\b/gi, "there's"],
    [/\bit is\b/gi, "its"],
    [/\bthat is\b/gi, "thats"],
    [/\bthis is\b/gi, "this's"],

    // Shorten common words
    [/\bplease\b/gi, "pls"],
    [/\bbecause\b/gi, "cuz"],
    [/\babout\b/gi, "abt"],
    [/\bbetween\b/gi, "btwn"],
    [/\bwithout\b/gi, "w/o"],
    [/\bwith\b/gi, "w/"],
    [/\band\b/gi, "&"],
    [/\byou\b/gi, "u"],
    [/\byour\b/gi, "ur"],
    [/\bwe\b/gi, "we"],

    // Number homophones (word → digit)
    [/\bto\b/gi, "2"],
    [/\bfor\b/gi, "4"],
    [/\bbefore\b/gi, "b4"],

    // Filler words to drop.
    [/\bjust\b/gi, ""],
    [/\bbasically\b/gi, ""],
    [/\bactually\b/gi, ""],
    [/\bliterally\b/gi, ""],
    [/\bvery\b/gi, ""],
    [/\breally\b/gi, ""],
    [/\bquite\b/gi, ""],
  ];

  for (const [pattern, replacement] of replacements) {
    s = s.replace(pattern, replacement);
  }

  // Collapse leftover whitespace.
  s = s.replace(/ {2,}/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();

  return s;
}

/**
 * Create a HelixPlugin that wraps every registered tool so its output is
 * compressed with caveman before being fed to the LLM.
 *
 * Enable by setting `features.caveman = true` in config, or pass the plugin
 * directly:
 *
 *   plugins: [makeCavemanPlugin()]
 */
export function makeCavemanPlugin(): HelixPlugin {
  return {
    name: "caveman",
    register(ctx) {
      for (const tool of ctx.registry.list()) {
        const originalRun = tool.run;
        tool.run = async (input) => {
          const result = await originalRun.call(tool, input);
          if (typeof result === "string" && result.length > 20) {
            return cavemanCompress(result);
          }
          return result;
        };
      }
    },
  };
}
