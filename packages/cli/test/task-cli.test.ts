import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-07T10:00:00.000Z");
const now = () => new Date(BASE + t++ * 60_000).toISOString();

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
  const p = join(root, `w${f++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed"],
});

async function architected(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-task-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  await ok(["init"], root);
  await ok(["discover", "start"], root);
  await ok(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "Retailers lose track of stock.", confidence: "STATED" },
              goal: { value: "Trust the counts.", confidence: "STATED" },
              constraints: { value: ["One shop"], confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("See current stock")],
  })], root);
  await ok(["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" }, confirm_intent: { by: "user" },
  })], root);
  await ok(["discover", "close"], root);
  await ok(["plan", "update", "--file", file(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "the point" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-002", kind: "PLAIN", text: "The count is visible." }],
  })], root);
  await ok(["plan", "update", "--file", file(root, {
    confirm: { scope: ["REQ-001", "REQ-002"], by: "user" }, confirm_specification: { by: "user" },
  })], root);
  await ok(["plan", "close"], root);
  await ok(["decide", "propose", "--file", file(root, {
    title: "Where the stock information is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A relational database", explanation: "Linked tables.", tradeoffs: "One more thing to run." },
              { key: "b", label: "A single file", explanation: "One file.", tradeoffs: "Concurrent edits lost." }],
    affects_requirements: ["REQ-001", "REQ-002"],
  })], root);
  await ok(["decide", "confirm", "D001", "--choice", "a", "--by", "user",
    "--rationale", "Two people record movements at once.",
    "--adr", file(root, "A file loses one of their edits silently.")], root);
  await ok(["architecture", "close"], root);
  return root;
}

describe("michi plan tasks — cli", () => {
  it("exits 5 before the architecture is agreed", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-task-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"a"}', "utf8");
    await ok(["init"], root);
    const r = await cli(["plan", "tasks", "--from-requirements"], root);
    expect(r.code).toBe(5);
  });

  it("seeds the work and reports it", async () => {
    const root = await architected();
    const r = await ok(["plan", "tasks", "--from-requirements"], root);
    expect(r.out).toMatch(/TASK-001/);
    expect(r.out).toMatch(/TASK-002/);
    expect(json(await ok(["status", "--json"], root)).data.stage).toBe("PLANNING");
  });

  it("validates the plan and says what is wrong", async () => {
    const root = await architected();
    await ok(["plan", "tasks", "--file", file(root, {
      tasks: [{ title: "Only one", description: "d", requirements: ["REQ-001"],
                acceptance_criteria: [{ id: "AC-001", text: "x" }], scope: { in: ["a"], out: [] } }],
    })], root);
    const r = await cli(["plan", "validate"], root);
    expect(r.code).toBe(7);
    expect(r.err + r.out).toMatch(/REQ-002/);
  });

  it("passes validation once everything is planned", async () => {
    const root = await architected();
    await ok(["plan", "tasks", "--from-requirements"], root);
    const r = await ok(["plan", "validate"], root);
    expect(r.out.toLowerCase()).toMatch(/can be executed|no problems|ready/);
  });
});

describe("michi task — cli", () => {
  async function planned(): Promise<string> {
    const root = await architected();
    await ok(["plan", "tasks", "--from-requirements"], root);
    return root;
  }

  it("lists tasks with their state", async () => {
    const r = await ok(["task", "list"], await planned());
    expect(r.out).toMatch(/TASK-001/);
    expect(r.out).toMatch(/READY/);
  });

  it("exits 8 for a task that does not exist", async () => {
    expect((await cli(["task", "show", "TASK-404"], await planned())).code).toBe(8);
  });

  it("names the next piece of work", async () => {
    const r = await ok(["task", "next"], await planned());
    expect(r.out).toMatch(/TASK-001/);
  });

  it("hands a task over and prints the instruction", async () => {
    const root = await planned();
    const r = await ok(["task", "start", "TASK-001", "--agent", "claude-code"], root);
    expect(r.out).toMatch(/## ROLE/);
    expect(r.out).toMatch(/## ACCEPTANCE CRITERIA/);
    expect(r.out).toMatch(/## STOP CONDITIONS/);
    expect(r.out).toMatch(/REQ-001/);
    expect(r.out).toMatch(/A relational database/);
    expect(existsSync(join(root, ".michi/sessions/RUN-0001.yaml"))).toBe(true);
    expect(json(await ok(["task", "show", "TASK-001", "--json"], root)).data.task.status).toBe("RUNNING");
  });

  it("exits 7 handing over a task that is not ready", async () => {
    const root = await architected();
    await ok(["plan", "tasks", "--file", file(root, {
      tasks: [
        { title: "First", description: "d", requirements: ["REQ-001"],
          acceptance_criteria: [{ id: "AC-001", text: "x" }], scope: { in: ["a"], out: [] } },
        { title: "Second", description: "d", requirements: ["REQ-002"], depends_on: [1],
          acceptance_criteria: [{ id: "AC-002", text: "x" }], scope: { in: ["a"], out: [] } },
      ],
    })], root);
    const r = await cli(["task", "start", "TASK-002", "--agent", "claude-code"], root);
    expect(r.code).toBe(7);
    expect(r.err).toMatch(/TASK-001/);
  });

  it("records the agent's report as a claim", async () => {
    const root = await planned();
    await ok(["task", "start", "TASK-001", "--agent", "claude-code"], root);
    const r = await ok(["task", "report", "TASK-001", "--from", file(root, {
      result: "REPORTED", files_touched: ["src/products.ts"],
      tests: { run: 3, passed: 3, failed: 0 }, notes: "Added the table.",
    })], root);
    expect(r.out).toMatch(/CHANGES_DETECTED/);
    expect(r.out.toLowerCase()).toMatch(/not verified|claim|evidence/);
    const shown = json(await ok(["task", "show", "TASK-001", "--json"], root)).data;
    expect(shown.task.verification.status).toBe("PENDING");
  });

  it("blocks a task with a reason", async () => {
    const root = await planned();
    const r = await ok(["task", "block", "TASK-001", "--reason", "Needs a provider account."], root);
    expect(r.out).toMatch(/BLOCKED/);
    expect(json(await ok(["task", "next", "--json"], root)).data.task.task_id).toBe("TASK-002");
  });

  it("produces a stable JSON contract", async () => {
    const root = await planned();
    const a = await ok(["task", "list", "--json"], root);
    const b = await ok(["task", "list", "--json"], root);
    expect(a.out).toBe(b.out);
    expect(Object.keys(json(a).data).sort()).toEqual(["by_status", "tasks"]);
  });

  it("exits 2 when start has no --agent", async () => {
    expect((await cli(["task", "start", "TASK-001"], await planned())).code).toBe(2);
  });
});
