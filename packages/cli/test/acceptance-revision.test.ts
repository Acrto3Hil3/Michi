/**
 * OQ-008 acceptance.
 *
 * The founder from the earlier scenarios comes back months later and changes
 * their mind. Nothing important disappears, nothing important changes
 * silently, and every human decision stays attributable.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-02T10:00:00.000Z");
const now = () => new Date(BASE + t++ * 60_000).toISOString();

async function michi(root: string, args: string[]) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  if (code !== 0) throw new Error(`michi ${args.join(" ")} exited ${code}\n${err}${out}`);
  return { out, err };
}
async function michiFails(root: string, args: string[]): Promise<number> {
  return run(["--project", root, ...args], { out: () => {}, err: () => {} }, { now });
}

let f = 0;
const file = (root: string, data: unknown): string => {
  const p = join(root, `a${f++}.json`);
  writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
  return p;
};
const data = (c: { out: string }) => JSON.parse(c.out).data;

const draft = (title: string, description: string) => ({
  title, description, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: [`${title} works as agreed`],
});

/** Everything up to a first published specification. */
async function publishedProject(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-oq8-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  await michi(root, ["init"]);
  await michi(root, ["discover", "start"]);
  await michi(root, ["discover", "answer", "--file", file(root, {
    intent: {
      problem: { value: "Small retailers lose track of stock and find out too late.", confidence: "STATED" },
      goal: { value: "See and correct stock, and be warned before running out.", confidence: "STATED" },
      users: { value: ["Store owner"], confidence: "STATED" },
    },
    requirements: [
      draft("Manage products", "A store owner can add, edit and retire products."),
      draft("See current stock", "Anyone signed in can see how many of each product is on hand."),
      draft("Warn before running out", "The owner is told when a product falls below a chosen level."),
    ],
  })]);
  await michi(root, ["discover", "answer", "--file", file(root, {
    confirm: { requirements: ["REQ-001", "REQ-002", "REQ-003"], by: "user" },
    confirm_intent: { by: "user" },
  })]);
  await michi(root, ["discover", "close"]);
  await michi(root, ["plan", "update", "--file", file(root, {
    personas: [{ name: "Store owner", description: "Runs a single shop.", goals: ["Know what is on the shelf"] }],
    use_cases: [{ title: "Check the shelf against the system", persona: "PER-001",
                  trigger: "The owner suspects a count is wrong.",
                  steps: ["open the stock list", "compare with the shelf"],
                  requirements: ["REQ-001", "REQ-002"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "Nothing works until products exist." },
            { requirement: "REQ-002", scope: "MVP", reason: "Seeing the count is the point." },
            { requirement: "REQ-003", scope: "MVP", reason: "The owner asked for alerts from day one." }],
    criteria: [
      { requirement: "REQ-001", kind: "GWT", given: ["no products exist"], when: "the owner adds one", then: ["it appears in the product list"] },
      { requirement: "REQ-002", kind: "GWT", given: ["a product has 5 units"], when: "the owner opens the stock list", then: ["it shows 5"] },
      { requirement: "REQ-003", kind: "GWT", given: ["a product is below its chosen level"], when: "the owner opens the app", then: ["a warning is shown"] },
    ],
  })]);
  await michi(root, ["plan", "update", "--file", file(root, {
    confirm: { scope: ["REQ-001", "REQ-002", "REQ-003"], by: "user" },
    confirm_specification: { by: "user" },
  })]);
  await michi(root, ["plan", "close"]);
  return root;
}

describe("the founder changes their mind after publication", () => {
  it("records a revision, republishes, and loses nothing", async () => {
    const root = await publishedProject();
    const firstPrd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    expect(firstPrd).toContain("Warn before running out");
    expect(data(await michi(root, ["status", "--json"])).stage).toBe("ARCHITECTURE");

    // 4-5. "Alerts shouldn't be in the first version. Drop that criterion too."
    //      A change with no reason is refused outright.
    expect(await michiFails(root, ["plan", "update", "--file", file(root, {
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "not first after all" }],
    })])).toBe(7);

    // 6-8. With a reason and a name, it becomes REV-001.
    const revised = await michi(root, ["plan", "update", "--file", file(root, {
      revision: {
        reason: "The owner realised alerts are noise until the counts are trusted.",
        by: "user",
      },
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "Worth having once counts are trusted." }],
      remove: { criteria: ["AC-003"], by: "user", reason: "Described behaviour that is no longer in version one." },
    })]);
    expect(revised.out).toMatch(/REV-001/);

    const spec = data(await michi(root, ["plan", "export", "--json"])).specification;
    expect(spec.status).toBe("DRAFT");
    expect(spec.revisions).toHaveLength(1);
    expect(spec.revisions[0].reason).toMatch(/noise until the counts/);
    expect(spec.revisions[0].confirmed_by).toBe("user");
    expect(spec.revisions[0].changes.join(" ")).toMatch(/REQ-003 scope MVP → FUTURE/);
    expect(spec.revisions[0].changes.join(" ")).toMatch(/AC-003 removed/);

    // 12. Nothing was physically deleted.
    const removed = spec.criteria.find((c: { id: string }) => c.id === "AC-003");
    expect(removed).toBeDefined();
    expect(removed.status).toBe("REMOVED");
    expect(removed.removed_by).toBe("user");
    expect(removed.requirement).toBe("REQ-003");
    expect(spec.criteria).toHaveLength(3);

    // 10. Publishing again revalidates. The changed scope call needs the user's
    //     agreement again — a revision does not inherit the old confirmation.
    expect(await michiFails(root, ["plan", "close"])).toBe(7);
    await michi(root, ["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-003"], by: "user" },
      confirm_specification: { by: "user" },
    })]);
    const closed = await michi(root, ["plan", "close"]);
    expect(closed.out).toMatch(/publication 2/i);
    expect(closed.out).toMatch(/REV-001/);

    // 9. The PRD is regenerated to the current specification, with the history.
    const secondPrd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    expect(secondPrd).not.toBe(firstPrd);
    expect(secondPrd).toMatch(/## Later[\s\S]*Warn before running out/);
    expect(secondPrd).toMatch(/## What changed since this was first agreed/);
    expect(secondPrd).toContain("REV-001");
    expect(secondPrd).toContain("noise until the counts are trusted");
    expect(readdirSync(join(root, ".michi/requirements")).sort())
      .toEqual(["PRD.md", "requirements.yaml", "specification.yaml"]);

    // 11. Both publications are on the record.
    const after = data(await michi(root, ["plan", "export", "--json"])).specification;
    expect(after.publications).toHaveLength(2);
    expect(after.publications[0].mvp.sort()).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
    expect(after.publications[1].mvp.sort()).toEqual(["REQ-001", "REQ-002"]);
    expect(after.publications[1].revision).toBe("REV-001");

    // 13. And the requirement itself was never touched — scope moved, not the requirement.
    const requirements = readFileSync(join(root, ".michi/requirements/requirements.yaml"), "utf8");
    expect(requirements).toContain("REQ-003");
    expect(requirements).toMatch(/confirmed_by: user/);
    expect(requirements).not.toContain("REMOVED");
  });
});

