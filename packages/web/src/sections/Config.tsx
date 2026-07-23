import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const PROVIDERS = ["zen", "hf", "openrouter", "openai"];

export function ConfigSection() {
  const [cfg, setCfg] = useState<any>({});
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/config").then(setCfg).catch((e) => setErr(String(e)));
  }, []);

  async function save() {
    try {
      const next = await api("/config", { method: "POST", body: JSON.stringify(cfg) });
      setCfg(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <section>
      <h1>Configuration</h1>
      <p className="muted">Provider, model and base URLs. Saved to ~/.helix/config.json.</p>

      <div className="field">
        <label>Provider</label>
        <select value={cfg.provider || ""} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}>
          <option value="">— none —</option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Model</label>
        <input
          value={cfg.model || ""}
          placeholder="e.g. big-pickle / gpt-4o"
          onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Zen base URL</label>
        <input
          value={cfg.zenBaseUrl || ""}
          placeholder="https://opencode.ai/zen/v1"
          onChange={(e) => setCfg({ ...cfg, zenBaseUrl: e.target.value })}
        />
      </div>

      <div className="field">
        <label>HF base URL</label>
        <input
          value={cfg.hfBaseUrl || ""}
          placeholder="https://router.huggingface.co/v1"
          onChange={(e) => setCfg({ ...cfg, hfBaseUrl: e.target.value })}
        />
      </div>

      <div className="actions">
        <button className="btn primary" onClick={save}>Save</button>
        {saved && <span className="ok">✓ saved</span>}
        {err && <span className="err">{err}</span>}
      </div>
    </section>
  );
}
