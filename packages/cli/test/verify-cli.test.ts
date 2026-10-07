import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-09T10:00:00.000Z");
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
const json = (c: { out: string }) => JSON.parse(c.out);

let f = 0;
const file = (root: string, body: unknown): string => {
  const p = join(root, `z${f++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};

/** A project with a reported task and a filled-in allow-list. */
async function reported(allow = "echo 3 passed"): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-ver-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  await ok(["init"], root);
  const cfg = join(root, ".michi/config.yaml");
  writeFileSync(cfg, readFileSync(cfg, "utf8").replace("allow: {}", `allow:\n    test: ${allow}`), "utf8");

  await ok(["discover", "start"], root);
  await ok(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [{ title: "Manage products", description: "Add and edit products.",
      type: "functional", priority: "high", origin_confidence: "STATED",
      acceptance_criteria: ["a product can be added"] }],
  })], root);
  await ok(["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001"], by: "user" }, confirm_intent: { by: "user" },
  })], root);
  await ok(["discover", "close"], root);
  await ok(["plan", "update", "--file", file(root, {
    personas: [{ name: "Owner", description: "Runs a shop.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." }],
  })], root);
  await ok(["plan", "update", "--file", file(root, {
    confirm: { scope: ["REQ-001"], by: "user" }, confirm_specification: { by: "user" },
  })], root);
  await ok(["plan", "close"], root);
  await ok(["decide", "propose", "--file", file(root, {
    title: "Where stock is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A database", explanation: "Tables.", tradeoffs: "One more thing." },
              { key: "b", label: "A file", explanation: "One file.", tradeoffs: "Lost edits." }],
    affects_requirements: ["REQ-001"],
  })], root);
  await ok(["decide", "confirm", "D001", "--choice", "a", "--by", "user",
    "--rationale", "Concurrent edits.", "--adr", file(root, "Reasoning.")], root);
  await ok(["architecture", "close"], root);
  await ok(["plan", "tasks", "--from-requirements"], root);
  await ok(["task", "start", "TASK-001", "--agent", "claude-code"], root);
  await ok(["task", "report", "TASK-001", "--from", file(root, {
    result: "REPORTED", files_touched: ["src/products.ts"], tests: { run: 3, passed: 3, failed: 0 },
  })], root);
  return root;
}

describe("michi test — cli", () => {
  it("runs an allow-listed command and shows what it observed", async () => {
    const root = await reported();
    const r = await ok(["test", "TASK-001", "--run", "test"], root);
    expect(r.out).toMatch(/3 passed/);
    expect(r.out.toLowerCase()).toMatch(/michi ran this|observed/);
    expect(r.out).toMatch(/exit 0|passed/i);
  });

  it("exits 6 for a key the user never authorised", async () => {
    const r = await cli(["test", "TASK-001", "--run", "deploy"], await reported());
    expect(r.code).toBe(6);
    expect(r.err).toMatch(/allow/);
  });

  it("shows a failing command as failing", async () => {
    const root = await reported("echo 1 failed; exit 1");
    const r = await ok(["test", "TASK-001", "--run", "test"], root);
    expect(r.out.toLowerCase()).toMatch(/failed|exit 1/);
  });

  it("exits 2 with neither --run nor --record", async () => {
    expect((await cli(["test", "TASK-001"], await reported())).code).toBe(2);
  });
});

describe("michi review — cli", () => {
  it("records a pass", async () => {
    const root = await reported();
    const r = await ok(["review", "TASK-001", "--verdict", "PASS",
      "--findings", file(root, { findings: [] })], root);
    expect(r.out).toMatch(/PASS/);
  });

  it("prints findings when changes are required", async () => {
    const root = await reported();
    const r = await ok(["review", "TASK-001", "--verdict", "CHANGES_REQUIRED",
      "--findings", file(root, { findings: [
        { file: "src/products.ts", line: 12, problem: "No validation on the name.",
          why: "An empty name would be stored.", fix: "Reject an empty name." },
      ]})], root);
    expect(r.out).toMatch(/src\/products\.ts:12/);
    expect(r.out).toMatch(/Reject an empty name/);
    expect(r.out).toMatch(/CHANGES_DETECTED/);
  });
});

describe("michi debug — cli", () => {
  it("exits 7 reaching the fix before reproducing", async () => {
    const r = await cli(["debug", "TASK-001", "--stage", "FIX", "--note", "Changed it."],
      await reported());
    expect(r.code).toBe(7);
    expect(r.err).toMatch(/reproduc/i);
  });

  it("walks the stages in order", async () => {
    const root = await reported();
    await ok(["debug", "TASK-001", "--stage", "REPRODUCE", "--note", "Empty name is stored."], root);
    const r = await ok(["debug", "TASK-001", "--stage", "ROOT_CAUSE", "--note", "Never checked."], root);
    expect(r.out).toMatch(/REPRODUCE/);
    expect(r.out).toMatch(/ROOT_CAUSE/);
  });
});

describe("michi verify — cli", () => {
  const verdict = (statuses: Record<string, string>) => ({
    criteria: Object.entries(statuses).map(([id, status]) => ({
      id, status, reason: "The tests cover it.", evidence: status === "SATISFIED" ? ["TESTS"] : [],
    })),
  });

  it("exits 5 when every piece of evidence came from the agent", async () => {
    const root = await reported();
    await ok(["test", "TASK-001", "--record", file(root, {
      kind: "TESTS", summary: "all green", passed: true,
    })], root);
    const r = await cli(["verify", "TASK-001", "--from", file(root, verdict({ "AC-001": "SATISFIED" }))], root);
    expect(r.code).toBe(5);
    expect(r.err.toLowerCase()).toMatch(/not observed|claim/);
  });

  it("verifies on observed evidence and reports what it rested on", async () => {
    const root = await reported();
    await ok(["test", "TASK-001", "--run", "test"], root);
    const r = await ok(["verify", "TASK-001", "--from", file(root, verdict({ "AC-001": "SATISFIED" }))], root);
    expect(r.out).toMatch(/VERIFIED/);
    expect(r.out.toLowerCase()).toMatch(/michi observed|rested on/);
    expect(json(await ok(["task", "show", "TASK-001", "--json"], root)).data.task.verification.status)
      .toBe("PASSED");
  });

  it("there is no override flag", async () => {
    const root = await reported();
    const r = await cli(["verify", "TASK-001", "--force", "--from", file(root, verdict({ "AC-001": "SATISFIED" }))], root);
    expect(r.code).toBe(2);
  });
});

describe("michi task done — cli", () => {
  it("refuses to close a task that has no verdict", async () => {
    const r = await cli(["task", "done", "TASK-001"], await reported());
    expect(r.code).toBe(5);   // BLOCKED — no evidence, no closing
    expect(r.err.toLowerCase()).toMatch(/verif/);
  });

  it("closes a verified task and says where it went", async () => {
    const root = await reported();
    await ok(["test", "TASK-001", "--run", "test"], root);
    await ok(["verify", "TASK-001", "--from", file(root, { criteria: [
      { id: "AC-001", status: "SATISFIED", reason: "The suite covers it.", evidence: ["TESTS"] },
    ]})], root);
    const r = await ok(["task", "done", "TASK-001"], root);
    expect(r.out).toMatch(/DONE/);
    expect(r.out).toMatch(/tasks\/completed/);
  });
});
