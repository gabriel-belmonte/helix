import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export function FilesSection() {
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<{ name: string; isDir: boolean; path: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(["."]);

  async function load(p: string) {
    try {
      const d = await api(`/files?path=${encodeURIComponent(p)}`);
      setEntries(d.entries || []);
      setPath(p);
      setErr(null);
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { load("."); }, []);

  function open(p: string) {
    setHistory((h) => [...h, p]);
    load(p);
  }
  function up() {
    if (history.length <= 1) return;
    const h = [...history];
    h.pop();
    setHistory(h);
    load(h[h.length - 1]);
  }

  return (
    <section>
      <h1>Files</h1>
      <p className="muted">Browsing from the current project root.</p>

      <div className="row">
        <button className="btn ghost" onClick={up}>↑ up</button>
        <code className="path">{path}</code>
      </div>

      <table className="grid">
        <tbody>
          {entries.length === 0 && <tr><td className="muted">empty</td></tr>}
          {entries.map((e) => (
            <tr key={e.path} className={e.isDir ? "dir" : ""} onClick={() => e.isDir && open(e.path)}>
              <td>{e.isDir ? "📁" : "📄"}</td>
              <td>{e.name}</td>
              <td className="muted">{e.isDir ? "dir" : "file"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
