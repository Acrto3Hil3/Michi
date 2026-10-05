import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-06T10:00:00.000Z");
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
  const p = join(root, `k${f++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed"],
});

async function project(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-ctx-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  await ok(["init"], root);
  await ok(["discover", "start"], root);
  await ok(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("See current stock"), draft("Warn before running out")],
  })], root);
  await ok(["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" }, confirm_intent: { by: "user" },
  })], root);
  await ok(["discover", "close"], root);
  await ok(["plan", "update", "--file", file(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    use_cases: [{ title: "Notice a product running low", persona: "PER-001",
                  trigger: "Stock falls low.", steps: ["a warning appears"],
                  requirements: ["REQ-001", "REQ-002"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "the point" },
            { requirement: "REQ-002", scope: "MVP", reason: "asked for" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "The count is visible." },
               { requirement: "REQ-002", kind: "GWT", given: ["stock is low"], when: "the owner opens the app", then: ["a warning shows"] }],
  })], root);
  await ok(["plan", "update", "--file", file(root, {
    confirm: { scope: ["REQ-001", "REQ-002"], by: "user" }, confirm_specification: { by: "user" },
  })], root);
  await ok(["plan", "close"], root);
  await ok(["decide", "propose", "--file", file(root, {
    title: "How the warning reaches the owner", type: "engineering", category: "notifications",
    options: [{ key: "email", label: "An email", explanation: "Arrives anyway.", tradeoffs: "Costs a little." },
              { key: "in_app", label: "In the app", explanation: "Seen on opening.", tradeoffs: "Missed if unopened." }],
    affects_requirements: ["REQ-002"],
  })], root);
  await ok(["decide", "confirm", "D001", "--choice", "email", "--by", "user",
    "--rationale", "The owner is on the shop floor.",
    "--adr", file(root, "The owner opens the app when already thinking about stock.")], root);
  return root;
}

describe("michi context — cli", () => {
  it("exits 3 before init", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-ctx-"));
    made.push(root);
    expect((await cli(["context", "REQ-001"], root)).code).toBe(3);
  });

  it("exits 2 with no focus given", async () => {
    expect((await cli(["context"], await project())).code).toBe(2);
  });

  it("exits 8 for a requirement that does not exist", async () => {
    expect((await cli(["context", "REQ-999"], await project())).code).toBe(8);
  });

  it("exits 4 for an id that is not a requirement", async () => {
    expect((await cli(["context", "nonsense"], await project())).code).toBe(4);
  });

  it("shows what is in the packet and why, in human output", async () => {
    const root = await project();
    const r = await ok(["context", "REQ-002"], root);
    expect(r.out).toMatch(/REQ-002/);
    expect(r.out).toMatch(/D001/);
    expect(r.out).toMatch(/governs REQ-002/);
    expect(r.out).toMatch(/ADR-001/);
    expect(r.out.toLowerCase()).toMatch(/estimated/);
    expect(r.out).toMatch(/chars\/4/);
  });

  it("names what it left out", async () => {
    const root = await project();
    const r = await ok(["context", "REQ-002", "--explain"], root);
    expect(r.out.toLowerCase()).toMatch(/left out|excluded/);
    expect(r.out).toMatch(/AC-001/);
  });

  it("produces a stable JSON contract and an identical hash on repeat", async () => {
    const root = await project();
    const a = await ok(["context", "REQ-002", "--json"], root);
    const b = await ok(["context", "REQ-002", "--json"], root);
    expect(json(a).data.context_hash).toBe(json(b).data.context_hash);
    expect(Object.keys(json(a).data).sort()).toEqual([
      "budget_tokens", "context_hash", "dropped_for_budget", "estimated_tokens",
      "estimation_method", "excluded", "focus", "generated_at", "input_hash",
      "items", "packet_id", "project", "revisions", "state_hash", "warnings",
    ]);
  });

  it("honours --budget and exits 5 when the required context will not fit", async () => {
    const root = await project();
    const full = json(await ok(["context", "REQ-002", "--json"], root)).data;
    const required = full.items.filter((i: { tier: string }) => i.tier === "MUST_INCLUDE")
      .reduce((sum: number, i: { estimated_tokens: number }) => sum + i.estimated_tokens, 0);

    const fits = await ok(["context", "REQ-002", "--budget", String(required), "--json"], root);
    expect(json(fits).data.estimated_tokens).toBeLessThanOrEqual(required);

    const r = await cli(["context", "REQ-002", "--budget", "5"], root);
    expect(r.code).toBe(5);
    expect(r.err.toLowerCase()).toMatch(/too large|split/);
  });

  it("honours --exclude", async () => {
    const root = await project();
    const r = await ok(["context", "REQ-002", "--exclude", "UC-001", "--json"], root);
    expect(json(r).data.items.map((i: { id: string }) => i.id)).not.toContain("UC-001");
  });
});

describe("michi graph — cli", () => {
  it("prints the graph around a node", async () => {
    const root = await project();
    const r = await ok(["graph", "REQ-002"], root);
    expect(r.out).toMatch(/REQ-002/);
    expect(r.out).toMatch(/D001/);
    expect(r.out).toMatch(/AC-002/);
  });

  it("prints the whole graph with no node given", async () => {
    const r = await ok(["graph"], await project());
    expect(r.out).toMatch(/REQ-001/);
    expect(r.out).toMatch(/PER-001/);
  });

  it("emits json and mermaid", async () => {
    const root = await project();
    const j = await ok(["graph", "--format", "json"], root);
    expect(JSON.parse(j.out).nodes.length).toBeGreaterThan(4);
    const m = await ok(["graph", "--format", "mermaid"], root);
    expect(m.out).toMatch(/graph |flowchart /);
    expect(m.out).toMatch(/REQ-002/);
  });

  it("reports requirements nobody has decided how to build", async () => {
    const root = await project();
    const r = await ok(["graph", "orphans"], root);
    expect(r.out).toMatch(/REQ-001/);
    expect(r.out).not.toMatch(/REQ-002\b.*no decided/);
  });

  it("reports requirements with no acceptance criterion", async () => {
    const r = await ok(["graph", "coverage"], await project());
    expect(r.code).toBe(0);
    expect(r.out.toLowerCase()).toMatch(/every|all|none/);
  });

  it("is deterministic", async () => {
    const root = await project();
    const a = await ok(["graph", "--format", "json"], root);
    const b = await ok(["graph", "--format", "json"], root);
    expect(a.out).toBe(b.out);
  });
});
