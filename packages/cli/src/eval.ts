// CLI eval runner — `helix eval --suite <file> --model <slug> [--compare <slug>] [--judge <slug>]`.
//
// Reuses the exact same provider pipeline as the CLI/TUI/web (loadProvider)
// so model resolution (env > auth.json) is identical to what ships. The model
// is forced via the HELIX_MODEL env var so `--model` can point A/B at different
// models without mutating ~/.helix/config.json.

import { loadProvider } from "./provider.js";
import { runEval, compareEval, makeLlmJudge, type EvalCase, type Scorer } from "helix-agent-eval";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type EvalCliOpts = {
  suite?: string;
  model?: string;
  compare?: string;
  judge?: string;
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
 * Build a raw-model runner bound to a specific model. We temporarily set
 * HELIX_MODEL so loadProvider picks it up; the key still resolves from
 * auth/env as usual.
 *
 * In eval we want the RAW model output (no tool-calling loop), so we use the
 * LLM provider directly via `complete()` rather than the full agent. That keeps
 * the measurement about model quality, not tool plumbing.
 */
async function makeRunner(model?: string, scripted?: boolean) {
  const prev = process.env.HELIX_MODEL;
  if (model) process.env.HELIX_MODEL = model;
  try {
    const llm = loadProvider({ scripted: !!scripted });
    return async (input: string): Promise<string> =>
      llm.complete([{ role: "user", content: input }]);
  } finally {
    if (prev === undefined) delete process.env.HELIX_MODEL;
    else process.env.HELIX_MODEL = prev;
  }
}

/**
 * Optionally wrap every case's `expected` into an LLM-as-judge scorer.
 * When --judge is set, the judge model grades each output (0..1) against the
 * `expected` reference text, replacing the naive substring check.
 */
function withJudge(cases: EvalCase[], judgeRunner?: (prompt: string) => Promise<string>): EvalCase[] {
  if (!judgeRunner) return cases;
  const judgeScorer: Scorer = makeLlmJudge(judgeRunner);
  return cases.map((c) => ({
    ...c,
    // Keep `expected` (used as the reference answer by the judge).
    score: async (ctx) => judgeScorer(ctx),
  }));
}

export async function handleEval(opts: EvalCliOpts) {
  if (!opts.suite) {
    throw new Error(
      "usage: helix eval --suite <file.json> [--model <slug>] [--compare <slug>] [--judge <slug>]"
    );
  }
  let cases = loadSuite(opts.suite);

  // Build a judge runner if requested.
  let judgeRunner: ((prompt: string) => Promise<string>) | undefined;
  if (opts.judge) {
    const j = await makeRunner(opts.judge, opts.scripted);
    judgeRunner = j;
    cases = withJudge(cases, judgeRunner);
  }

  // Single-model run.
  if (!opts.compare) {
    const run = await makeRunner(opts.model, opts.scripted);
    const report = await runEval(cases, run);
    printReport(report, opts.model ?? process.env.HELIX_MODEL ?? "(default)", !!judgeRunner);
    if (report.passed !== report.totalCases) process.exitCode = 1;
    return;
  }

  // A/B run.
  const runA = await makeRunner(opts.model, opts.scripted);
  const runB = await makeRunner(opts.compare, opts.scripted);
  const cmp = await compareEval(cases, runA, runB);
  printCompare(cmp, opts.model ?? "(default)", opts.compare, !!judgeRunner);
}

function printReport(report: any, model: string, judged: boolean) {
  console.log(`\n=== Eval report — model: ${model}${judged ? " (LLM-judged)" : ""} ===`);
  console.log(`  cases:    ${report.totalCases}`);
  console.log(`  passed:   ${report.passed}/${report.totalCases}`);
  console.log(`  avgScore: ${report.avgScore.toFixed(3)}`);
  console.log(`  avgLatency: ${report.avgLatencyMs.toFixed(0)}ms`);
  console.log(`  totalCost: $${report.totalCostUsd.toFixed(4)}`);
}

function printCompare(cmp: any, modelA: string, modelB: string, judged: boolean) {
  const d = cmp.delta;
  const fmt = (n: number, digits = 3) => (n >= 0 ? `+${n.toFixed(digits)}` : n.toFixed(digits));
  console.log(`\n=== Eval A/B — ${modelA} (A) vs ${modelB} (B)${judged ? " (LLM-judged)" : ""} ===`);
  console.log(`  avgScore:   ${d.scoreA.toFixed(3)}  vs  ${d.scoreB.toFixed(3)}  (Δ ${fmt(d.deltaScore)})`);
  console.log(`  passed:     ${d.passedA}/${cmp.reportA.totalCases}  vs  ${d.passedB}/${cmp.reportB.totalCases}  (Δ ${fmt(d.deltaPassed, 0)})`);
  console.log(`  avgLatency: ${d.latencyA.toFixed(0)}ms  vs  ${d.latencyB.toFixed(0)}ms  (Δ ${fmt(d.deltaLatency, 0)}ms)`);
  console.log(`  totalCost:  $${d.costA.toFixed(4)}  vs  $${d.costB.toFixed(4)}  (Δ ${fmt(d.deltaCost, 4)}$)`);
  console.log(`  winner:     ${cmp.winner === "tie" ? "tie" : cmp.winner === "A" ? modelA : modelB}`);
}
