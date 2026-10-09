import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { ADAPTERS, adapterFor, adapterIds, detectAll, loadSkills, reconcile } from "../src/index.js";
import type { PlannedFile } from "../src/index.js";

const made: string[] = [];
const project = (files: Record<string, string> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), "michi-ad-"));
  made.push(root);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body, "utf8");
  }
  return root;
};
const after = () => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } };

describe("the boundary holds", () => {
  it("has the manual adapter, and it is the one that always applies", () => {
    expect(adapterIds()).toContain("manual");
    expect(adapterFor("manual").capabilities.native_skills).toBe(false);
  });

  it("covers every target the contract names", () => {
    for (const id of ["manual", "claude-code", "cursor", "codex", "gemini-cli",
                      "copilot", "windsurf", "cline",
                      "antigravity", "zed", "junie", "kiro", "trae"]) {
      expect(adapterIds(), id).toContain(id);
    }
  });

  it("refuses an agent it does not know, and says what it does know", () => {
    expect(() => adapterFor("emacs-whisperer")).toThrow(/emacs-whisperer/);
    expect(() => adapterFor("emacs-whisperer")).toThrow(/manual/);
  });

  it("gives every adapter an id matching its key, and a human name", () => {
    for (const [id, a] of Object.entries(ADAPTERS)) {
      expect(a.id).toBe(id);
      expect(a.displayName.length).toBeGreaterThan(2);
    }
  });
});

