import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatSection() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sess = "web-dashboard";
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    try {
      const { reply } = await api("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, sessionId: sess }),
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Chat</h1>
      <p className="muted">Talk to Helix live. Uses your configured provider (or demo mode if no key is set).</p>

      <div className="chat">
        {messages.length === 0 && (
          <p className="muted chat-empty">No messages yet. Say hello!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "bubble user" : "bubble bot"}>
            <span className="who">{m.role === "user" ? "you" : "helix"}</span>
            <span className="txt">{m.content}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder={busy ? "thinking…" : "Type a message…"}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn primary" onClick={send} disabled={busy}>
          {busy ? "…" : "Send"}
        </button>
      </div>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
