import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  michi, isSetUp, statusBarText, agentChoices, agentDetail,
} from "../src/cli.js";
import type { Exec, AgentRow } from "../src/cli.js";

const made: string[] = [];
const temp = () => { const d = mkdtempSync(join(tmpdir(), "michi-vsc-")); made.push(d); return d; };
const cleanup = () => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } };

const fake = (out: { stdout?: string; stderr?: string; code?: number }): Exec =>
  async () => ({ stdout: out.stdout ?? "", stderr: out.stderr ?? "", code: out.code ?? 0 });

describe("talking to the CLI", () => {
  it("always asks for --json, because that is the stable contract", async () => {
    const seen: string[][] = [];
    const spy: Exec = async (_f, args) => { seen.push(args); return { stdout: '{"ok":true,"data":{}}', stderr: "", code: 0 }; };
    await michi(spy, { command: "michi", args: [] }, "/p", ["status"]);
    expect(seen[0]).toEqual(["status", "--json"]);
  });

  it("reads the data out of a successful envelope", async () => {
    const r = await michi<{ stage: string }>(
      fake({ stdout: '{"ok":true,"data":{"stage":"DISCOVERY"}}' }), { command: "michi", args: [] }, "/p", ["status"]);
    expect(r.ok).toBe(true);
    expect(r.data?.stage).toBe("DISCOVERY");
  });

  it("passes the CLI's own words through on failure, rather than inventing its own", async () => {
    // The CLI already writes plain-language errors with a next step. An
    // extension that replaced them with "Something went wrong" would be
    // throwing away the better message.
    const r = await michi(fake({
      stdout: '{"ok":false,"error":{"code":"BLOCKED","message":"Nobody has confirmed REQ-001.","next":"Ask the user."}}',
      code: 5,
    }), { command: "michi", args: [] }, "/p", ["plan", "close"]);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Nobody has confirmed REQ-001.");
    expect(r.next).toBe("Ask the user.");
  });

  it("recognises a missing binary and says how to get it", async () => {
    const r = await michi(fake({ stderr: "command not found: michi", code: 127 }), { command: "michi", args: [] }, "/p", ["status"]);
    expect(r.missing).toBe(true);
    expect(r.next).toMatch(/npm install -g @dev-subhash\/michi/);
  });

  it("survives an exec that throws", async () => {
    const r = await michi(async () => { throw new Error("ENOENT"); }, { command: "michi", args: [] }, "/p", ["status"]);
    expect(r.missing).toBe(true);
  });

  it("does not pretend output it cannot parse is a user error", async () => {
    const r = await michi(fake({ stdout: "not json at all" }), { command: "michi", args: [] }, "/p", ["status"]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/did not return JSON/);
  });
});

describe("knowing whether a project has MICHI", () => {
  it("looks for the config, not just the folder", () => {
    const root = temp();
    expect(isSetUp(root)).toBe(false);
    mkdirSync(join(root, ".michi"), { recursive: true });
    expect(isSetUp(root), "an empty .michi is not a set-up project").toBe(false);
    writeFileSync(join(root, ".michi", "config.yaml"), "x", "utf8");
    expect(isSetUp(root)).toBe(true);
    cleanup();
  });
});

describe("the status bar", () => {
  it("leads with what needs the user, because that is the whole point", () => {
    expect(statusBarText({ project: { name: "p" }, stage: "ARCHITECTURE", needs_you: ["a", "b"] }))
      .toMatch(/2 need you/);
    expect(statusBarText({ project: { name: "p" }, stage: "ARCHITECTURE", needs_you: ["a"] }))
      .toMatch(/1 needs you/);
  });

  it("falls back to the stage when nothing is waiting", () => {
    expect(statusBarText({ project: { name: "p" }, stage: "IMPLEMENTATION", needs_you: [] }))
      .toMatch(/implementation/);
  });

  it("says nothing confident when it has no status", () => {
    expect(statusBarText(undefined)).toMatch(/MICHI/);
  });
});

