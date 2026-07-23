import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  discoverSkills,
  renderSkillGuidance,
  makeSkillTool,
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
