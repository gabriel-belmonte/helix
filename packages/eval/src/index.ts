// helix-agent-eval — measure agent output quality, cost and latency.

export type CaseResult = {
  caseId: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  passed: boolean;
  score: number; // 0..1 quality score
};

export type EvalCase = {
  id: string;
  input: string;
  expected?: string;
  // Score function: compare output vs expected. Bring your own metric.
  score?: (output: string) => number;
  // Cost accounting — plug your model's $/1k token rates.
  costPer1kPrompt?: number;
  costPer1kCompletion?: number;
};

export type EvalReport = {
  totalCases: number;
  passed: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  avgScore: number;
  results: CaseResult[];
};

function estimateTokens(s: string): number {
  // Rough heuristic: ~4 chars per token. Swap for a real tokenizer later.
  return Math.ceil(s.length / 4);
}

export async function runEval(
  cases: EvalCase[],
  runAgent: (input: string) => Promise<string>
): Promise<EvalReport> {
  const results: CaseResult[] = [];

  for (const c of cases) {
    const start = Date.now();
    const output = await runAgent(c.input);
    const latencyMs = Date.now() - start;

    const promptTokens = estimateTokens(c.input);
    const completionTokens = estimateTokens(output);
    const costUsd =
      ((promptTokens / 1000) * (c.costPer1kPrompt ?? 0)) +
      ((completionTokens / 1000) * (c.costPer1kCompletion ?? 0));

    const score = c.score ? c.score(output) : c.expected ? (output.includes(c.expected) ? 1 : 0) : 1;
    const passed = score >= 0.5;

    results.push({
      caseId: c.id,
      latencyMs,
      promptTokens,
      completionTokens,
      costUsd,
      passed,
      score,
    });
  }

  const totalCases = results.length;
  const passed = results.filter((r) => r.passed).length;
  const avgLatencyMs = results.reduce((a, r) => a + r.latencyMs, 0) / (totalCases || 1);
  const totalCostUsd = results.reduce((a, r) => a + r.costUsd, 0);
  const avgScore = results.reduce((a, r) => a + r.score, 0) / (totalCases || 1);

  return { totalCases, passed, avgLatencyMs, totalCostUsd, avgScore, results };
}
