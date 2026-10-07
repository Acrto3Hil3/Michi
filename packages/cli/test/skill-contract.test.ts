import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "../src/run.js";

/**
 * Structural checks only.
 *
 * These prove a skill is well formed. They prove nothing about whether an
 * agent following it conducts a good session — see SKILL_CONTRACT.md, "Known
 * limitation". Never cite these as evidence of agent behaviour.
 */

const skillPath = (name: string) =>
  fileURLToPath(new URL(`../../skills/${name}/SKILL.md`, import.meta.url));

function frontmatter(source: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match || !match[1]) throw new Error("no frontmatter");
  const out: Record<string, string> = {};
  let key = "";
  for (const line of match[1].split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv && kv[1]) { key = kv[1]; out[key] = (kv[2] ?? "").replace(/^[>|]\s*$/, "").trim(); }
    else if (key) out[key] = `${out[key]} ${line.trim()}`.trim();
  }
  return out;
}

async function commandExists(parts: string[]): Promise<boolean> {
  const code = await run([...parts, "--help"], { out: () => {}, err: () => {} },
    { now: () => "2026-10-01T00:00:00.000Z" });
  return code === 0;
}

const SKILLS = [
  "senior-engineer", "product-planner", "architecture", "implementer",
  "reviewer", "tester", "debugger",
] as const;

