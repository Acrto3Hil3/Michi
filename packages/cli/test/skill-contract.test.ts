import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "../src/run.js";

const SKILL = fileURLToPath(new URL("../../skills/senior-engineer/SKILL.md", import.meta.url));

const text = () => readFileSync(SKILL, "utf8");

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

/** Every `michi …` the skill tells the agent to run must actually exist. */
async function commandExists(parts: string[]): Promise<boolean> {
  let code = 1;
  code = await run([...parts, "--help"], { out: () => {}, err: () => {} }, { now: () => "2026-09-29T00:00:00.000Z" });
  return code === 0;
}

describe("senior-engineer skill", () => {
  it("exists", () => {
    expect(existsSync(SKILL)).toBe(true);
  });

  it("has frontmatter naming itself and saying when to use it", () => {
    const fm = frontmatter(text());
    expect(fm.name).toBe("senior-engineer");
    expect(fm.description).toBeTruthy();
    expect((fm.description ?? "").length).toBeGreaterThan(60);
    // A description that describes internals instead of triggers never fires.
    expect((fm.description ?? "").toLowerCase()).toMatch(/use (this |it )?when|when the user/);
  });

  it("only tells the agent to run commands that exist", async () => {
    const body = text();
    const mentioned = new Set<string>();
    for (const m of body.matchAll(/`michi ([a-z]+(?: [a-z]+)?)/g)) {
      if (m[1]) mentioned.add(m[1]);
    }
    expect(mentioned.size).toBeGreaterThan(4);
    for (const command of mentioned) {
      expect(await commandExists(command.split(" ")), `michi ${command}`).toBe(true);
    }
  });

  it("carries the universal rules every skill must obey", () => {
    const body = text().toLowerCase();
    for (const rule of [
      "michi status",          // read state before acting
      "never",                 // prohibitions are stated
      "stop",                  // stop conditions
      "plain language",        // P11
    ]) {
      expect(body).toContain(rule);
    }
  });

  it("forbids the things Phase 2 must not do", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/do not write (any )?(application )?code|never write .*code/);
    expect(body).toMatch(/stated|inferred|assumed/);
    expect(body).toMatch(/confirm/);
  });

  it("never instructs the agent to confirm on the user's behalf", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/only the user|the user confirms|never confirm/);
  });

  it("states the progressive-discovery rule rather than a question dump", () => {
    const body = text().toLowerCase();
    expect(body).toMatch(/one question|a few|not.*at once|progressive/);
  });

  it("is short enough to be read every time it loads", () => {
    expect(text().split("\n").length).toBeLessThan(260);
  });
});
