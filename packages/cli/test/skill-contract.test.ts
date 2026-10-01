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

const SKILLS = ["senior-engineer", "product-planner"] as const;

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
