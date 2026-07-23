import React, { useEffect, useState } from "react";
import { api } from "../api.js";

type Entry = {
  ts: number;
  type: string;
  text: string;
  bank: string;
  importance: number;
};

export function MemorySection() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState("fact");
  const [bank, setBank] = useState("global");
  const [err, setErr] = useState<string | null>(null);
  const [soul, setSoul] = useState("");

  async function load() {
    try {
      const { entries } = await api("/memory");
      setEntries(entries);
      const s = await api("/soul");
      setSoul(s.soul || "");
    } catch (e) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!text.trim()) return;
    setErr(null);
    try {
      await api("/memory", {
        method: "POST",
        body: JSON.stringify({ text, type, bank, importance: 0.6 }),
      });
      setText("");
      load();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function clear() {
    if (!confirm("Clear all memories in bank '" + bank + "'?")) return;
    await api(`/memory?bank=${encodeURIComponent(bank)}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <h1>Memory</h1>
      <p className="muted">
        Modular memory (helix-memory). Stored in <code>~/.helix/memory.jsonl</code>.
        The agent uses <code>remember</code> / <code>recall</code> / <code>reflect</code> tools.
        Swap the backend (SQLite, vector store) without touching the agent.
      </p>

      <div className="memory-add">
        <input
          value={text}
          placeholder="Remember something durable…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="fact">fact</option>
          <option value="preference">preference</option>
          <option value="project">project</option>
          <option value="episodic">episodic</option>
        </select>
        <input
          className="bank"
          value={bank}
          placeholder="bank"
          onChange={(e) => setBank(e.target.value)}
        />
        <button className="btn primary" onClick={add}>Remember</button>
      </div>

      <div className="memory-meta">
        <span>bank: <code>{bank}</code></span>
        <button className="btn ghost" onClick={clear}>Clear bank</button>
      </div>

      {soul && (
        <details className="soul">
          <summary>soul.md (persona)</summary>
          <pre>{soul}</pre>
        </details>
      )}

      <div className="cards">
        {entries.length === 0 && <p className="muted">No memories yet.</p>}
        {entries.map((e, i) => (
          <div className="card" key={i}>
            <div className="row">
              <span className="tag">{e.type}</span>
              <span className="tag bank">{e.bank}</span>
              <span className="muted small">
                {new Date(e.ts).toLocaleString()} · imp {e.importance}
              </span>
            </div>
            <div className="txt">{e.text}</div>
          </div>
        ))}
      </div>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
