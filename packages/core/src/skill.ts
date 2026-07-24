// HelixSkill — specialized instructions (à la OpenCode/Hermes skills).
//
// A skill is a folder containing a SKILL.md with YAML frontmatter:
//
//   ---
//   name: my-skill
//   description: When to use it, in one line, for the model to self-select.
//   ---
//   # Instructions
//   Detailed workflow / domain knowledge the agent should follow when the
//   skill is loaded.
//
// Skills are NOT tools. They are *guidance*: the agent lists available skills
// in the system prompt and, when a task matches, calls `use_skill(name)` to
// pull the full instructions into context. This mirrors OpenCode's
// "available_skills" + skill-tool pattern without a separate LLM call.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type HelixSkill = {
  name: string;
  description: string;
  /** Directory containing the skill (where SKILL.md lives). */
  dir: string;
  /** Full markdown body (instructions) — loaded on demand. */
  body: string;
};

export type SkillFrontmatter = {
  name?: string;
  description?: string;
};

// Parse a simple YAML frontmatter block (--- key: value ---). We only need
// `name` + `description`, so a tiny parser avoids a YAML dependency.
function parseFrontmatter(raw: string): { fm: SkillFrontmatter; body: string } {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fmText = m[1];
  const body = m[2];
  const fm: SkillFrontmatter = {};
  for (const line of fmText.split("\n")) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kv) (fm as any)[kv[1]] = kv[2].trim();
  }
  return { fm, body };
}

/**
 * Discover skills in a list of directories. Each directory may contain
 * subfolders with a SKILL.md; or a directory may itself be a skill.
 */
export function discoverSkills(dirs: string[]): HelixSkill[] {
  const skills: HelixSkill[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const skillDir = join(dir, entry);
      if (!statSync(skillDir).isDirectory()) continue;
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const raw = readFileSync(skillFile, "utf8");
      const { fm, body } = parseFrontmatter(raw);
      const name = fm.name ?? entry;
      if (skills.some((s) => s.name === name)) continue;
      skills.push({
        name,
        description: fm.description ?? "",
        dir: skillDir,
        body,
      });
    }
  }
  return skills;
}

/**
 * Render the <available_skills> guidance block for the system prompt:
 * a compact list so the model can self-select a skill.
 */
export function renderSkillGuidance(skills: HelixSkill[]): string {
  if (skills.length === 0) return "";
  const lines = [
    "Skills provide specialized instructions for specific tasks.",
    "If a task matches a skill description, call use_skill(name) to load it.",
    "<available_skills>",
    ...skills.flatMap((s) => [
      "  <skill>",
      `    <name>${s.name}</name>`,
      `    <description>${s.description}</description>`,
      "  </skill>",
    ]),
    "</available_skills>",
  ];
  return lines.join("\n");
}

/**
 * Build the `use_skill` tool that returns a skill's instructions on demand.
 * Also registers a `skill` alias (matching OpenCode's tool name) so skills
 * authored for OpenCode/Claude keep working unchanged.
 */
export function makeSkillTool(skills: HelixSkill[]) {
  const byName = new Map(skills.map((s) => [s.name, s]));
  const loader = {
    name: "use_skill",
    description:
      "Load a skill's specialized instructions into context. Call this when a task matches a skill description. Input: the skill name.",
    run: async (input: unknown) => {
      const name = typeof input === "string" ? input : (input as any)?.name;
      const skill = byName.get(name);
      if (!skill) {
        const known = [...byName.keys()].join(", ") || "(none)";
        return `Unknown skill "${name}". Available: ${known}`;
      }
      return `# Skill: ${skill.name}\n\n${skill.body}`;
    },
  };
  // OpenCode/Claude-compatible alias.
  const alias = { ...loader, name: "skill" };
  return [loader, alias];
}

/**
 * Add the `use_skill` tool + skill-management tools (create/edit/delete)
 * so agents can manage skill files autonomously.
 *
 * @param skillsDir Optional custom skills directory (defaults to ~/.helix/skills).
 *   Pass a temp dir in tests to avoid touching the real skill store.
 */
