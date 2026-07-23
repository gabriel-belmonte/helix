import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const PROVIDERS = ["zen", "hf", "openrouter", "openai"];

type ZenModel = { id: string; free: boolean; label: string; current: boolean };

export function ConfigSection() {
  const [cfg, setCfg] = useState<any>({});
  const [models, setModels] = useState<ZenModel[]>([]);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/config").then(setCfg).catch((e) => setErr(String(e)));
    api("/zen-models")
      .then((d) => setModels(d.models ?? []))
      .catch(() => {});
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
        {models.length ? (
          <select value={cfg.model || ""} onChange={(e) => setCfg({ ...cfg, model: e.target.value })}>
            <option value="">— select —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}{m.free ? " · FREE" : ""}{m.current ? " (current)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={cfg.model || ""}
            placeholder="e.g. big-pickle / gpt-4o"
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
          />
        )}
        {models.filter((m) => m.free).length > 0 && (
          <span className="hint">
            <span className="free-tag">FREE</span> {models.filter((m) => m.free).length} free models available
          </span>
        )}
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
