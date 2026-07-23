import { test } from "node:test";
import assert from "node:assert";
import { buildAgent } from "helix-core";
import { scriptedLLM } from "helix-agent";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

test("agent can list a directory and write a file via tools", async () => {
  const llm = scriptedLLM((t) => {
    if (t === 0) return "@@TOOL@@ list_dir {}";
    if (t === 1)
      return '@@TOOL@@ write_file {"path":"helix-test-out.txt","content":"hello from helix"}';
    return "Done. I listed the dir and wrote the file.";
  });

  const agent = await buildAgent(llm);
  const reply = await agent.run("list files then write a test file");
  assert.match(reply, /Done/);

  const out = join(process.cwd(), "helix-test-out.txt");
  const content = readFileSync(out, "utf8");
  assert.equal(content, "hello from helix");
  rmSync(out);
});

test("agent reports unknown tool gracefully", async () => {
  const llm = scriptedLLM(() => "@@TOOL@@ nope {}");
  const agent = await buildAgent(llm);
  const reply = await agent.run("do something");
  assert.match(reply, /unknown tool/);
});
