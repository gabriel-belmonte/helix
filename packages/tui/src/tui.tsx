// helix-tui — an Ink-based terminal UI over helix-core.
//
// Thin surface: it calls the SAME buildAgent() the CLI uses, so behavior is
// identical. Only the rendering differs — chat history, streaming output, and
// a live tool-call indicator.
//
// Input is built manually with useStdin/useInput (Ink 5 dropped <TextInput>);
// this keeps the dependency surface to just ink + react.

import React, { useState, useCallback, useRef, useEffect } from "react";
import { render, Box, Text, useApp, useInput, useStdin } from "ink";
import { buildAgent, loadProvider } from "helix-core";

type Msg = { role: "user" | "assistant" | "tool"; content: string };

const HELP = "Type a message and press Enter. Ctrl+C to quit.";

// `--scripted` uses a deterministic fake LLM (for tests / demos).
const SCRIPTED = process.argv.includes("--scripted");

function Chat() {
  const { exit } = useApp();
  const { stdin, setRawMode } = useStdin();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(true);
  const [tool, setTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<any>(null);

  // Boot: load provider + build the agent once.
  useEffect(() => {
    (async () => {
      try {
        const llm = loadProvider({ scripted: SCRIPTED });
        const agent = await buildAgent(llm, {
          config: { web: { search: true, extract: true } },
          onToolCall: (name: string) => setTool(name),
        });
        agentRef.current = agent;
        setBusy(false);
      } catch (e: any) {
        setError(e.message ?? String(e));
        setBusy(false);
      }
    })();
  }, []);

  // Capture keystrokes for the prompt field.
  useInput(
    (ch, key) => {
      if (key.ctrl && ch === "c") {
        exit();
        return;
      }
      if (key.return) {
        const prompt = input.trim();
        setInput("");
        if (prompt && !busy && agentRef.current) void submit(prompt);
        return;
      }
      if (key.backspace || key.delete) {
        setInput((s) => s.slice(0, -1));
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab && !key.return) {
        setInput((s) => s + ch);
      }
    },
    { isActive: !busy }
  );

  // Enable raw mode so we get key-by-key input (guard: needs a real TTY).
  useEffect(() => {
    if (!stdin || !setRawMode || !stdin.isTTY) return;
    setRawMode(true);
    return () => setRawMode(false);
  }, [stdin, setRawMode]);

  const submit = useCallback(async (prompt: string) => {
    setMessages((m) => [...m, { role: "user", content: prompt }]);
    setBusy(true);
    setStreaming("");
    setTool(null);

    try {
      const reply = await agentRef.current.run(prompt, (chunk: string) => {
        setStreaming((s) => s + chunk);
      });
      setMessages((m) => [
        ...m,
        ...(tool ? [{ role: "tool" as const, content: `ran ${tool}` }] : []),
        { role: "assistant" as const, content: reply },
      ]);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setStreaming("");
      setTool(null);
      setBusy(false);
    }
  }, [tool]);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to start Helix TUI:</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (busy && !agentRef.current) {
    return <Text color="cyan">Starting Helix…</Text>;
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column" flexGrow={1}>
        {messages.map((m, i) => (
          <Box key={i} flexDirection="column">
            {m.role === "user" && <Text color="green">› {m.content}</Text>}
            {m.role === "assistant" && <Text>{m.content}</Text>}
            {m.role === "tool" && <Text color="yellow" dimColor>  ⚙ {m.content}</Text>}
          </Box>
        ))}
        {streaming && <Text color="cyan">{streaming}</Text>}
        {tool && <Text color="yellow">  ⚙ running {tool}…</Text>}
      </Box>

      <Box marginTop={1}>
        <Text color="magenta">❯ </Text>
        {busy ? (
          <Text dimColor>working…</Text>
        ) : (
          <Text>{input}</Text>
        )}
      </Box>
    </Box>
  );
}

render(<Chat />);
