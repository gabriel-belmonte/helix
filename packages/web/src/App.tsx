import React, { useState } from "react";
import { api } from "./api.js";
import { ChatSection } from "./sections/Chat.js";
import { ConfigSection } from "./sections/Config.js";
import { KeysSection } from "./sections/Keys.js";
import { SkillsSection } from "./sections/Skills.js";
import { McpSection } from "./sections/Mcp.js";
import { FilesSection } from "./sections/Files.js";
import { MemorySection } from "./sections/Memory.js";
import { MonitorSection } from "./sections/Monitor.js";

type SectionId = "chat" | "config" | "keys" | "skills" | "mcp" | "memory" | "files" | "monitor";

const NAV: { id: SectionId; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "config", label: "Config", icon: "⚙" },
  { id: "keys", label: "API Keys", icon: "🔑" },
  { id: "skills", label: "Skills", icon: "✦" },
  { id: "mcp", label: "MCP", icon: "🔌" },
  { id: "memory", label: "Memory", icon: "🧠" },
  { id: "files", label: "Files", icon: "📁" },
  { id: "monitor", label: "Monitor", icon: "📊" },
];

export function App() {
  const [active, setActive] = useState<SectionId>("config");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot" /> helix<span className="brand-sub">dashboard</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={active === n.id ? "nav-item active" : "nav-item"}
              onClick={() => setActive(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">helix-web · v0.1.0</div>
      </aside>

      <main className="content">
        {active === "chat" && <ChatSection />}
        {active === "config" && <ConfigSection />}
        {active === "keys" && <KeysSection />}
        {active === "skills" && <SkillsSection />}
        {active === "mcp" && <McpSection />}
        {active === "memory" && <MemorySection />}
        {active === "files" && <FilesSection />}
        {active === "monitor" && <MonitorSection />}
      </main>
    </div>
  );
}
