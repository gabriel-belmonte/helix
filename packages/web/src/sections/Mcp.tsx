import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export function McpSection() {
  const [servers, setServers] = useState<Record<string, any>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/mcp").then((d) => setServers(d.servers || {})).catch((e) => setErr(String(e)));
  }, []);

  return (
    <section>
      <h1>MCP Servers</h1>
      <p className="muted">From ~/.helix/helix.mcp.json. Each server's tools become local Helix tools.</p>

      <div className="cards">
        {Object.keys(servers).length === 0 && <p className="muted">No MCP servers configured.</p>}
        {Object.entries(servers).map(([name, s]: any) => (
          <div className="card" key={name}>
            <h3>{name}</h3>
            <p className="muted">type: {s.type || "stdio"}</p>
            <code className="path">{s.command || ""} {(s.args || []).join(" ")}</code>
          </div>
        ))}
      </div>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
