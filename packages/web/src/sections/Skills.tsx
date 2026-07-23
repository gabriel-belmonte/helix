import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export function SkillsSection() {
  const [skills, setSkills] = useState<{ name: string; description: string; dir: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api("/skills").then(setSkills).catch((e) => setErr(String(e)));
  }, []);

  return (
    <section>
      <h1>Skills</h1>
      <p className="muted">
        Discovered from ~/.helix/skills, ./skills, ~/.claude/skills, ~/.agents/skills.
        Compatible with skills.sh / OpenCode.
      </p>

      <div className="cards">
        {skills.length === 0 && <p className="muted">No skills found.</p>}
        {skills.map((s) => (
          <div className="card" key={s.name}>
            <h3>{s.name}</h3>
            <p className="muted">{s.description}</p>
            <code className="path">{s.dir}</code>
          </div>
        ))}
      </div>
      {err && <span className="err">{err}</span>}
    </section>
  );
}
