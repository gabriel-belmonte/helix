import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  discoverSkills,
  renderSkillGuidance,
  makeSkillTool,
  makeSkillManagementTools,
} from "../src/skill.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync("/tmp/helix-skill-");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("discoverSkills reads SKILL.md with frontmatter", () => {
  const skillDir = join(dir, "my-skill");
  mkdirSync(skillDir);
  writeFileSync(
    join(skillDir, "SKILL.md"),
    "---\nname: my-skill\ndescription: Do the thing when X\n---\n\n# My Skill\n\nInstructions here.\n"
  );
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills.length, 1);
  assert.strictEqual(skills[0].name, "my-skill");
  assert.strictEqual(skills[0].description, "Do the thing when X");
  assert.match(skills[0].body, /Instructions here\./);
});

test("discoverSkills ignores folders without SKILL.md", () => {
  mkdirSync(join(dir, "not-a-skill"));
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills.length, 0);
});

test("renderSkillGuidance emits available_skills block", () => {
  const skills = [
    { name: "a", description: "desc a", dir: dir, body: "A body" },
    { name: "b", description: "desc b", dir: dir, body: "B body" },
  ] as any;
  const out = renderSkillGuidance(skills);
  assert.match(out, /<available_skills>/);
  assert.match(out, /<name>a<\/name>/);
  assert.match(out, /<description>desc b<\/description>/);
});

test("renderSkillGuidance empty when no skills", () => {
  assert.strictEqual(renderSkillGuidance([]), "");
});

test("use_skill tool returns the skill body, errors on unknown", async () => {
  const skills = [{ name: "demo", description: "d", dir: dir, body: "# Demo\n\nDo this." }] as any;
  const [tool] = makeSkillTool(skills);
  const ok = await tool.run("demo");
  assert.match(ok as string, /Do this\./);
  const bad = await tool.run("nope");
  assert.match(bad as string, /Unknown skill/);
});

test("skill alias is also registered (OpenCode-compatible)", async () => {
  const skills = [{ name: "demo", description: "d", dir: dir, body: "body" }] as any;
  const tools = makeSkillTool(skills);
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("use_skill"));
  assert.ok(names.includes("skill"));
});

// ── Skill Management Tools (create/edit/delete) ──────────────────────

test("create_skill creates SKILL.md with frontmatter", async () => {
  const [create] = makeSkillManagementTools(dir);
  const result = await create.run({ name: "test-skill", description: "Test description", body: "# Test\n\nInstructions here." });
  assert.match(result as string, /Created skill "test-skill"/);

  // Verify on disk
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills.length, 1);
  assert.strictEqual(skills[0].name, "test-skill");
  assert.strictEqual(skills[0].description, "Test description");
  assert.match(skills[0].body, /Instructions here\./);
});

test("create_skill rejects invalid name", async () => {
  const [create] = makeSkillManagementTools(dir);
  const result = await create.run({ name: "bad name!", description: "", body: "x" });
  assert.match(result as string, /Invalid skill name/);
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills.length, 0);
});

test("create_skill rejects duplicate name", async () => {
  const [create] = makeSkillManagementTools(dir);
  await create.run({ name: "dup", description: "d1", body: "one" });
  const result = await create.run({ name: "dup", description: "d2", body: "two" });
  assert.match(result as string, /already exists/);
});

test("edit_skill updates body and optionally description", async () => {
  const tools = makeSkillManagementTools(dir);
  const [create, edit] = tools;
  await create.run({ name: "editable", description: "original", body: "# Original" });
  const result = await edit.run({ name: "editable", body: "# Updated", description: "new desc" });

  assert.match(result as string, /Updated skill "editable"/);
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills.length, 1);
  assert.strictEqual(skills[0].name, "editable");
  assert.strictEqual(skills[0].description, "new desc");
  assert.match(skills[0].body, /Updated/);
});

test("edit_skill preserves description when not provided", async () => {
  const tools = makeSkillManagementTools(dir);
  const [create, edit] = tools;
  await create.run({ name: "preserve", description: "keep-me", body: "# Before" });
  const result = await edit.run({ name: "preserve", body: "# After" });
  assert.match(result as string, /Updated skill "preserve"/);
  const skills = discoverSkills([dir]);
  assert.strictEqual(skills[0].description, "keep-me");
});

test("edit_skill errors on missing skill", async () => {
  const [, edit] = makeSkillManagementTools(dir);
  const result = await edit.run({ name: "nope", body: "x" });
  assert.match(result as string, /not found/);
});

test("delete_skill removes skill directory", async () => {
  const tools = makeSkillManagementTools(dir);
  const [create, , remove] = tools;
  await create.run({ name: "delete-me", description: "to-go", body: "bye" });
  assert.strictEqual(discoverSkills([dir]).length, 1);

  const result = await remove.run({ name: "delete-me" });
  assert.match(result as string, /Deleted skill "delete-me"/);
  assert.strictEqual(discoverSkills([dir]).length, 0);
});

test("delete_skill errors on missing skill", async () => {
  const [, , remove] = makeSkillManagementTools(dir);
  const result = await remove.run({ name: "ghost" });
  assert.match(result as string, /not found/);
});
