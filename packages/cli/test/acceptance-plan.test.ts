/**
 * Phase 3 acceptance.
 *
 * The same founder from the Phase 2 scenario, now being asked what to build
 * first. Everything below is what the product-planner skill would do: the
 * conversation happens in the agent, each turn lands as structure, and the
 * scope cut is the user's.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let tick = 0;
const now = () => `2026-10-01T12:${String(tick++).padStart(2, "0")}:00.000Z`;

async function michi(root: string, args: string[]) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  if (code !== 0) throw new Error(`michi ${args.join(" ")} exited ${code}\n${err}${out}`);
  return { out, err };
}

let f = 0;
const payload = (root: string, data: unknown): string => {
  const p = join(root, `pl${f++}.json`);
  writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  return p;
};
const plan = (root: string, update: object) =>
  michi(root, ["plan", "update", "--file", payload(root, update)]);

const REQS = [
  ["Manage products", "A store owner can add, edit and retire the products they stock."],
  ["See current stock", "Anyone signed in can see how many of each product is on hand."],
  ["Record stock coming in", "A delivery increases the recorded quantity."],
  ["Record stock going out", "A sale or write-off decreases the recorded quantity."],
  ["Warn before running out", "The owner is told when a product falls below a level they chose."],
] as const;

describe("what gets built first", () => {
  it("becomes a published PRD with the founder's own cut", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-a3-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");

    // ---- discovery, compressed: this is Phase 2's proven ground ----------
    await michi(root, ["init"]);
    await michi(root, ["discover", "start"]);
    await michi(root, ["discover", "answer", "--file", payload(root, {
      intent: {
        problem: { value: "Small retailers lose track of what is in stock and find out too late.", confidence: "STATED" },
        goal: { value: "Let a store owner see and correct stock, and be warned before running out.", confidence: "STATED" },
        users: { value: ["Store owner", "Shop assistant"], confidence: "STATED" },
      },
      requirements: REQS.map(([title, description]) => ({
        title, description, type: "functional", priority: "high",
        origin_confidence: "STATED", acceptance_criteria: [`${title} works as agreed`],
      })),
    })]);
    const ids = REQS.map((_, i) => `REQ-${String(i + 1).padStart(3, "0")}`);
    await michi(root, ["discover", "answer", "--file", payload(root, {
      confirm: { requirements: ids, by: "user" }, confirm_intent: { by: "user" },
    })]);
    await michi(root, ["discover", "close"]);

    // ---- planning starts by asking what is outstanding -------------------
    let status = JSON.parse((await michi(root, ["plan", "status", "--json"])).out).data;
    expect(status.specification.status).toBe("DRAFT");
    expect(status.unplaced).toEqual(ids);
    expect(status.next_step).toMatch(/who this is for/i);

    // ---- who it is for ---------------------------------------------------
    await plan(root, {
      personas: [
        { name: "Store owner", description: "Runs a single shop and does the stock counting themselves.",
          goals: ["Know what is actually on the shelf", "Never run out of a seller unexpectedly"] },
        { name: "Shop assistant", description: "Serves customers and records what leaves the shelf.",
          goals: ["Record a sale without stopping to think about it"] },
      ],
    });

    // ---- how it actually gets used ---------------------------------------
    await plan(root, {
      use_cases: [
        { title: "Correct a stock count after a delivery", persona: "PER-001",
          trigger: "A delivery arrives and the recorded quantity is now wrong.",
          steps: ["The owner finds the product", "The owner records how many arrived", "The new quantity is shown"],
          requirements: ["REQ-001", "REQ-002", "REQ-003"] },
        { title: "Record a sale at the counter", persona: "PER-002",
          trigger: "A customer buys something.",
          steps: ["The assistant finds the product", "The assistant records one sold"],
          requirements: ["REQ-002", "REQ-004"] },
      ],
    });

    // ---- the cut: proposed, with reasons, nothing agreed yet -------------
    await plan(root, {
      scope: [
        { requirement: "REQ-001", scope: "MVP", reason: "Nothing else works until products exist." },
        { requirement: "REQ-002", scope: "MVP", reason: "Seeing the count is the whole point." },
        { requirement: "REQ-003", scope: "MVP", reason: "Counts drift immediately without this." },
        { requirement: "REQ-004", scope: "MVP", reason: "Counts drift immediately without this." },
        { requirement: "REQ-005", scope: "FUTURE", reason: "Only worth having once the counts are trusted." },
      ],
      out_of_scope: [
        { title: "Accounting and bookkeeping", reason: "The owner already uses a separate accountant." },
        { title: "Supplier ordering", reason: "They phone their supplier and want to keep doing that." },
      ],
    });

    status = JSON.parse((await michi(root, ["plan", "status", "--json"])).out).data;
    expect(status.gaps.unconfirmed_scope.sort()).toEqual(ids);
    expect(status.next_step).toMatch(/confirm the scope/i);

    // ---- the user agrees to the cut --------------------------------------
    await plan(root, { confirm: { scope: ids, by: "user" } });

    status = JSON.parse((await michi(root, ["plan", "status", "--json"])).out).data;
    expect(status.by_scope.MVP).toEqual(["REQ-001", "REQ-002", "REQ-003", "REQ-004"]);
    expect(status.by_scope.FUTURE).toEqual(["REQ-005"]);
    expect(status.gaps.mvp_without_criteria).toHaveLength(4);
    expect(status.next_step).toMatch(/acceptance criteria/i);

    // ---- how we will know it works ---------------------------------------
    await plan(root, {
      criteria: [
        { requirement: "REQ-001", kind: "GWT", given: ["no products exist yet"],
          when: "the owner adds a product", then: ["it appears in the product list"] },
        { requirement: "REQ-002", kind: "GWT", given: ["a product has 5 units in stock"],
          when: "the owner opens the stock list", then: ["it shows 5 units for that product"] },
        { requirement: "REQ-003", kind: "GWT", given: ["a product has 5 units in stock"],
          when: "a delivery of 3 is recorded", then: ["the current stock shows 8 units"] },
        { requirement: "REQ-004", kind: "GWT", given: ["a product has 5 units in stock"],
          when: "1 unit is recorded as sold", then: ["the current stock shows 4 units"] },
        { requirement: "REQ-004", kind: "PLAIN",
          text: "Stock cannot be taken below zero without an explicit correction." },
      ],
    });

    status = JSON.parse((await michi(root, ["plan", "status", "--json"])).out).data;
    expect(status.gaps.mvp_without_criteria).toEqual([]);
    expect(status.next_step).toMatch(/confirm it/i);

    // ---- close is refused until the user signs off ------------------------
    let refused = 0;
    await run(["--project", root, "plan", "close"],
      { out: () => {}, err: () => {} }, { now }).then((c) => { refused = c; });
    expect(refused).toBe(7);

    // ---- the user signs off, and the PRD is written -----------------------
    await plan(root, { confirm_specification: { by: "user" } });
    const closed = await michi(root, ["plan", "close"]);
    expect(closed.out).toMatch(/In the first version: 4/);
    expect(closed.out).toMatch(/Later: 1/);
    expect(closed.out).toMatch(/ARCHITECTURE/);

    // ---- what now exists -------------------------------------------------
    const final = JSON.parse((await michi(root, ["status", "--json"])).out).data;
    expect(final.stage).toBe("ARCHITECTURE");

    const prd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    expect(prd).toContain("Small retailers lose track");
    expect(prd).toContain("Store owner");
    expect(prd).toContain("Shop assistant");
    expect(prd).toMatch(/## In the first version/);
    expect(prd).toMatch(/## Later/);
    expect(prd).toMatch(/## Not part of this product/);
    expect(prd).toContain("Accounting and bookkeeping");
    // The deferred requirement is recorded as deferred, not lost.
    expect(prd).toContain("Warn before running out");
    expect(prd).toContain("Only worth having once the counts are trusted");
    // Criteria a later phase can run.
    expect(prd).toContain("when 1 unit is recorded as sold, then the current stock shows 4 units");
    expect(prd).toMatch(/4 requirement\(s\) in the first version · 1 later/);

    // TRD is Phase 4's output, not an empty file now.
    expect(existsSync(join(root, ".michi/requirements/TRD.md"))).toBe(false);

    // And MICHI wrote no application code.
    expect(readdirSync(root).filter((x) => !x.startsWith(".michi") && !x.startsWith("pl") && x !== "package.json"))
      .toEqual([]);
  });
});
