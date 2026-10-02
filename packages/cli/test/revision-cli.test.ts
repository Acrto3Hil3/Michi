import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-02T09:00:00.000Z");
const now = () => new Date(BASE + t++ * 60_000).toISOString();

async function cli(args: string[], root: string) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  return { code, out, err };
}
const json = (c: { out: string }) => JSON.parse(c.out);

let f = 0;
const file = (root: string, data: unknown): string => {
  const p = join(root, `v${f++}.json`);
  writeFileSync(p, JSON.stringify(data), "utf8");
  return p;
};

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

async function published(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-rev-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"shop"}', "utf8");
  const ok = async (args: string[]) => {
    const r = await cli(args, root);
    if (r.code !== 0) throw new Error(`${args.join(" ")} exited ${r.code}: ${r.err}${r.out}`);
    return r;
  };
  await ok(["init"]);
  await ok(["discover", "start"]);
  await ok(["discover", "answer", "--file", file(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("Warn before running out")],
  })]);
  await ok(["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" }, confirm_intent: { by: "user" },
  })]);
  await ok(["discover", "close"]);
  await ok(["plan", "update", "--file", file(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "FUTURE", reason: "later" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." }],
  })]);
  await ok(["plan", "update", "--file", file(root, {
    confirm: { scope: ["REQ-001", "REQ-002"], by: "user" }, confirm_specification: { by: "user" },
  })]);
  await ok(["plan", "close"]);
  return root;
}

const REASON = "The founder decided the warning matters more than they first thought.";

describe("revisions through the cli", () => {
  it("exits 7 changing a published specification with no revision", async () => {
    const root = await published();
    const r = await cli(["plan", "update", "--file", file(root, {
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    }), "--json"], root);
    expect(r.code).toBe(7);
    expect(json(r).error.next).toMatch(/revision/i);
  });

  it("exits 4 on a revision with nobody named", async () => {
    const root = await published();
    const r = await cli(["plan", "update", "--file", file(root, {
      revision: { reason: REASON },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    })], root);
    expect(r.code).toBe(4);
  });

  it("reports the revision it created", async () => {
    const root = await published();
    const r = await cli(["plan", "update", "--file", file(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    })], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/REV-001/);
    expect(r.out).toMatch(/REQ-002/);
    expect(r.out.toLowerCase()).toMatch(/sign.?off|confirm/);
  });

  it("reports the publication number and the revision it carried", async () => {
    const root = await published();
    await cli(["plan", "update", "--file", file(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
      criteria: [{ requirement: "REQ-002", kind: "PLAIN", text: "A warning appears." }],
    })], root);
    await cli(["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" },
    })], root);
    const r = await cli(["plan", "close"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/publication 2/i);
    expect(r.out).toMatch(/REV-001/);
  });

  it("shows removals as removals, not deletions", async () => {
    const root = await published();
    const r = await cli(["plan", "update", "--file", file(root, {
      revision: { reason: "That criterion described the wrong behaviour entirely.", by: "user" },
      remove: { criteria: ["AC-001"], by: "user", reason: "Described the wrong behaviour." },
    })], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/AC-001/);
    expect(r.out.toLowerCase()).toMatch(/removed|kept on the record/);
  });

  it("plan status names the revisions and flags the lost sign-off", async () => {
    const root = await published();
    await cli(["plan", "update", "--file", file(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    })], root);
    const r = await cli(["plan", "status"], root);
    expect(r.out).toMatch(/REV-001/);
    expect(r.out).toMatch(/DRAFT/);
  });
});

describe("project status reflects readiness", () => {
  it("says why the stage moved back and what needs review", async () => {
    const root = await published();
    expect(json(await cli(["status", "--json"], root)).data.stage).toBe("ARCHITECTURE");

    await cli(["discover", "start"], root);
    await cli(["discover", "answer", "--file", file(root, {
      requirements: [draft("Scan barcodes")],
    })], root);
    await cli(["discover", "answer", "--file", file(root, {
      confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" },
    })], root);
    await cli(["discover", "close"], root);

    const data = json(await cli(["status", "--json"], root)).data;
    expect(data.stage).toBe("SPECIFICATION");
    expect(data.stage_reason).toMatch(/requirement/i);
    expect(data.needs_review).toContain("specification");

    const human = await cli(["status"], root);
    expect(human.out).toMatch(/SPECIFICATION/);
    expect(human.out.toLowerCase()).toMatch(/needs review|no longer/);
    expect(human.out).toMatch(/Needs you/);
  });

  it("keeps the status JSON contract stable", async () => {
    const root = await published();
    const a = await cli(["status", "--json"], root);
    const b = await cli(["status", "--json"], root);
    expect(a.out).toBe(b.out);
    expect(Object.keys(json(a).data).sort()).toEqual([
      "active_task", "architecture_status", "counts", "current_milestone",
      "detected", "discovery", "initialized", "last_scan", "needs_review",
      "needs_you", "project", "schema_version", "stage", "stage_entered_at",
      "stage_reason",
    ]);
  });
});
