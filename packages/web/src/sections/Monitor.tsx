import React, { useEffect, useState } from "react";
import { api } from "../api.js";

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

interface Alert {
  severity: "critical" | "warning" | "info";
  message: string;
  time: string;
}

interface EvalRun {
  suite: string;
  score: number;
  delta: number;
}

interface MonitorData {
  metrics: MetricCard[];
  alerts: Alert[];
  evals: EvalRun[];
  lastUpdated: string;
}

export function MonitorSection() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MonitorData>("/monitor")
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <h1>Monitor</h1>
        <p className="muted">Loading metrics…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Monitor</h1>
        <p className="err">Failed to load monitoring data: {error}</p>
        <p className="muted">
          The monitor API requires the metrics collector to have run first.
          Start it with: <code className="code">bash scripts/monitor-metrics.sh</code>
        </p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section>
      <h1>Monitor</h1>
      <p className="muted">
        Key performance indicators · Last updated: {data.lastUpdated}
        <button
          className="btn ghost"
          style={{ marginLeft: 12, fontSize: 12 }}
          onClick={() => api<MonitorData>("/monitor").then(setData).catch(setError)}
        >
          ↻ refresh
        </button>
      </p>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {data.metrics.map((m, i) => (
          <div key={i} className="kpi-card" style={{ borderLeftColor: m.color }}>
            <span className="kpi-icon">{m.icon}</span>
            <div className="kpi-body">
              <span className="kpi-value">{m.value}</span>
              <span className="kpi-label">{m.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <h2 style={{ marginTop: 32 }}>Recent Alerts</h2>
      {data.alerts.length === 0 ? (
        <p className="muted">No recent alerts. All systems nominal. ✓</p>
      ) : (
        <div className="alert-list">
          {data.alerts.map((a, i) => (
            <div key={i} className={`alert-item alert-${a.severity}`}>
              <span className="alert-badge">
                {a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🟢"}
              </span>
              <span className="alert-msg">{a.message}</span>
              <span className="alert-time">{a.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Eval Runs */}
      <h2 style={{ marginTop: 32 }}>Eval Runs</h2>
      {data.evals.length === 0 ? (
        <p className="muted">
          No eval data yet. Run <code className="code">helix eval --suite &lt;file&gt;</code> to generate baseline results.
        </p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Suite</th>
              <th>Score</th>
              <th>Δ from baseline</th>
            </tr>
          </thead>
          <tbody>
            {data.evals.map((e, i) => (
              <tr key={i}>
                <td><code className="code">{e.suite}</code></td>
                <td>{e.score}%</td>
                <td style={{ color: e.delta >= 0 ? "var(--accent-2)" : "var(--danger)" }}>
                  {e.delta >= 0 ? "▲" : "▼"} {Math.abs(e.delta)}%
                  {e.delta < -3 ? " (triage filed)" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Info footer */}
      <details style={{ marginTop: 32, maxWidth: 640 }}>
        <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
          About this dashboard
        </summary>
        <div className="card" style={{ marginTop: 8 }}>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            Metrics are collected daily by the <code className="code">monitor-metrics.sh</code> script
            and stored in <code className="code">~/.helix/monitor/metrics.jsonl</code>.
            The triage process is documented in{" "}
            <code className="code">docs/continuous-improvement.md</code>.
          </p>
        </div>
      </details>
    </section>
  );
}
