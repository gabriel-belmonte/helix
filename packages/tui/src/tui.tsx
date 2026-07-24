// helix-tui — an Ink-based terminal UI over helix-core.
//
// Thin surface: it calls the SAME buildAgent() the CLI uses, so behavior is
// identical. Only the rendering differs — chat history, streaming output, a
// live tool-call indicator, and a model picker (Ctrl+M).
//
// Input is built manually with useStdin/useInput (Ink 5 dropped <TextInput>);
// this keeps the dependency surface to just ink + react.

import React, { useState, useCallback, useRef, useEffect } from "react";
import { render, Box, Text, useApp, useInput, useStdin } from "ink";
import { buildAgent, loadProvider, ZEN_MODELS, fetchZenModels, isFreeModel } from "helix-core";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

type Msg = { role: "user" | "assistant" | "tool"; content: string };

const HELP = "Type a message and press Enter. Ctrl+C to quit. Ctrl+M to pick a model.";
const CONFIG_PATH = join(homedir(), ".helix", "config.json");

function loadConfig(): { provider?: string; model?: string } {
  try {
    return existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, "utf8")) : {};
  } catch {
    return {};
  }
}
function saveConfig(cfg: Record<string, unknown>) {
  mkdirSync(join(homedir(), ".helix"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

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
  const [model, setModel] = useState(loadConfig().model ?? "big-pickle");
  const agentRef = useRef<any>(null);
  const providerRef = useRef<any>(null);

  // Model picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [models, setModels] = useState<typeof ZEN_MODELS>(ZEN_MODELS);
  const [pickIdx, setPickIdx] = useState(0);

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
        providerRef.current = llm;
        // Load live model catalog (falls back to curated list).
        const live = await fetchZenModels().catch(() => ZEN_MODELS);
        setModels(live);
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
      if (key.ctrl && (ch === "m" || ch === "M")) {
        setPickerOpen((o) => !o);
        return;
      }
      if (pickerOpen) {
        if (key.upArrow) setPickIdx((i) => Math.max(0, i - 1));
        else if (key.downArrow) setPickIdx((i) => Math.min(models.length - 1, i + 1));
        else if (key.return) {
          const chosen = models[pickIdx].id;
          const cfg = loadConfig();
          cfg.model = chosen;
          saveConfig(cfg);
          setModel(chosen);
          setPickerOpen(false);
        } else if (key.escape) {
          setPickerOpen(false);
        }
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
    { isActive: true }
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

      {pickerOpen ? (
        <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column" height={12}>
          <Text color="magenta" bold>Zen models — ↑/↓ navigate, Enter select, Esc close</Text>
          <Text color="green" dimColor>  (green = free)</Text>
          {models.slice(Math.max(0, pickIdx - 4), pickIdx + 6).map((m, i) => {
            const realIdx = Math.max(0, pickIdx - 4) + i;
            const sel = realIdx === pickIdx;
            const label = m.free ? <Text color="green">{m.id}</Text> : <Text>{m.id}</Text>;
            return (
              <Box key={m.id}>
                <Text color={sel ? "magenta" : "gray"}>{sel ? "▶ " : "  "}</Text>
                {label}
                {m.id === model && <Text color="yellow">  (current)</Text>}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="gray">model: </Text>
          <Text color={isFreeModel(model) ? "green" : "cyan"}>{model}</Text>
          <Text color="magenta">  ❯ </Text>
          {busy ? (
            <Text dimColor>working…</Text>
          ) : (
            <Text>{input}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// Print version and exit (no TUI) when --version/-V is passed.
function printVersionAndExit() {
  try {
    let dir = import.meta.dirname ?? ".";
    if (typeof dir === "string" && dir.startsWith("file://")) dir = new URL(dir).pathname;
    let cur = dir;
    for (let i = 0; i < 6; i++) {
      const p = join(cur, "package.json");
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, "utf8"));
        if (pkg.name === "helix-tui" || pkg.name?.startsWith("helix-")) {
          console.log(`helix-tui ${pkg.version ?? "0.0.0"}`);
          process.exit(0);
        }
      }
      const parent = join(cur, "..");
      if (parent === cur) break;
      cur = parent;
    }
  } catch {
    /* ignore */
  }
  console.log("helix-tui 0.0.0");
  process.exit(0);
}

if (process.argv.includes("--version") || process.argv.includes("-V")) {
  printVersionAndExit();
}

/** Start the TUI. Called by the CLI (helix tui) or directly. */
export function startTui() {
  render(<Chat />);
}

// Allow running directly: `bun run tui.tsx`
const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) startTui();
