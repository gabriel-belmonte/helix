// helix-agent-eval — measure agent output quality, cost and latency.
//
// Three building blocks:
//   1. runEval(cases, runAgent)        — score one agent across a suite.
//   2. compareEval(cases, agentA, B)   — A/B two agents, get deltas + winner.
//   3. makeLlmJudge(judge, rubric)     — LLM-as-judge scorer (0..1).

/** Context handed to a scorer for a single case. */
export type ScoreContext = {
  input: string;
  output: string;
  expected?: string;
};

/** A quality scorer. May be sync or async (e.g. an LLM judge). */
export type Scorer = (ctx: ScoreContext) => number | Promise<number>;

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
  // Score function: compare output vs expected/context. Bring your own metric.
  score?: Scorer;
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

/** Default scorer: 1 if the expected substring is present, else 0. */
function defaultScore(ctx: ScoreContext): number {
  return ctx.expected ? (ctx.output.includes(ctx.expected) ? 1 : 0) : 1;
}

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

    const score = c.score
      ? await c.score({ input: c.input, output, expected: c.expected })
      : defaultScore({ input: c.input, output, expected: c.expected });
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

// ─────────────────────────────────────────────────────────────────────────
// 2. A/B comparison
// ─────────────────────────────────────────────────────────────────────────

export type CompareReport = {
  reportA: EvalReport;
  reportB: EvalReport;
  delta: {
    scoreA: number;
    scoreB: number;
    deltaScore: number;
    costA: number;
    costB: number;
    deltaCost: number;
    latencyA: number;
    latencyB: number;
    deltaLatency: number;
    passedA: number;
    passedB: number;
    deltaPassed: number;
  };
  // Per-case score side-by-side (aligned by caseId).
  perCase: { caseId: string; scoreA: number; scoreB: number; delta: number }[];
  winner: "A" | "B" | "tie";
};

/**
 * Run the SAME suite through two agents and report the deltas.
 * Use this to answer "which model is better?": lower cost, higher score,
 * lower latency all surface in one table.
 */
export async function compareEval(
  cases: EvalCase[],
  runAgentA: (input: string) => Promise<string>,
  runAgentB: (input: string) => Promise<string>
): Promise<CompareReport> {
  const [reportA, reportB] = await Promise.all([
    runEval(cases, runAgentA),
    runEval(cases, runAgentB),
  ]);

  const scoreA = reportA.avgScore;
  const scoreB = reportB.avgScore;
  const costA = reportA.totalCostUsd;
  const costB = reportB.totalCostUsd;
  const latencyA = reportA.avgLatencyMs;
  const latencyB = reportB.avgLatencyMs;

  // Winner = higher avg score; tie-break on cost (cheaper wins), then latency.
  let winner: "A" | "B" | "tie" = "tie";
  if (Math.abs(scoreA - scoreB) > 0.001) {
    winner = scoreA > scoreB ? "A" : "B";
  } else if (costA !== costB) {
    winner = costA < costB ? "A" : "B";
  } else if (latencyA !== latencyB) {
    winner = latencyA < latencyB ? "A" : "B";
  }

  const byIdB = new Map(reportB.results.map((r) => [r.caseId, r]));
  const perCase = reportA.results.map((rA) => {
    const rB = byIdB.get(rA.caseId);
    const scoreB = rB ? rB.score : 0;
    return { caseId: rA.caseId, scoreA: rA.score, scoreB, delta: scoreB - rA.score };
  });

  return {
    reportA,
    reportB,
    delta: {
      scoreA,
      scoreB,
      deltaScore: scoreB - scoreA,
      costA,
      costB,
      deltaCost: costB - costA,
      latencyA,
      latencyB,
      deltaLatency: latencyB - latencyA,
      passedA: reportA.passed,
      passedB: reportB.passed,
      deltaPassed: reportB.passed - reportA.passed,
    },
    perCase,
    winner,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 3. LLM-as-judge
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a quality scorer backed by an LLM. `judge` is any function that
 * sends a prompt and returns the model's text — keep eval decoupled from any
 * specific runtime (pass `agent.run` from helix-agent, or a raw fetch).
 *
 * The returned scorer yields a number 0..1 parsed from the judge's reply.
 */
export function makeLlmJudge(
  judge: (prompt: string) => Promise<string>,
  opts?: { rubric?: string }
): Scorer {
  const rubric =
    opts?.rubric ??
    "Rate the quality, correctness and usefulness of the agent output for the given task.";
  return async (ctx: ScoreContext): Promise<number> => {
    const prompt =
      `You are a strict evaluator.\n${rubric}\n\n` +
      `Task input:\n${ctx.input}\n` +
      (ctx.expected ? `Reference answer:\n${ctx.expected}\n` : "") +
      `Agent output:\n${ctx.output}\n\n` +
      `Return ONLY a number from 0.0 to 1.0 (e.g. 0.8) with no extra text.`;
    const resp = await judge(prompt);
    // Accept forms like "0.8", "0.8/1", "Score: 0.8", "8/10" -> normalized.
    const m = resp.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/); // "8/10"
    if (m) {
      const v = parseFloat(m[1]) / parseFloat(m[2]);
      return Math.max(0, Math.min(1, v));
    }
    const n = resp.match(/\b(0(?:\.\d+)?|1(?:\.0+)?)\b/);
    if (n) {
      const v = parseFloat(n[0]);
      return Math.max(0, Math.min(1, v));
    }
    return 0;
  };
}
