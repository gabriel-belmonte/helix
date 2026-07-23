import { test, after } from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { makeMcpPlugin } from "../src/index.js";
import type { HelixPluginContext, HelixTool } from "helix-core";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "fixture-server.mjs");

// The MCP stdio server (node fixture-server.mjs) stays alive after the test,
// keeping the event loop busy so `tsx --test` (node) never exits -> CI hangs.
// Kill any matching child process after the suite and force-exit.
after(() => {
  try {
    execSync(`pkill -f "fixture-server.mjs" 2>/dev/null || true`);
  } catch { /* ignore */ }
  // Give the OS a tick to reap, then make sure node exits even if a handle leaks.
  setTimeout(() => process.exit(0), 50);
});

test("makeMcpPlugin connects over stdio and registers tools", async () => {
  const plugin = makeMcpPlugin({
    servers: {
      test: { type: "stdio", command: "node", args: [fixture] },
    },
  });

  const registered: HelixTool[] = [];
  const ctx: HelixPluginContext = {
    registry: { register: (t) => registered.push(t) } as any,
    config: {} as any,
    overrideTool: (t) => registered.push(t),
  };

  await plugin.register(ctx);

  const echo = registered.find((t) => t.name === "test__echo");
  assert.ok(echo, "echo tool should be registered namespaced as test__echo");
  assert.strictEqual(echo!.description, "Echo a message");
  assert.ok(echo!.schema && (echo!.schema as any).properties?.text, "schema should carry params");

  const result = await echo!.run({ text: "hi" });
  assert.strictEqual(result, "echoed: hi");
});