describe("every adapter writes the baseline", () => {
  const skills = loadSkills();

  it("loads the seven skills from @dev-subhash/michi-skills", () => {
    expect(skills.map((s) => s.name).sort()).toEqual([
      "architecture", "debugger", "implementer", "product-planner",
      "reviewer", "senior-engineer", "tester",
    ]);
    for (const s of skills) expect(s.body.length).toBeGreaterThan(400);
  });

  it("plans AGENTS.md for every single adapter, with the same content", () => {
    const baselines = new Set<string>();
    for (const a of Object.values(ADAPTERS)) {
      const plan = a.installPlan({ projectRoot: "/p", projectName: "shop", skills });
      const baseline = plan.files.find((f) => f.path === "AGENTS.md");
      expect(baseline, a.id).toBeTruthy();
      baselines.add(baseline!.content);
    }
    expect(baselines.size).toBe(1);
  });

  it("makes the baseline sufficient on its own", () => {
    const plan = adapterFor("manual").installPlan({ projectRoot: "/p", projectName: "shop", skills });
    const baseline = plan.files.find((f) => f.path === "AGENTS.md")!.content;
    // the whole loop, reachable from one file
    for (const command of ["michi status", "michi discover", "michi plan", "michi decide",
                           "michi context", "michi task start", "michi task report",
                           "michi test", "michi review", "michi verify", "michi task done"]) {
      expect(baseline, command).toContain(command);
    }
    // and the rules that are not negotiable
    expect(baseline).toMatch(/only the user/i);
    expect(baseline).toMatch(/claim/i);
    expect(baseline).toMatch(/verification\.allow/);
    for (const s of skills) expect(baseline).toContain(s.name);
  });

  it("plans only relative paths inside the project, never into .michi", () => {
    for (const a of Object.values(ADAPTERS)) {
      for (const f of a.installPlan({ projectRoot: "/p", projectName: "shop", skills }).files) {
        expect(f.path, `${a.id} ${f.path}`).not.toMatch(/^\//);     // not absolute
        expect(f.path, `${a.id} ${f.path}`).not.toMatch(/\.\./);     // no traversal
        expect(f.path, `${a.id} ${f.path}`).not.toMatch(/^\.michi\//); // state is not an adapter's business
        expect(f.content.length).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic — the same input plans the same bytes", () => {
    for (const a of Object.values(ADAPTERS)) {
      const once = a.installPlan({ projectRoot: "/p", projectName: "shop", skills });
      const twice = a.installPlan({ projectRoot: "/p", projectName: "shop", skills });
      expect(once, a.id).toEqual(twice);
    }
  });
});

describe("what each adapter adds on top", () => {
  const skills = loadSkills();
  const paths = (id: string) =>
    adapterFor(id).installPlan({ projectRoot: "/p", projectName: "shop", skills })
      .files.map((f) => f.path);

  it("gives Claude Code its native skill directory, all seven", () => {
    const p = paths("claude-code");
    for (const s of skills) expect(p).toContain(`.claude/skills/${s.name}/SKILL.md`);
    expect(adapterFor("claude-code").capabilities.native_skills).toBe(true);
  });

  it("writes Cursor rules with the frontmatter that makes them apply at all", () => {
    const plan = adapterFor("cursor").installPlan({ projectRoot: "/p", projectName: "shop", skills });
    const rule = plan.files.find((f) => f.path === ".cursor/rules/michi.mdc")!;
    expect(rule.content.startsWith("---\n")).toBe(true);
    expect(rule.content).toMatch(/\nalwaysApply: true\n/);
    expect(rule.content).toMatch(/\ndescription: /);
  });

  it("leaves Codex and manual on the baseline alone — that is the contract, not a gap", () => {
    expect(paths("codex")).toEqual(["AGENTS.md"]);
    expect(paths("manual")).toEqual(["AGENTS.md"]);
  });

  it("writes each single-file agent where that agent actually reads", () => {
    expect(paths("gemini-cli")).toContain("GEMINI.md");
    expect(paths("copilot")).toContain(".github/copilot-instructions.md");
    expect(paths("windsurf")).toContain(".windsurfrules");
    expect(paths("cline")).toContain(".clinerules");
  });

  it("says honestly whether it knows the agent can run commands", () => {
    expect(adapterFor("claude-code").capabilities.runs_commands).toBe(true);
    expect(adapterFor("copilot").capabilities.runs_commands).toBe(null);
  });
});

describe("detection proposes, it does not decide", () => {
  it("finds the agents a project shows signs of, and nothing else", async () => {
    const root = project({ ".claude/settings.json": "{}", ".cursor/rules/x.mdc": "x" });
    const found = (await detectAll(root)).filter((d) => d.present).map((d) => d.id);
    expect(found).toContain("claude-code");
    expect(found).toContain("cursor");
    expect(found).not.toContain("windsurf");
    after();
  });

  it("always offers manual, so a project with no agent is never stuck", async () => {
    const root = project({});
    const manual = (await detectAll(root)).find((d) => d.id === "manual");
    expect(manual?.present).toBe(true);
    expect(manual?.evidence.length).toBeGreaterThan(0);
    after();
  });

  it("cites what it saw, so a proposal can be argued with", async () => {
    const root = project({ ".windsurfrules": "rules" });
    const w = (await detectAll(root)).find((d) => d.id === "windsurf");
    expect(w?.present).toBe(true);
    expect(w?.evidence).toContain(".windsurfrules");
    after();
  });

  it("never writes anything while detecting", async () => {
    const root = project({ "package.json": "{}" });
    await detectAll(root);
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(root)).toEqual(["package.json"]);
    after();
  });
});

describe("installing is idempotent and never destructive", () => {
  const f = (path: string, content: string): PlannedFile => ({ path, content });

  it("writes a file that is not there", () => {
    const out = reconcile([f("AGENTS.md", "body")], () => null);
    expect(out).toEqual([{ path: "AGENTS.md", action: "WRITE", content: "body" }]);
  });

  it("leaves a file that already matches", () => {
    const out = reconcile([f("AGENTS.md", "body")], () => "body");
    expect(out[0]?.action).toBe("UNCHANGED");
  });

  it("reports a conflict rather than overwriting somebody's own file", () => {
    const out = reconcile([f("AGENTS.md", "ours")], () => "their hand-written notes");
    expect(out[0]?.action).toBe("CONFLICT");
    expect(out[0]?.existing).toBe("their hand-written notes");
  });

  it("shows what differs, so a conflict can be resolved by a person", () => {
    const out = reconcile([f("AGENTS.md", "a\nb\nc")], () => "a\nx\nc");
    const diff = out[0]?.diff ?? [];
    expect(diff).toContain("- x");   // what is there now, and would be lost
    expect(diff).toContain("+ b");   // what MICHI would have put
    expect(diff).toContain("  a");   // enough context to place it
  });

  it("never plans a delete or a move — there is no such action", () => {
    const actions = new Set(reconcile(
      [f("a", "1"), f("b", "2"), f("c", "3")],
      (p) => (p === "a" ? "1" : p === "b" ? "different" : null),
    ).map((o) => o.action));
    expect(actions).toEqual(new Set(["UNCHANGED", "CONFLICT", "WRITE"]));
  });
});

describe("the editors that arrived after AGENTS.md became the standard", () => {
  const skills = loadSkills();
  const paths = (id: string) =>
    adapterFor(id).installPlan({ projectRoot: "/p", projectName: "shop", skills })
      .files.map((f) => f.path);

  it("writes where each one actually reads", () => {
    expect(paths("antigravity")).toContain(".agents/rules/michi.md");
    expect(paths("junie")).toContain(".junie/AGENTS.md");
    expect(paths("trae")).toContain(".trae/rules/project_rules.md");
  });

  it("leaves Zed and Kiro on the baseline, because that is what they read", () => {
    // Zed takes AGENTS.md as its primary instructions file, and Kiro picks up
    // a root AGENTS.md automatically. An extra file would be noise.
    expect(paths("zed")).toEqual(["AGENTS.md"]);
    expect(paths("kiro")).toEqual(["AGENTS.md"]);
  });

  it("detects each one from something the editor itself creates", async () => {
    for (const [id, marker] of [
      ["antigravity", ".antigravity/config.json"],
      ["zed", ".zed/settings.json"],
      ["junie", ".junie/guidelines.md"],
      ["kiro", ".kiro/steering/x.md"],
      ["trae", ".trae/rules/project_rules.md"],
    ] as const) {
      const root = project({ [marker]: "x" });
      const found = (await detectAll(root)).find((d) => d.id === id);
      expect(found?.present, id).toBe(true);
      expect(found?.evidence.length, id).toBeGreaterThan(0);
      after();
    }
  });

  it("says it does not know, where the convention is not documented", () => {
    // Trae's rules path comes from community tooling, not from Trae's own
    // documentation. Saying so beats quietly implying it was verified (P9).
    const plan = adapterFor("trae").installPlan({ projectRoot: "/p", projectName: "shop", skills });
    expect(plan.notes.join(" ").toLowerCase()).toMatch(/not.*documented|community|could not confirm/);
  });

  it("still writes the baseline for every one of them", () => {
    for (const id of ["antigravity", "zed", "junie", "kiro", "trae"]) {
      expect(paths(id), id).toContain("AGENTS.md");
    }
  });
});
