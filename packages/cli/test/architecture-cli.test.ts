import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-05T10:00:00.000Z");
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
const file = (root: string, data: unknown): string => {
  const p = join(root, `c${f++}.json`);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data), "utf8");
  return p;
};
const md = (root: string, text: string): string => {
  const p = join(root, `c${f++}.md`);
  writeFileSync(p, text, "utf8");
  return p;
};

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

async function specified(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-arch-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"shop"}', "utf8");
  await ok(["init"], root);
  await ok(["discover", "start"], root);
  await ok(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "Retailers lose track of stock.", confidence: "STATED" },
              goal: { value: "See and correct stock.", confidence: "STATED" },
              constraints: { value: ["One shop", "No paid services yet"], confidence: "STATED" } },
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
  return root;
}

async function lockDecision(root: string, id: string, title: string, category: string, reqs: string[]) {
  await ok(["decide", "propose", "--file", file(root, {
    title, type: "engineering", category,
    options: [{ key: "chosen", label: "A relational database", explanation: "Linked tables.", tradeoffs: "One more thing to run." },
              { key: "other", label: "A single file", explanation: "One file you could open.", tradeoffs: "Concurrent edits are lost." }],
    affects_requirements: reqs,
  })], root);
  await ok(["decide", "confirm", id, "--choice", "chosen", "--by", "user",
    "--rationale", "Two people record movements at once.",
    "--adr", md(root, "Because concurrent edits are the failure they would trust least.")], root);
}

describe("michi architecture — cli", () => {
  it("exits 3 before init", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-arch-"));
    made.push(root);
    expect((await cli(["architecture"], root)).code).toBe(3);
  });

  it("exits 5 before a specification is published", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-arch-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"a"}', "utf8");
    await ok(["init"], root);
    const r = await cli(["architecture"], root);
    expect(r.code).toBe(5);
    expect(r.err).toMatch(/discover|plan/);
  });

  it("bare `architecture` shows status and names what is undecided", async () => {
    const root = await specified();
    const r = await cli(["architecture"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/REQ-001/);
    expect(r.out.toLowerCase()).toMatch(/no decided approach|undecided|nothing decided/);
  });

  it("exits 7 closing while a requirement has no decided approach", async () => {
    const root = await specified();
    await lockDecision(root, "D001", "Where stock is kept", "database", ["REQ-001"]);
    const r = await cli(["architecture", "close", "--json"], root);
    expect(r.code).toBe(7);
    expect(JSON.stringify(json(r).error.detail)).toMatch(/REQ-002/);
  });

  it("exits 8 proposing a decision for a requirement that does not exist", async () => {
    const root = await specified();
    const r = await cli(["decide", "propose", "--file", file(root, {
      title: "Something", type: "engineering", category: "database",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: ["REQ-999"],
    })], root);
    expect(r.code).toBe(8);
  });

  it("closes, writes both documents, and moves the project to DESIGN", async () => {
    const root = await specified();
    await lockDecision(root, "D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]);
    const r = await ok(["architecture", "close"], root);
    expect(r.out).toMatch(/SYSTEM\.md/);
    expect(r.out).toMatch(/TRD\.md/);
    expect(r.out).toMatch(/DESIGN/);
    expect(existsSync(join(root, ".michi/architecture/SYSTEM.md"))).toBe(true);
    expect(existsSync(join(root, ".michi/requirements/TRD.md"))).toBe(true);
    expect(json(await ok(["status", "--json"], root)).data.stage).toBe("DESIGN");
  });

  it("produces a stable JSON contract", async () => {
    const root = await specified();
    const a = await ok(["architecture", "export", "--json"], root);
    const b = await ok(["architecture", "export", "--json"], root);
    expect(a.out).toBe(b.out);
    expect(Object.keys(json(a).data).sort()).toEqual([
      "decided", "governing", "locked_decisions", "needs_review", "next_step",
      "open_decisions", "status", "undecided",
    ]);
  });

  it("flags the architecture when the specification is republished under it", async () => {
    const root = await specified();
    await lockDecision(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    await ok(["architecture", "close"], root);

    await ok(["plan", "update", "--file", file(root, {
      revision: { reason: "The owner decided the stock view can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    })], root);
    await ok(["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" },
    })], root);
    await ok(["plan", "close"], root);

    const s = json(await ok(["status", "--json"], root)).data;
    expect(s.needs_review).toContain("architecture");
    expect(s.architecture_status).toBe("LOCKED");

    const human = await ok(["architecture"], root);
    expect(human.out.toLowerCase()).toMatch(/changed|review|again/);

    // And the way out is to look at it and close again.
    await ok(["architecture", "close"], root);
    expect(json(await ok(["status", "--json"], root)).data.needs_review)
      .not.toContain("architecture");
  });

  it("the generated documents read as prose, not as a data dump", async () => {
    const root = await specified();
    await lockDecision(root, "D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]);
    await ok(["architecture", "close"], root);
    const system = readFileSync(join(root, ".michi/architecture/SYSTEM.md"), "utf8");
    expect(system).toMatch(/# How this is built/);
    expect(system).toContain("A relational database");
    expect(system).toContain("What was not chosen");
    expect(system).toContain("A single file");

    const trd = readFileSync(join(root, ".michi/requirements/TRD.md"), "utf8");
    expect(trd).toMatch(/## Database/);
    expect(trd).toContain("No paid services yet");
    expect(trd).toContain("ADR-001");
  });
});
