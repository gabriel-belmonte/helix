# helix-agent-eval

Evaluate AI agent outputs for quality, cost, and latency — catch regressions before they hit production.

## Overview

`helix-agent-eval` provides three building blocks for evaluating agent performance:

1. **`runEval`** — Score one agent across a test suite
2. **`compareEval`** — A/B two agents with deltas and a winner
3. **`makeLlmJudge`** — LLM-as-judge scorer (0..1 quality score)

## Installation

This package is internal to the Helix monorepo. Use via the CLI:

```bash
helix eval --suite test.json
helix eval --suite test.json --compare mimo-v2.5-free
helix eval --suite test.json --judge deepseek-v4-flash-free
```

Or as a workspace dependency:

```bash
bun add helix-agent-eval
```

## Quick Start

```ts
import { runEval, type EvalCase } from "helix-agent-eval";

const cases: EvalCase[] = [
  {
    id: "math-1",
    input: "What is 2 + 2?",
    expected: "4",
    costPer1kPrompt: 0.002,
    costPer1kCompletion: 0.004,
  },
  {
    id: "math-2",
    input: "What is 10 * 5?",
    expected: "50",
  },
];

const report = await runEval(cases, async (input) => {
  // Call your agent here
  return await agent.run(input);
});

console.log(`Passed: ${report.passed}/${report.totalCases}`);
console.log(`Avg score: ${report.avgScore}`);
console.log(`Total cost: $${report.totalCostUsd.toFixed(4)}`);
console.log(`Avg latency: ${report.avgLatencyMs.toFixed(0)}ms`);
```

## A/B Comparison

```ts
import { compareEval } from "helix-agent-eval";

const cmp = await compareEval(cases, runAgentA, runAgentB);

console.log(`Winner: ${cmp.winner}`);
console.log(`Score delta: ${cmp.delta.deltaScore}`);
console.log(`Cost delta: $${cmp.delta.deltaCost.toFixed(4)}`);
console.log(`Latency delta: ${cmp.delta.deltaLatency.toFixed(0)}ms`);
```

Per-case breakdown:

```ts
for (const c of cmp.perCase) {
  console.log(`${c.caseId}: A=${c.scoreA} B=${c.scoreB} (Δ ${c.delta})`);
}
```

## LLM-as-Judge

Use an LLM to grade agent outputs on a 0-1 scale:

```ts
import { makeLlmJudge, runEval } from "helix-agent-eval";

const judge = makeLlmJudge(
  async (prompt) => await judgeAgent.run(prompt),
  { rubric: "Rate correctness and completeness of the answer." }
);

const report = await runEval(cases, async (input) => {
  return await myAgent.run(input);
}, /* pass judge as scorer */);
```

## API Reference

### `runEval(cases, runAgent)`

Runs each case through `runAgent` and produces an `EvalReport`.

**Returns:** `EvalReport` with `totalCases`, `passed`, `avgLatencyMs`, `totalCostUsd`, `avgScore`, and per-case `results`.

### `compareEval(cases, runAgentA, runAgentB)`

Runs both agents on the same suite in parallel and produces a `CompareReport` with deltas and a `winner` field (`"A"` | `"B"` | `"tie"`).

### `makeLlmJudge(judge, opts?)`

Creates a `Scorer` function backed by an LLM. The `judge` parameter is any async function that sends a prompt and returns text. The optional `rubric` customizes the grading criteria.

### Types

| Type | Description |
|------|-------------|
| `EvalCase` | Test case with `id`, `input`, optional `expected`, `score` function, and cost rates |
| `EvalReport` | Aggregate results: pass rate, avg score, cost, latency |
| `CompareReport` | Side-by-side comparison with deltas and winner |
| `Scorer` | `(ctx: ScoreContext) => number \| Promise<number>` |
| `ScoreContext` | `{ input, output, expected? }` passed to scorers |

## License

MIT
