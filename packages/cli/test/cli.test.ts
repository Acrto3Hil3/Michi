import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { run } from "../src/run.js";

const made: string[] = [];
function project(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "michi-cli-"));
  made.push(root);
  for (const [f, c] of Object.entries(files)) writeFileSync(join(root, f), c, "utf8");
  return root;
}
afterEach(() => {
  while (made.length) {
    const d = made.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

const NOW = "2026-09-28T12:00:00.000Z";

interface Capture {
  code: number;
  out: string;
  err: string;
}

async function cli(args: string[], root?: string): Promise<Capture> {
  let out = "";
  let err = "";
  const argv = root ? ["--project", root, ...args] : args;
  const code = await run(argv, {
    out: (s) => { out += s + "\n"; },
    err: (s) => { err += s + "\n"; },
  }, { now: () => NOW });
  return { code, out, err };
}

const json = (c: Capture) => JSON.parse(c.out);

describe("cli plumbing", () => {
  it("prints help and succeeds", async () => {
    const r = await cli(["--help"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/init/);
    expect(r.out).toMatch(/scan/);
    expect(r.out).toMatch(/status/);
  });

  it("rejects an unknown command with the usage exit code", async () => {
    const r = await cli(["frobnicate"]);
    expect(r.code).toBe(2);
  });

  it("never writes to stdout in --json mode except one JSON document", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    const r = await cli(["init", "--json"], root);
    expect(r.code).toBe(0);
    expect(() => JSON.parse(r.out)).not.toThrow();
    expect(json(r).ok).toBe(true);
  });
});

describe("michi init", () => {
  it("initializes a project and reports what it made", async () => {
    const root = project({ "package.json": '{"name":"pharmacy"}' });
    const r = await cli(["init"], root);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, ".michi"))).toBe(true);
    expect(r.out).toMatch(/pharmacy/);
  });

  it("refuses a second init with the conflict exit code", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    await cli(["init"], root);
    const r = await cli(["init", "--json"], root);
    expect(r.code).toBe(7);
    const payload = json(r);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("ALREADY_INITIALIZED");
    expect(payload.error.next).toMatch(/status/);
  });

  it("writes nothing under --dry-run", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    const r = await cli(["init", "--dry-run"], root);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, ".michi"))).toBe(false);
    expect(r.out).toMatch(/would/i);
  });
});

describe("michi status", () => {
  it("exits 3 before init and names the fix", async () => {
    const root = project();
    const r = await cli(["status"], root);
    expect(r.code).toBe(3);
    expect(r.err).toMatch(/michi init/);
  });

  it("reports the project's stage in plain language", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    await cli(["init"], root);
    const r = await cli(["status"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/DISCOVERY/);
    expect(r.out).toMatch(/Needs you/i);
  });

  it("produces a stable JSON contract", async () => {
    const root = project({ "package.json": '{"name":"a"}', "pnpm-lock.yaml": "" });
    await cli(["init"], root);
    const a = await cli(["status", "--json"], root);
    const b = await cli(["status", "--json"], root);
    expect(a.out).toBe(b.out);
    const d = json(a).data;
    expect(Object.keys(d).sort()).toEqual([
      "active_task", "architecture_status", "counts", "current_milestone",
      "detected", "discovery", "initialized", "last_scan", "needs_you",
      "project", "schema_version", "stage", "stage_entered_at",
    ]);
  });

  it("exits 4 on a corrupt state file", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    await cli(["init"], root);
    writeFileSync(join(root, ".michi/state/state.yaml"), "stage: NONSENSE\n");
    const r = await cli(["status"], root);
    expect(r.code).toBe(4);
  });
});

describe("michi scan", () => {
  it("exits 3 before init", async () => {
    const r = await cli(["scan"], project());
    expect(r.code).toBe(3);
  });

  it("reports detections honestly, including what it does not know", async () => {
    const root = project({ "package.json": '{"name":"a"}' });
    await cli(["init"], root);
    const r = await cli(["scan"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/not established|unknown/i);
  });

  it("is safe to repeat", async () => {
    const root = project({ "package.json": '{"name":"a"}', "pnpm-lock.yaml": "" });
    await cli(["init"], root);
    const a = await cli(["scan", "--json"], root);
    const b = await cli(["scan", "--json"], root);
    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    expect(json(b).data.changed).toBe(false);
    expect(json(a).data.hash).toBe(json(b).data.hash);
  });
});