describe.each(SKILLS)("%s skill", (name) => {
  const text = () => readFileSync(skillPath(name), "utf8");

  it("exists", () => {
    expect(existsSync(skillPath(name))).toBe(true);
  });

  it("names itself and says when to use it", () => {
    const fm = frontmatter(text());
    expect(fm.name).toBe(name);
    expect((fm.description ?? "").length).toBeGreaterThan(60);
    expect((fm.description ?? "").toLowerCase()).toMatch(/use (this |it )?when|when the user/);
  });

  it("only tells the agent to run commands that exist", async () => {
    const mentioned = new Set<string>();
    for (const m of text().matchAll(/`michi ([a-z]+(?: [a-z]+)?)/g)) {
      if (m[1]) mentioned.add(m[1]);
    }
    expect(mentioned.size).toBeGreaterThan(2);
    for (const command of mentioned) {
      expect(await commandExists(command.split(" ")), `michi ${command}`).toBe(true);
    }
  });

  it("carries the universal rules", () => {
    const body = text().toLowerCase();
    expect(body).toContain("michi status");
    expect(body).toContain("never");
    expect(body).toMatch(/stop/);
    expect(body).toMatch(/plain language|in their language|ordinary words/);
  });

  it("marks how it knows things", () => {
    expect(text().toLowerCase()).toMatch(/stated|inferred|assumed|confirm/);
  });

  it("never instructs the agent to confirm on the user's behalf", () => {
    expect(text().toLowerCase()).toMatch(
      /only the user|the user confirms|never confirm|user decides|on the user's behalf/,
    );
  });

  it("asks progressively rather than dumping questions", () => {
    expect(text().toLowerCase()).toMatch(/one question|a few|not.*at once|progressive|one at a time/);
  });

  it("forbids writing application code", () => {
    expect(text().toLowerCase()).toMatch(/do not write (any )?(application )?code|never write .*code/);
  });

  it("is short enough to be read every time it loads", () => {
    expect(text().split("\n").length).toBeLessThan(300);
  });
});

describe("product-planner specifics", () => {
  const text = () => readFileSync(skillPath("product-planner"), "utf8");

  it("treats the MVP boundary as the user's call", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/mvp|first version/);
    expect(body).toMatch(/future/);
    expect(body).toMatch(/out of scope|out_of_scope/);
  });

  it("keeps FUTURE distinct from ruled out", () => {
    expect(text().toLowerCase()).toMatch(/future is.*not.*deletion|promise, not|not a deletion/);
  });

  it("requires acceptance criteria a later phase can actually check", () => {
    const body = text();
    expect(body).toMatch(/Given/);
    expect(body).toMatch(/When/);
    expect(body).toMatch(/Then/);
  });

  it("does not instruct the agent to make architecture decisions", () => {
    expect(text().toLowerCase()).toMatch(/not.*architecture|architecture.*later|belongs to architecture/);
  });

  it("points at discovery's requirements rather than inventing its own", () => {
    expect(text()).toMatch(/REQ-/);
  });
});

describe("architecture specifics", () => {
  const text = () => readFileSync(skillPath("architecture"), "utf8");

  it("insists architecture is proportional to the problem", () => {
    expect(text().toLowerCase()).toMatch(/proportional|smallest thing that|not.*distributed/);
  });

  it("tells the agent to preserve what an existing project already uses", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/michi scan|already (uses|there)|existing project/);
    expect(body).toMatch(/preserve|keep it/);
  });

  it("requires options with honest trade-offs and one recommendation", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/trade.?off/);
    expect(body).toMatch(/recommend/);
  });

  it("routes decisions through michi decide rather than inventing a store", () => {
    expect(text()).toMatch(/michi decide propose/);
    expect(text()).toMatch(/michi decide confirm/);
  });

  it("ties each decision to the requirements it is for", () => {
    expect(text()).toMatch(/affects_requirements/);
    expect(text()).toMatch(/REQ-/);
  });

  it("says plainly that a locked decision is superseded, never edited", () => {
    expect(text()).toMatch(/supersede/);
  });

  it("does not claim to write COMPONENTS.md or DATA.md", () => {
    expect(text()).not.toMatch(/COMPONENTS\.md/);
    expect(text()).not.toMatch(/DATA\.md/);
  });
});

describe("implementer specifics", () => {
  const text = () => readFileSync(skillPath("implementer"), "utf8");

  it("does not write application code itself", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/does not write|do not write/);
    expect(body).toMatch(/compil|instruction/);
  });

  it("never hand-edits a compiled instruction", () => {
    expect(text().toLowerCase()).toMatch(/do not edit|never edit|generated artifact/);
  });

  it("checks the handoff before handing over", () => {
    const body = text();
    expect(body).toMatch(/michi task next/);
    expect(body).toMatch(/michi task start/);
    expect(body).toMatch(/michi task report/);
  });

  it("treats the agent's report as a claim", () => {
    expect(text().toLowerCase()).toMatch(/claim/);
    expect(text().toLowerCase()).toMatch(/not evidence|evidence/);
  });

  it("stops rather than inventing a missing decision", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/stop/);
    expect(body).toMatch(/locked decision|not been made|unlocked/);
  });

  it("knows verification is not its job", () => {
    expect(text().toLowerCase()).toMatch(/verif/);
  });
});

describe("the verification skills", () => {
  const text = (name: string) => readFileSync(skillPath(name), "utf8");

  it("the reviewer refuses to say 'looks good'", () => {
    const body = text("reviewer").toLowerCase();
    expect(body).toMatch(/looks good/);
    expect(body).toMatch(/pass|changes_required/);
    expect(body).toMatch(/file|line/);
  });

  it("the reviewer judges against the decisions, not its own taste", () => {
    expect(text("reviewer").toLowerCase()).toMatch(/locked|approved|preference/);
  });

  it("the tester picks the level from the change", () => {
    const body = text("tester").toLowerCase();
    expect(body).toMatch(/unit/);
    expect(body).toMatch(/integration/);
    expect(body).toMatch(/behaviour|behavior/);
  });

  it("the tester knows MICHI only runs what the user allow-listed", () => {
    expect(text("tester")).toMatch(/verification\.allow/);
    expect(text("tester")).toMatch(/michi test/);
  });

  it("the debugger reproduces before fixing", () => {
    const body = text("debugger").toLowerCase();
    expect(body).toMatch(/reproduc/);
    expect(body).toMatch(/root cause/);
    expect(body).toMatch(/every caller|callers/);
  });

  it("all three know a report is not evidence", () => {
    for (const name of ["reviewer", "tester", "debugger"]) {
      expect(text(name).toLowerCase(), name).toMatch(/evidence|observed|claim/);
    }
  });
});
