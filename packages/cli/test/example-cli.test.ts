import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-13T10:00:00.000Z");
const now = () => new Date(BASE + t++ * 1000).toISOString();

async function cli(args: string[], root: string) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  return { code, out, err };
}

async function started(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-ex-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"expenses"}', "utf8");
  await cli(["init"], root);
  await cli(["discover", "start"], root);
  return root;
}

describe("michi example", () => {
  it("lists what it has when asked for nothing", async () => {
    const r = await cli(["example"], await started());
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/discover-answer/);
    expect(r.out).toMatch(/decide-propose/);
  });

  it("prints a file that can be used as it stands", async () => {
    const root = await started();
    // --raw exists so this can be a redirect: michi example X --raw > f.json
    const json = (await cli(["example", "discover-answer", "--raw"], root)).out;
    writeFileSync(join(root, "e.json"), json, "utf8");
    const used = await cli(["discover", "answer", "--file", join(root, "e.json")], root);
    expect(used.code, used.err).toBe(0);
    expect(used.out).toMatch(/REQ-001/);
  });
});

describe("a schema error points at the example", () => {
  it("tells you where to get the whole shape instead of one field", async () => {
    const root = await started();
    writeFileSync(join(root, "bad.json"), JSON.stringify({
      intent: { problem: "a string where an object belongs" },
    }), "utf8");
    const r = await cli(["discover", "answer", "--file", join(root, "bad.json")], root);
    expect(r.code).toBe(4);
    expect(r.err).toMatch(/michi example discover-answer/);
  });

  it("does the same for every other file-taking command", async () => {
    const root = await started();
    writeFileSync(join(root, "bad.json"), "{}", "utf8");
    const bad = join(root, "bad.json");
    const r = await cli(["decide", "propose", "--file", bad], root);
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/michi example decide-propose/);
  });

  it("every example MICHI publishes is wired to the command it belongs to", async () => {
    // Driving each one through the CLI needs a different project state per
    // command — a task to report on, criteria to verify. The wiring itself is
    // what matters, and it is one call site per command.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      fileURLToPath(new URL("../src/run.ts", import.meta.url)), "utf8");
    const { exampleNames } = await import("@dev-subhash/michi-core");
    for (const name of exampleNames()) {
      expect(source, `no withExample(..., "${name}") in run.ts`)
        .toMatch(new RegExp(`withExample\\([\\s\\S]{0,200}?"${name}"`));
    }
  });

  it("leaves a more specific next alone rather than overwriting it", async () => {
    const root = await started();
    const r = await cli(["discover", "answer", "--file", join(root, "missing.json")], root);
    expect(r.code).toBe(8);                       // NOT_FOUND, not a schema problem
    expect(r.err).not.toMatch(/michi example/);   // the file does not exist; a shape hint is noise
  });
});