describe("a new requirement after architecture has begun", () => {
  it("moves readiness back, preserves what exists, and does not claim architecture is ready", async () => {
    const root = await publishedProject();
    const specBefore = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    const prdBefore = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");

    // 2. "Actually we want barcode scanning."
    await michi(root, ["discover", "start"]);
    await michi(root, ["discover", "answer", "--file", file(root, {
      requirements: [draft("Scan barcodes", "Scan a product instead of searching for it.")],
    })]);
    await michi(root, ["discover", "answer", "--file", file(root, {
      confirm: { requirements: ["REQ-004"], by: "user" }, confirm_intent: { by: "user" },
    })]);
    await michi(root, ["discover", "close"]);

    // 3. Readiness moved back, and says why.
    const state = data(await michi(root, ["status", "--json"]));
    expect(state.stage).toBe("SPECIFICATION");
    expect(state.stage_reason).toMatch(/after the project reached ARCHITECTURE/);
    expect(state.needs_review).toContain("specification");
    expect(state.needs_you.join(" ")).toMatch(/no longer validated/);

    // 4. Nothing downstream was destroyed.
    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(specBefore);
    expect(readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8")).toBe(prdBefore);

    // 5. And nothing claims the project is ready for architecture.
    const plan = data(await michi(root, ["plan", "status", "--json"]));
    expect(plan.gaps.unplaced).toEqual(["REQ-004"]);
    expect(plan.next_step).not.toMatch(/architecture comes next/i);
    expect(plan.next_step).toMatch(/revision/i);

    // The way out is a revision, and it works.
    await michi(root, ["plan", "update", "--file", file(root, {
      revision: { reason: "Barcode scanning was agreed after the first publication.", by: "user" },
      scope: [{ requirement: "REQ-004", scope: "FUTURE", reason: "After the counts are trusted." }],
    })]);
    await michi(root, ["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-004"], by: "user" }, confirm_specification: { by: "user" },
    })]);
    await michi(root, ["plan", "close"]);

    const recovered = data(await michi(root, ["status", "--json"]));
    expect(recovered.stage).toBe("ARCHITECTURE");
    expect(recovered.needs_review).not.toContain("specification");
  });
});
