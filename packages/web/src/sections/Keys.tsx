import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export function KeysSection() {
  const [keys, setKeys] = useState<{ provider: string; masked: string }[]>([]);
  const [provider, setProvider] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setKeys(await api("/auth")); } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    try {
      await api("/auth", { method: "POST", body: JSON.stringify({ provider, key }) });
      setProvider(""); setKey(""); setErr(null); load();
    } catch (e) { setErr(String(e)); }
  }
  async function remove(p: string) {
    await api(`/auth/${p}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <h1>API Keys</h1>
      <p className="muted">Stored in ~/.helix/auth.json (chmod 600). Env vars always win.</p>

      <table className="grid">
        <thead><tr><th>Provider</th><th>Key (masked)</th><th></th></tr></thead>
        <tbody>
          {keys.length === 0 && (
            <tr><td colSpan={3} className="muted">No keys configured.</td></tr>
          )}
          {keys.map((k) => (
            <tr key={k.provider}>
              <td><code>{k.provider}</code></td>
              <td><code>{k.masked}</code></td>
              <td><button className="btn ghost" onClick={() => remove(k.provider)}>remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        <input placeholder="provider (e.g. zen)" value={provider} onChange={(e) => setProvider(e.target.value)} />
        <input placeholder="api key" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn primary" onClick={add}>Add key</button>
      </div>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
