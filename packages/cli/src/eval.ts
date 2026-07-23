// CLI eval runner — `helix eval --suite <file> --model <slug> [--compare <slug>]`.
//
// Reuses the exact same agent pipeline as the CLI/TUI/web (buildAgent +
// loadProvider) so what you measure is what you ship. The model is forced via
// the HELIX_MODEL env var so `--model` can point A/B at different models
// without mutating ~/.helix/config.json.

import { buildAgent } from "helix-core";
import { loadProvider } from "./provider.js";
import { runEval, compareEval, type EvalCase } from "helix-agent-eval";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type EvalCliOpts = {
  suite?: string;
  model?: string;
  compare?: string;
  scripted?: boolean;
};

function loadSuite(path: string): EvalCase[] {
  if (!existsSync(path)) {
    throw new Error(`suite file not found: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const cases: EvalCase[] = Array.isArray(raw) ? raw : raw.cases;
  if (!Array.isArray(cases)) {
    throw new Error("suite must be a JSON array of cases or { cases: [...] }");
  }
  return cases;
}

/**
 * Build an agent runner bound to a specific model. We temporarily set
 * HELIX_MODEL so loadProvider picks it up; the key still resolves from
 * auth/env as usual.
 */
async function makeRunner(model?: string, scripted?: boolean) {
  const prev = process.env.HELIX_MODEL;
  if (model) process.env.HELIX_MODEL = model;
  try {
    const llm = loadProvider({ scripted: !!scripted });
    const agent = await buildAgent(llm, { config: { web: { search: false, extract: false } } });
    return async (input: string): Promise<string> => agent.run(input);
  } finally {
    if (prev === undefined) delete process.env.HELIX_MODEL;
    else process.env.HELIX_MODEL = prev;
  }
}

export async function handleEval(opts: EvalCliOpts) {
  if (!opts.suite) {
    throw new Error("usage: helix eval --suite <file.json> [--model <slug>] [--compare <slug>]");
  }
  const cases = loadSuite(opts.suite);

  // Single-model run.
  if (!opts.compare) {
    const run = await makeRunner(opts.model, opts.scripted);
    const report = await runEval(cases, run);
    printReport(report, opts.model ?? process.env.HELIX_MODEL ?? "(default)");
    if (report.passed !== report.totalCases) process.exitCode = 1;
    return;
  }

  // A/B run.
  const runA = await makeRunner(opts.model, opts.scripted);
  const runB = await makeRunner(opts.compare, opts.scripted);
  const cmp = await compareEval(cases, runA, runB);
  printCompare(cmp, opts.model ?? "(default)", opts.compare);
}

function printReport(report: any, model: string) {
  console.log(`\n=== Eval report — model: ${model} ===`);
  console.log(`  cases:    ${report.totalCases}`);
  console.log(`  passed:   ${report.passed}/${report.totalCases}`);
  console.log(`  avgScore: ${report.avgScore.toFixed(3)}`);
  console.log(`  avgLatency: ${report.avgLatencyMs.toFixed(0)}ms`);
  console.log(`  totalCost: $${report.totalCostUsd.toFixed(4)}`);
}

function printCompare(cmp: any, modelA: string, modelB: string) {
  const d = cmp.delta;
  const fmt = (n: number, digits = 3) => (n >= 0 ? `+${n.toFixed(digits)}` : n.toFixed(digits));
  console.log(`\n=== Eval A/B — ${modelA} (A) vs ${modelB} (B) ===`);
  console.log(`  avgScore:   ${d.scoreA.toFixed(3)}  vs  ${d.scoreB.toFixed(3)}  (Δ ${fmt(d.deltaScore)})`);
  console.log(`  passed:     ${d.passedA}/${cmp.reportA.totalCases}  vs  ${d.passedB}/${cmp.reportB.totalCases}  (Δ ${fmt(d.deltaPassed, 0)})`);
  console.log(`  avgLatency: ${d.latencyA.toFixed(0)}ms  vs  ${d.latencyB.toFixed(0)}ms  (Δ ${fmt(d.deltaLatency, 0)}ms)`);
  console.log(`  totalCost:  $${d.costA.toFixed(4)}  vs  $${d.costB.toFixed(4)}  (Δ ${fmt(d.deltaCost, 4)}$)`);
  console.log(`  winner:     ${cmp.winner === "tie" ? "tie" : cmp.winner === "A" ? modelA : modelB}`);
}
