import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let tick = 0;
const now = () => `2026-10-01T11:${String(tick++).padStart(2, "0")}:00.000Z`;

async function cli(args: string[], root: string) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  return { code, out, err };
}
const json = (c: { out: string }) => JSON.parse(c.out);

let f = 0;
function file(root: string, data: unknown): string {
  const p = join(root, `f${f++}.json`);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data), "utf8");
  return p;
}

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

/** A project through discovery with two confirmed requirements. */
async function specified(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-plan-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"shop"}', "utf8");
  await cli(["init"], root);
  await cli(["discover", "start"], root);
  await cli(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("See current stock")],
  })], root);
  await cli(["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" },
    confirm_intent: { by: "user" },
  })], root);
  await cli(["discover", "close"], root);
  return root;
}

describe("michi plan — cli", () => {
  it("exits 3 before init", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-plan-"));
    made.push(root);
    expect((await cli(["plan"], root)).code).toBe(3);
  });

  it("exits 5 when there is nothing to plan yet", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-plan-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"a"}', "utf8");
    await cli(["init"], root);
    const r = await cli(["plan"], root);
    expect(r.code).toBe(5);
    expect(r.err).toMatch(/discover/);
  });

  it("bare `plan` shows status", async () => {
    const root = await specified();
    const r = await cli(["plan"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/REQ-001/);
    expect(r.out.toLowerCase()).toMatch(/not placed|unknown/);
  });

  it("exits 2 when update has no --file", async () => {
    expect((await cli(["plan", "update"], await specified())).code).toBe(2);
  });

  it("exits 4 confirming scope with nobody named", async () => {
    const root = await specified();
    await cli(["plan", "update", "--file", file(root, {
      scope: [{ requirement: "REQ-001", scope: "MVP", reason: "needed" }],
    })], root);
    const r = await cli(["plan", "update", "--file", file(root, { confirm: { scope: ["REQ-001"] } }), "--json"], root);
    expect(r.code).toBe(4);
    expect(json(r).error.message.toLowerCase()).toMatch(/by/);
  });

  it("exits 8 for a criterion naming a requirement that does not exist", async () => {
    const root = await specified();
    const r = await cli(["plan", "update", "--file", file(root, {
      criteria: [{ requirement: "REQ-404", kind: "PLAIN", text: "t" }],
    })], root);
    expect(r.code).toBe(8);
  });

  it("exits 7 closing an unconfirmed specification", async () => {
    const root = await specified();
    const r = await cli(["plan", "close"], root);
    expect(r.code).toBe(7);
  });

  it("produces a stable JSON contract", async () => {
    const root = await specified();
    const a = await cli(["plan", "export", "--json"], root);
    const b = await cli(["plan", "export", "--json"], root);
    expect(a.out).toBe(b.out);
    expect(Object.keys(json(a).data).sort()).toEqual([
      "by_scope", "gaps", "next_step", "requirements", "specification", "unplaced",
    ]);
  });

  it("walks the whole way to a published PRD", async () => {
    const root = await specified();
    await cli(["plan", "update", "--file", file(root, {
      personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    })], root);
    await cli(["plan", "update", "--file", file(root, {
      scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without products" },
              { requirement: "REQ-002", scope: "MVP", reason: "the whole point" }],
      criteria: [{ requirement: "REQ-001", kind: "GWT", given: ["no products exist"],
                   when: "the owner adds one", then: ["it appears in the product list"] },
                 { requirement: "REQ-002", kind: "GWT", given: ["a product has 5 units"],
                   when: "the owner opens the stock list", then: ["it shows 5"] }],
      out_of_scope: [{ title: "Accounting", reason: "They already use an accountant." }],
    })], root);
    const confirmed = await cli(["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-001", "REQ-002"], by: "user" },
    })], root);
    expect(confirmed.code).toBe(0);

    const beforeSignoff = await cli(["plan", "status"], root);
    expect(beforeSignoff.out.toLowerCase()).toMatch(/confirm/);

    await cli(["plan", "update", "--file", file(root, { confirm_specification: { by: "user" } })], root);
    const closed = await cli(["plan", "close"], root);
    expect(closed.code).toBe(0);
    expect(closed.out).toMatch(/PRD\.md/);
    expect(closed.out).toMatch(/ARCHITECTURE/);
    expect(existsSync(join(root, ".michi/requirements/PRD.md"))).toBe(true);

    const status = await cli(["status", "--json"], root);
    expect(json(status).data.stage).toBe("ARCHITECTURE");
  });
});
