import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-12T10:00:00.000Z");
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
const data = (c: { out: string }) => JSON.parse(c.out).data;

let f = 0;
const put = (root: string, body: unknown): string => {
  const p = join(root, `x${f++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};

async function project(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-explain-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"clinic"}', "utf8");
  await ok(["init"], root);
  await ok(["discover", "start"], root);
  await ok(["discover", "answer", "--file", put(root, {
    intent: { problem: { value: "Records get lost.", confidence: "STATED" },
              goal: { value: "Trust the records.", confidence: "STATED" } },
    requirements: [{ title: "Let people log in", description: "Staff sign in before seeing records.",
      type: "functional", priority: "high", origin_confidence: "STATED",
      acceptance_criteria: ["a member of staff can sign in"] }],
  })], root);
  await ok(["discover", "answer", "--file", put(root, {
    confirm: { requirements: ["REQ-001"], by: "dr-patel" }, confirm_intent: { by: "dr-patel" },
  })], root);
  await ok(["discover", "close"], root);
  await ok(["plan", "update", "--file", put(root, {
    personas: [{ name: "Receptionist", description: "Books patients in.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without it" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A member of staff can sign in." }],
  })], root);
  await ok(["plan", "update", "--file", put(root, {
    confirm: { scope: ["REQ-001"], by: "dr-patel" }, confirm_specification: { by: "dr-patel" },
  })], root);
  await ok(["plan", "close"], root);
  await ok(["decide", "propose", "--file", put(root, {
    title: "How people log in", type: "engineering", category: "auth",
    options: [{ key: "service", label: "A login service",
                explanation: "A specialist company handles passwords and we never store them.",
                tradeoffs: "A monthly cost." },
               { key: "ourselves", label: "Build it ourselves",
                explanation: "We store passwords.", tradeoffs: "We own password security." }],
    affects_requirements: ["REQ-001"],
  })], root);
  await ok(["decide", "confirm", "D001", "--choice", "service", "--by", "dr-patel",
    "--rationale", "The app handles medical records.", "--adr", put(root, "Chose a service.")], root);
  await ok(["architecture", "close"], root);
  await ok(["plan", "tasks", "--from-requirements"], root);
  return root;
}

describe("michi explain", () => {
  it("explains a decision in prose a non-coder can read", async () => {
    const r = await ok(["explain", "D001"], await project());
    expect(r.out).toContain("How people log in");
    expect(r.out).toContain("A login service");
    expect(r.out).toContain("dr-patel");
    expect(r.out).toContain("ADR-001");
  });

  it("takes an ADR id and explains the decision behind it", async () => {
    expect(data(await ok(["explain", "ADR-001", "--json"], await project())).id).toBe("D001");
  });

  it("explains a requirement, a task and a file kind", async () => {
    const root = await project();
    expect(data(await ok(["explain", "REQ-001", "--json"], root)).kind).toBe("REQUIREMENT");
    expect(data(await ok(["explain", "TASK-001", "--json"], root)).kind).toBe("TASK");
  });

  it("--simple prints no ids at all", async () => {
    const r = await ok(["explain", "D001", "--simple"], await project());
    expect(r.out).not.toMatch(/REQ-\d|ADR-\d|\bD001\b/);
    expect(r.out).toContain("A login service");
  });

  it("says it is not recorded rather than inventing an answer", async () => {
    const r = await cli(["explain", "AuthService"], await project());
    expect(r.code).toBe(8);   // NOT_FOUND
    expect(r.err.toLowerCase()).toMatch(/not recorded/);
    expect(r.err.toLowerCase()).toMatch(/never reconstructs/);
  });

  it("writes nothing", async () => {
    const root = await project();
    const before = data(await ok(["status", "--json"], root));
    await ok(["explain", "D001"], root);
    expect(data(await ok(["status", "--json"], root))).toEqual(before);
  });
});

describe("michi decide impact", () => {
  it("reports the blast radius from the graph", async () => {
    const r = await ok(["decide", "impact", "D001"], await project());
    expect(r.out).toContain("REQ-001");
    expect(r.out).toContain("TASK-001");
    expect(r.out.toLowerCase()).toMatch(/claim rather than something michi watched/);
  });

  it("says plainly when nothing depends on it", async () => {
    const root = await project();
    await ok(["decide", "propose", "--file", put(root, {
      title: "Where it runs", type: "engineering", category: "hosting",
      options: [{ key: "a", label: "A server", explanation: "One box.", tradeoffs: "You mind it." },
                 { key: "b", label: "A platform", explanation: "Managed.", tradeoffs: "Costs more." }],
      affects_requirements: [],
    })], root);
    const r = await ok(["decide", "impact", "D002"], root);
    expect(r.out.toLowerCase()).toMatch(/nothing depends on/);
  });

  it("refuses an id that is not a decision", async () => {
    const r = await cli(["decide", "impact", "REQ-001"], await project());
    expect(r.code).toBe(4);   // VALIDATION_ERROR
    expect(r.err).toMatch(/explain REQ-001/);
  });
});

describe("the impact count matches what it lists", () => {
  it("never lists the same id under two headings", async () => {
    const r = await ok(["decide", "impact", "D001"], await project());
    const ids = (r.out.match(/\b(?:REQ|TASK|D)-?\d{3,}\b/g) ?? [])
      .filter((id) => id !== "D001");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("states a total that equals the things it shows", async () => {
    const root = await project();
    const d = data(await ok(["decide", "impact", "D001", "--json"], root));
    expect(d.total).toBe(
      d.requirements.length + d.tasks.length + d.files.length + d.decisions.length,
    );
    // tasks_with_work is a subset of tasks, so it must not be counted again
    for (const id of d.tasks_with_work) expect(d.tasks).toContain(id);
  });
});
