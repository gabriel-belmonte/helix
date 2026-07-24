import { test } from "node:test";
import assert from "node:assert";
import { parseArgs } from "../src/args.ts";

test("parseArgs empty array returns defaults", () => {
  const opts = parseArgs([]);
  assert.strictEqual(opts.prompt, undefined);
  assert.strictEqual(opts.verbose, undefined);
  assert.strictEqual(opts.dashboard, undefined);
  assert.strictEqual(opts.tui, undefined);
});

test("parseArgs -p sets prompt", () => {
  const opts = parseArgs(["-p", "hello world"]);
  assert.strictEqual(opts.prompt, "hello world");
});

test("parseArgs --sandbox sets sandboxTool flag", () => {
  const opts = parseArgs(["--sandbox", "-p", "test"]);
  assert.strictEqual(opts.sandboxTool, true);
  assert.strictEqual(opts.prompt, "test");
});

test("parseArgs --sandbox without -p still sets flag", () => {
  const opts = parseArgs(["--sandbox"]);
  assert.strictEqual(opts.sandboxTool, true);
});

test("parseArgs dashboard subcommand sets dashboard on", () => {
  const opts = parseArgs(["dashboard"]);
  assert.strictEqual(opts.dashboard, true);
});

test("parseArgs tui subcommand sets tui on", () => {
  const opts = parseArgs(["tui"]);
  assert.strictEqual(opts.tui, true);
});

test("parseArgs -v sets verbose mode", () => {
  const opts = parseArgs(["-v", "-p", "test"]);
  assert.strictEqual(opts.verbose, true);
});

test("parseArgs --version sets version flag", () => {
  const opts = parseArgs(["--version"]);
  assert.strictEqual(opts.version, true);
});

test("parseArgs -V sets version flag", () => {
  const opts = parseArgs(["-V"]);
  assert.strictEqual(opts.version, true);
});

test("parseArgs submit-task parses sub-agent task (positional)", () => {
  const opts = parseArgs(["submit-task", "/tmp/task.json", "/tmp/out.json"]);
  assert.strictEqual(opts.submitTask, "/tmp/task.json");
  assert.strictEqual(opts.submitResult, "/tmp/out.json");
});

test("parseArgs submit-task without result file", () => {
  const opts = parseArgs(["submit-task", "/tmp/task.json"]);
  assert.strictEqual(opts.submitTask, "/tmp/task.json");
  assert.strictEqual(opts.submitResult, undefined);
});

test("parseArgs config set <k> <v>", () => {
  const opts = parseArgs(["config", "set", "provider", "zen"]);
  assert.strictEqual(opts.config, true);
  assert.strictEqual(opts.configKey, "provider");
  assert.strictEqual(opts.configVal, "zen");
});

test("parseArgs config list", () => {
  const opts = parseArgs(["config", "list"]);
  assert.strictEqual(opts.config, true);
  assert.strictEqual(opts.configGet, true);
});

test("parseArgs auth login <provider>", () => {
  const opts = parseArgs(["auth", "login", "anthropic"]);
  assert.strictEqual(opts.auth, true);
  assert.strictEqual(opts.authAction, "login");
  assert.strictEqual(opts.authProvider, "anthropic");
});

test("parseArgs auth list", () => {
  const opts = parseArgs(["auth", "list"]);
  assert.strictEqual(opts.auth, true);
  assert.strictEqual(opts.authAction, "list");
});

test("parseArgs models list", () => {
  const opts = parseArgs(["models"]);
  assert.strictEqual(opts.modelsList, true);
});

test("parseArgs --web-search", () => {
  const opts = parseArgs(["--web-search"]);
  assert.strictEqual(opts.webSearch, true);
});

test("parseArgs --web-extract", () => {
  const opts = parseArgs(["--web-extract"]);
  assert.strictEqual(opts.webExtract, true);
});

test("parseArgs eval --suite", () => {
  const opts = parseArgs(["eval", "--suite", "test.json"]);
  assert.strictEqual(opts.eval, true);
  assert.strictEqual(opts.evalSuite, "test.json");
});

test("parseArgs eval --suite --compare --judge", () => {
  const opts = parseArgs(["eval", "--suite", "t.json", "--compare", "model-a", "--judge", "model-b"]);
  assert.strictEqual(opts.eval, true);
  assert.strictEqual(opts.evalSuite, "t.json");
  assert.strictEqual(opts.evalCompare, "model-a");
  assert.strictEqual(opts.evalJudge, "model-b");
});

test("parseArgs session save/load/list/export", () => {
  const save = parseArgs(["session", "save", "my-session"]);
  assert.strictEqual(save.sessionAction, "save");
  assert.strictEqual(save.sessionName, "my-session");

  const load = parseArgs(["session", "load", "my-session"]);
  assert.strictEqual(load.sessionAction, "load");
  assert.strictEqual(load.sessionName, "my-session");

  const list = parseArgs(["session", "list"]);
  assert.strictEqual(list.sessionAction, "list");

  const exp = parseArgs(["session", "export", "my-session"]);
  assert.strictEqual(exp.sessionAction, "export");
  assert.strictEqual(exp.sessionName, "my-session");
});

test("parseArgs status", () => {
  const opts = parseArgs(["status"]);
  assert.strictEqual(opts.status, true);
});

test("parseArgs doctor", () => {
  const opts = parseArgs(["doctor"]);
  assert.strictEqual(opts.doctor, true);
});

test("parseArgs init", () => {
  const opts = parseArgs(["init"]);
  assert.strictEqual(opts.init, true);
});

test("parseArgs history clear", () => {
  const opts = parseArgs(["history", "clear"]);
  assert.strictEqual(opts.historyClear, true);
});

test("parseArgs json mode", () => {
  const opts = parseArgs(["--json"]);
  assert.strictEqual(opts.jsonMode, true);
});
