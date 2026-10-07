import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-11T10:00:00.000Z");
const now = () => new Date(BASE + t++ * 1000).toISOString();

async function cli(args: string[], root: string) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  return { code, out, err };
}
async function ok(args: string[], root: string) {
  const r = await cli(args, root);
  if (r.code !== 0) throw new Error(`${args.join(" ")} exited ${r.code}: ${r.err}${r.out}`);
  return r;
}
const json = (c: { out: string }) => JSON.parse(c.out).data;

async function project(files: Record<string, string> = {}): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-agents-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body, "utf8");
  }
  await ok(["init"], root);
  return root;
}
const read = (root: string, p: string) => readFileSync(join(root, p), "utf8");

describe("michi agents", () => {
  it("lists every adapter and what it would write", async () => {
    const r = await ok(["agents", "--json"], await project());
    const ids = json(r).agents.map((a: { id: string }) => a.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("manual");
    expect(json(r).agents.every((a: { writes: string[] }) => a.writes.includes("AGENTS.md"))).toBe(true);
  });

  it("proposes what it found, and says what it saw", async () => {
    const r = await ok(["agents"], await project({ ".cursor/rules/x.mdc": "x" }));
    expect(r.out).toMatch(/Cursor/);
    expect(r.out).toMatch(/\.cursor/);
    expect(r.out.toLowerCase()).toMatch(/found|detected/);
  });

  it("does not decide — it asks for a name", async () => {
    const r = await ok(["agents"], await project({ ".cursor/rules/x.mdc": "x", ".claude/settings.json": "{}" }));
    expect(r.out).toMatch(/michi install --agent/);
  });

  it("writes nothing", async () => {
    const root = await project();
    await ok(["agents"], root);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
  });
});

describe("michi install", () => {
  it("writes the baseline and nothing else for manual", async () => {
    const root = await project();
    const r = await ok(["install", "--agent", "manual", "--json"], root);
    expect(json(r).written).toEqual(["AGENTS.md"]);
    expect(read(root, "AGENTS.md")).toContain("michi status");
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });

  it("gives Claude Code its skills in its own format", async () => {
    const root = await project();
    await ok(["install", "--agent", "claude-code"], root);
    expect(read(root, ".claude/skills/senior-engineer/SKILL.md")).toMatch(/^---\n/);
    expect(read(root, ".claude/skills/tester/SKILL.md")).toContain("verification.allow");
  });

  it("is idempotent — a second run writes nothing", async () => {
    const root = await project();
    await ok(["install", "--agent", "claude-code"], root);
    const again = await ok(["install", "--agent", "claude-code", "--json"], root);
    expect(json(again).written).toEqual([]);
    expect(json(again).unchanged.length).toBeGreaterThan(0);
  });

  it("refuses to clobber a hand-written file, and shows the difference", async () => {
    const root = await project({ "AGENTS.md": "# My own notes\n\nDo not touch this.\n" });
    const r = await cli(["install", "--agent", "manual"], root);
    expect(r.code).toBe(7);
    expect(read(root, "AGENTS.md")).toBe("# My own notes\n\nDo not touch this.\n");
    expect(r.out + r.err).toMatch(/My own notes/);
  });

  it("still installs everything it can when one file conflicts", async () => {
    const root = await project({ "AGENTS.md": "mine\n" });
    const r = await cli(["install", "--agent", "claude-code", "--json"], root);
    expect(r.code).toBe(7);
    expect(existsSync(join(root, ".claude/skills/reviewer/SKILL.md"))).toBe(true);
  });

  it("--dry-run shows the plan and writes nothing", async () => {
    const root = await project();
    const r = await ok(["install", "--agent", "claude-code", "--dry-run", "--json"], root);
    expect(json(r).dry_run).toBe(true);
    expect(json(r).would_write.length).toBeGreaterThan(5);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
  });

  it("installs for several agents at once without writing the baseline twice", async () => {
    const root = await project();
    const r = await ok(["install", "--agent", "claude-code", "--agent", "cursor", "--json"], root);
    expect(json(r).written.filter((p: string) => p === "AGENTS.md")).toHaveLength(1);
    expect(json(r).written).toContain(".cursor/rules/michi.mdc");
  });

  it("names an agent it does not know, and points at manual", async () => {
    const r = await cli(["install", "--agent", "emacs-whisperer"], await project());
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/manual/);
  });

  it("says plainly when it cannot tell whether the agent can run commands", async () => {
    const r = await ok(["install", "--agent", "copilot"], await project());
    expect(r.out.toLowerCase()).toMatch(/cannot tell|human step/);
  });

  it("needs an initialised project", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-bare-"));
    made.push(root);
    const r = await cli(["install", "--agent", "manual"], root);
    expect(r.code).toBe(3);
  });

  it("writes no credentials and touches nothing in .michi", async () => {
    const root = await project();
    const before = readFileSync(join(root, ".michi/config.yaml"), "utf8");
    await ok(["install", "--agent", "claude-code"], root);
    expect(readFileSync(join(root, ".michi/config.yaml"), "utf8")).toBe(before);
    const everything = [read(root, "AGENTS.md"), read(root, ".claude/skills/tester/SKILL.md")].join("\n");
    expect(everything).not.toMatch(/api[_-]?key|token|secret|password/i);
  });
});

describe("the adapter boundary does not leak into the process", () => {
  it("install changes no requirement, decision or task", async () => {
    const root = await project();
    const before = json(await ok(["status", "--json"], root));
    await ok(["install", "--agent", "claude-code"], root);
    const after = json(await ok(["status", "--json"], root));
    expect(after.stage).toBe(before.stage);
    expect(after.counts).toEqual(before.counts);
  });

  it("an agent's context default is a number the CLI passes, not knowledge in Core", async () => {
    const root = await project();
    const r = await cli(["context", "REQ-001", "--agent", "claude-code", "--json"], root);
    // No requirements yet, so it fails on the requirement — never on the agent.
    expect(r.code).not.toBe(2);                      // the flag is understood
    expect(r.err + r.out).not.toMatch(/claude-code/); // and Core never hears the name
  });

  it("refuses --agent and --budget together rather than guessing which wins", async () => {
    const root = await project();
    const r = await cli(["context", "REQ-001", "--agent", "claude-code", "--budget", "1000"], root);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/--budget/);
  });
});

describe("michi init --agent", () => {
  it("sets up MICHI and installs for the named agent in one go", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-init-ag-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
    const r = await ok(["init", "--agent", "cursor"], root);
    expect(existsSync(join(root, ".michi/config.yaml"))).toBe(true);
    expect(existsSync(join(root, ".cursor/rules/michi.mdc"))).toBe(true);
    expect(read(root, "AGENTS.md")).toContain("michi status");
    expect(r.out).toMatch(/cursor/);
  });

  it("writes no agent files when no agent was named", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-init-no-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
    const r = await ok(["init"], root);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
    expect(r.out).toMatch(/michi agents/);
  });

  it("--dry-run with an agent writes nothing at all", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-init-dry-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
    await ok(["--dry-run", "init", "--agent", "claude-code"], root);
    expect(existsSync(join(root, ".michi"))).toBe(false);
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });
});