export function makeSkillManagementTools(skillsDir?: string) {
  const baseDir = skillsDir ?? join(homedir(), ".helix", "skills");

  const createSkill = {
    name: "create_skill",
    description:
      "Create a new skill. A skill is a SKILL.md file with YAML frontmatter (name, description) " +
      "and instructions body. After creation, it's immediately discoverable via use_skill.\n" +
      "Input: { name: string, description: string, body: string }",
    run: async (input: unknown) => {
      const { name, description, body } = input as {
        name: string; description: string; body: string;
      };
      if (!name || !name.match(/^[a-zA-Z0-9_-]+$/)) {
        return `Invalid skill name "${name}". Use alphanumeric, hyphens, or underscores.`;
      }
      const skillDir = join(baseDir, name);
      if (existsSync(skillDir)) {
        return `Skill "${name}" already exists. Use edit_skill to modify it.`;
      }
      mkdirSync(skillDir, { recursive: true });
      const skillContent = [
        "---",
        `name: ${name}`,
        `description: ${description || ""}`,
        "---",
        "",
        body || "",
      ].join("\n");
      writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf8");
      return `Created skill "${name}" (${skillContent.length} chars). Call use_skill("${name}") to load it.`;
    },
  };

  const editSkill = {
    name: "edit_skill",
    description:
      "Edit an existing skill's body. Optionally update its description via the frontmatter.\n" +
      "Input: { name: string, body: string, description?: string }",
    run: async (input: unknown) => {
      const { name, body, description } = input as {
        name: string; body: string; description?: string;
      };
      const skillDir = join(baseDir, name);
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) {
        return `Skill "${name}" not found. Use create_skill first.`;
      }
      const existing = readFileSync(skillFile, "utf8");
      const { fm } = parseFrontmatter(existing);
      // Rebuild the frontmatter, optionally updating description.
      const newFm = {
        name,
        description: description ?? fm.description ?? "",
      };
      const skillContent = [
        "---",
        `name: ${newFm.name}`,
        `description: ${newFm.description}`,
        "---",
        "",
        body || "",
      ].join("\n");
      writeFileSync(skillFile, skillContent, "utf8");
      return `Updated skill "${name}" (${skillContent.length} chars). Call use_skill("${name}") to load it.`;
    },
  };

  const deleteSkill = {
    name: "delete_skill",
    description:
      "Delete a skill and its SKILL.md file permanently.\n" +
      "Input: { name: string }",
    run: async (input: unknown) => {
      const { name } = input as { name: string };
      const skillDir = join(baseDir, name);
      if (!existsSync(skillDir)) {
        return `Skill "${name}" not found.`;
      }
      rmSync(skillDir, { recursive: true, force: true });
      return `Deleted skill "${name}".`;
    },
  };

  return [createSkill, editSkill, deleteSkill];
}

/**
 * Result of createSkillFromSource.
 */
export type SkillFromSourceResult = {
  name: string;
  message: string;
  dir: string;
};

/**
 * Read content from a URL or local file path and create a skill from it.
 * Used by `helix learn <url|file>`.
 *
 * - URLs: fetches via HTTP, derives skill name from the URL path
 * - Files: reads local file, derives skill name from the filename (without extension)
 */
export async function createSkillFromSource(target: string): Promise<SkillFromSourceResult> {
  const isUrl = target.startsWith("http://") || target.startsWith("https://");

  let content: string;
  let name: string;

  if (isUrl) {
    const resp = await fetch(target);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText} fetching ${target}`);
    content = await resp.text();
    // Derive name from URL: last path segment, no extension
    const urlPath = new URL(target).pathname.replace(/\/+$/, "");
    const slug = urlPath.split("/").pop() || "learned";
    name = slug.replace(/\.(md|txt|json|yaml|yml)$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  } else {
    const { readFileSync } = await import("node:fs");
    content = readFileSync(target, "utf8");
    // Derive name from filename
    const parts = target.replace(/\\/g, "/").split("/").pop() || "learned";
    name = parts.replace(/\.(md|txt|json|yaml|yml)$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  }

  if (!name) name = "learned";
  if (!content.trim()) throw new Error(`No content read from ${target}`);

  const skillsDir = join(homedir(), ".helix", "skills");
  const skillDir = join(skillsDir, name);

  // Avoid overwriting
  if (existsSync(skillDir)) {
    name = name + "-" + Date.now().toString(36);
    // Try again with suffix
    const altDir = join(skillsDir, name);
    if (existsSync(altDir)) {
      throw new Error(`Skill "${name}" already exists. Try a different name.`);
    }
    mkdirSync(altDir, { recursive: true });
    const skillContent = [
      "---",
      `name: ${name}`,
      `description: Learned from ${target}`,
      "---",
      "",
      content,
    ].join("\n");
    writeFileSync(join(altDir, "SKILL.md"), skillContent, "utf8");
    return { name, message: `Created skill from ${target}`, dir: altDir };
  }

  mkdirSync(skillDir, { recursive: true });
  const skillContent = [
    "---",
    `name: ${name}`,
    `description: Learned from ${target}`,
    "---",
    "",
    content,
  ].join("\n");
  writeFileSync(join(skillDir, "SKILL.md"), skillContent, "utf8");

  return { name, message: `Created skill from ${target}`, dir: skillDir };
}