describe("choosing an agent", () => {
  const rows: AgentRow[] = [
    { id: "manual", name: "No adapter", present: true, evidence: ["always"], writes: ["AGENTS.md"], runs_commands: null },
    { id: "zed", name: "Zed", present: false, evidence: [], writes: ["AGENTS.md"], runs_commands: true },
    { id: "cursor", name: "Cursor", present: true, evidence: [".cursor"], writes: ["AGENTS.md", ".cursor/rules/michi.mdc"], runs_commands: true },
  ];

  it("puts what was actually found first", () => {
    expect(agentChoices(rows)[0]?.id).toBe("cursor");
  });

  it("still offers every one — detection proposes, the user decides", () => {
    expect(agentChoices(rows).map((a) => a.id).sort()).toEqual(["cursor", "manual", "zed"]);
  });

  it("keeps manual last without hiding it", () => {
    expect(agentChoices(rows).at(-1)?.id).toBe("manual");
  });

  it("shows what was seen and what would be written", () => {
    const detail = agentDetail(rows[2] as AgentRow);
    expect(detail).toMatch(/found: \.cursor/);
    expect(detail).toMatch(/writes 2 files/);
  });

  it("repeats MICHI's own uncertainty rather than smoothing it over", () => {
    expect(agentDetail(rows[0] as AgentRow)).toMatch(/cannot tell/);
  });
});

describe("the extension stays a thin client", () => {
  const source = () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { fileURLToPath } = require("node:url") as typeof import("node:url");
    return readFileSync(fileURLToPath(new URL("../src/extension.ts", import.meta.url)), "utf8");
  };

  it("knows no agent's name — it asks the CLI", () => {
    // The same boundary the rest of MICHI holds: agent names live in
    // packages/adapters and nowhere else. The extension learns them at
    // runtime from `michi agents --json`.
    for (const name of ["claude-code", "cursor", "codex", "windsurf", "cline",
                        "antigravity", "junie", "kiro"]) {
      expect(source(), `extension.ts hardcodes "${name}"`)
        .not.toMatch(new RegExp(`["'\`]${name}["'\`]`));
    }
  });

  it("writes nothing without an explicit yes", () => {
    const body = source();
    // Every call that changes the project is preceded by a modal.
    expect(body).toMatch(/modal: true/);
    expect(body).toMatch(/"Set it up"/);
    expect(body).toMatch(/"Write them"/);
    expect(body).toMatch(/Never for this project/);
  });

  it("shows the files before writing them", () => {
    expect(source()).toMatch(/--dry-run/);
  });

  it("passes the CLI's own message through rather than inventing one", () => {
    expect(source()).toMatch(/result\.message/);
    expect(source()).toMatch(/result\.next/);
  });

  it("reimplements no engine — every answer comes from a michi command", () => {
    const body = source();
    // Watching .michi/state/state.yaml is a path, not parsing. What must not
    // appear is a parser, or any reading of project state by hand.
    expect(body).not.toMatch(/from "yaml"|require\("yaml"\)|JSON\.parse\(read/);
    expect(body).not.toMatch(/readFileSync|readFile\(/);
    expect(body).not.toMatch(/@subhashyadav98146\/michi-core/);
  });
});

describe("michi --version", () => {
  it("is read as a bare string, because it is not an envelope", async () => {
    // Running it through the JSON parser would report a perfectly good CLI as
    // broken, which is the opposite of what a version check is for.
    const r = await michi<string>(fake({ stdout: "0.2.0\n" }), { command: "michi", args: [] }, "/p", ["--version"]);
    expect(r.ok).toBe(true);
    expect(r.data).toBe("0.2.0");
  });

  it("still reports a CLI that prints nothing", async () => {
    const r = await michi<string>(fake({ stdout: "" }), { command: "michi", args: [] }, "/p", ["--version"]);
    expect(r.ok).toBe(false);
  });
});
