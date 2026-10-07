/**
 * The whole path, once: a founder's sentence becomes an instruction an agent
 * can act on.
 *
 * This is the only test that proves the four phases compose rather than merely
 * work alongside each other. Everything here is what the three skills would do
 * through the user's own agent.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-05T08:00:00.000Z");
const now = () => new Date(BASE + t++ * 60_000).toISOString();

async function michi(root: string, args: string[]) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  if (code !== 0) throw new Error(`michi ${args.join(" ")} exited ${code}\n${err}${out}`);
  return { out, err };
}
const data = (c: { out: string }) => JSON.parse(c.out).data;

let f = 0;
const put = (root: string, name: string, body: unknown): string => {
  const p = join(root, `${name}${f++}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2), "utf8");
  return p;
};

describe("idea to a compiled instruction", () => {
  it("carries one sentence all the way through, losing nothing", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-life-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");

    // "I want an inventory app for small retailers. Owners should manage
    //  products, see stock, record it in and out, and get low-stock alerts.
    //  I don't know the technical details."
    await michi(root, ["init"]);

    // The owner tells MICHI the one command it may run on their behalf.
    const cfg = join(root, ".michi/config.yaml");
    writeFileSync(cfg, readFileSync(cfg, "utf8")
      .replace("allow: {}", "allow:\n    test: echo '4 passed, 0 failed'"), "utf8");

    // ---- discovery -------------------------------------------------------
    await michi(root, ["discover", "start"]);
    await michi(root, ["discover", "answer", "--file", put(root, "t.json", {
      intent: {
        problem: { value: "Small retailers lose track of stock and find out too late.", confidence: "STATED" },
        goal: { value: "Let an owner trust their counts and be warned before running out.", confidence: "STATED" },
        users: { value: ["Store owner"], confidence: "STATED" },
        constraints: { value: ["One shop", "No budget for paid services yet"], confidence: "STATED" },
      },
      requirements: [
        { title: "Manage products", description: "Add, edit and retire products.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["a product can be added"] },
        { title: "See current stock", description: "See how many of each product is on hand.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["the count is visible"] },
        { title: "Record stock movements", description: "Deliveries increase and sales decrease the count.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["the count changes"] },
        { title: "Warn before running out", description: "Tell the owner when stock falls below a chosen level.", type: "functional", priority: "medium", origin_confidence: "STATED", acceptance_criteria: ["a warning appears"] },
      ],
    })]);
    const reqs = ["REQ-001", "REQ-002", "REQ-003", "REQ-004"];
    await michi(root, ["discover", "answer", "--file", put(root, "t.json", {
      confirm: { requirements: reqs, by: "user" }, confirm_intent: { by: "user" },
    })]);
    await michi(root, ["discover", "close"]);
    expect(data(await michi(root, ["status", "--json"])).stage).toBe("SPECIFICATION");

    // ---- product planning: the cut ---------------------------------------
    await michi(root, ["plan", "update", "--file", put(root, "p.json", {
      personas: [{ name: "Store owner", description: "Runs a single shop and counts stock themselves.", goals: ["Know what is on the shelf"] }],
      use_cases: [{ title: "Correct a count after a delivery", persona: "PER-001",
                    trigger: "A delivery arrives and the count is wrong.",
                    steps: ["find the product", "record what arrived"], requirements: ["REQ-001", "REQ-003"] }],
      scope: [
        { requirement: "REQ-001", scope: "MVP", reason: "Nothing works until products exist." },
        { requirement: "REQ-002", scope: "MVP", reason: "Seeing the count is the point." },
        { requirement: "REQ-003", scope: "MVP", reason: "Counts drift immediately without it." },
        { requirement: "REQ-004", scope: "FUTURE", reason: "Only worth having once the counts are trusted." },
      ],
      criteria: [
        { requirement: "REQ-001", kind: "GWT", given: ["no products exist"], when: "the owner adds one", then: ["it appears in the list"] },
        { requirement: "REQ-002", kind: "GWT", given: ["a product has 5 units"], when: "the owner opens the stock list", then: ["it shows 5"] },
        { requirement: "REQ-003", kind: "GWT", given: ["a product has 5 units"], when: "1 is recorded as sold", then: ["the count shows 4"] },
      ],
      out_of_scope: [{ title: "Accounting", reason: "They already use an accountant." }],
    })]);
    await michi(root, ["plan", "update", "--file", put(root, "p.json", {
      confirm: { scope: reqs, by: "user" }, confirm_specification: { by: "user" },
    })]);
    await michi(root, ["plan", "close"]);
    expect(data(await michi(root, ["status", "--json"])).stage).toBe("ARCHITECTURE");

    // ---- architecture: one decision at a time ----------------------------
    const arch = data(await michi(root, ["architecture", "status", "--json"]));
    expect(arch.undecided).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
    expect(arch.undecided).not.toContain("REQ-004");   // FUTURE needs no approach yet

    await michi(root, ["decide", "propose", "--file", put(root, "d.json", {
      title: "Where the stock information is kept", type: "engineering", category: "database",
      options: [
        { key: "relational", label: "A proper database", explanation: "Products and stock live in linked tables, and the database refuses to record a sale for a product that does not exist.", tradeoffs: "About £7 a month, and one more thing to run." },
        { key: "file", label: "A single file", explanation: "Everything in one file you could open yourself.", tradeoffs: "Two people recording at once will lose one of the entries." },
      ],
      affects_requirements: ["REQ-001", "REQ-002", "REQ-003"],
    })]);
    await michi(root, ["decide", "confirm", "D001", "--choice", "relational", "--by", "user",
      "--rationale", "Two people record movements at once and a lost sale is the bug they would trust least.",
      "--adr", put(root, "adr.md", "The owner and their assistant both record stock. A file loses one of their edits silently, and a silently wrong count is exactly the thing this product exists to fix.")]);

    const closed = await michi(root, ["architecture", "close"]);
    expect(closed.out).toMatch(/DESIGN/);

    // ---- what the project now holds --------------------------------------
    const final = data(await michi(root, ["status", "--json"]));
    expect(final.stage).toBe("DESIGN");
    expect(final.architecture_status).toBe("LOCKED");
    expect(final.counts.requirements).toBe(4);
    expect(final.counts.decisions_locked).toBe(1);
    expect(final.needs_review).toEqual([]);

    expect(readdirSync(join(root, ".michi/requirements")).sort())
      .toEqual(["PRD.md", "TRD.md", "requirements.yaml", "specification.yaml"]);
    expect(readdirSync(join(root, ".michi/decisions")).sort())
      .toEqual(["ADR-001-where-the-stock-information-is-kept.md", "index.yaml"]);
    expect(readdirSync(join(root, ".michi/architecture")).sort())
      .toEqual(["SYSTEM.md", "diagrams"]);

    // The founder's own words survived four phases intact.
    const identity = readFileSync(join(root, ".michi/project/identity.md"), "utf8");
    expect(identity).toContain("Small retailers lose track of stock");

    const prd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    expect(prd).toContain("Store owner");
    expect(prd).toMatch(/## In the first version/);
    expect(prd).toMatch(/## Later[\s\S]*Warn before running out/);
    expect(prd).toContain("Accounting");

    const system = readFileSync(join(root, ".michi/architecture/SYSTEM.md"), "utf8");
    expect(system).toContain("A proper database");
    expect(system).toContain("REQ-003 — Record stock movements");
    expect(system).toContain("A single file");          // what was not chosen, kept

    const trd = readFileSync(join(root, ".michi/requirements/TRD.md"), "utf8");
    expect(trd).toContain("No budget for paid services yet");
    expect(trd).toContain("ADR-001");

    // Every consequential step names the human who agreed to it.
    const requirements = readFileSync(join(root, ".michi/requirements/requirements.yaml"), "utf8");
    expect(requirements.match(/confirmed_by: user/g)).toHaveLength(4);
    const spec = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    expect(spec.match(/confirmed_by: user/g)?.length).toBeGreaterThanOrEqual(5);
    const decisions = readFileSync(join(root, ".michi/decisions/index.yaml"), "utf8");
    expect(decisions).toMatch(/by: user/);

    // ---- the work, planned from what was agreed --------------------------
    const planned = await michi(root, ["plan", "tasks", "--from-requirements"]);
    expect(planned.out).toMatch(/TASK-001/);
    expect(data(await michi(root, ["plan", "validate", "--json"])).ok).toBe(true);
    expect(data(await michi(root, ["status", "--json"])).stage).toBe("PLANNING");

    // Only the first version gets work planned for it.
    const tasks = data(await michi(root, ["task", "list", "--json"])).tasks;
    expect(tasks.flatMap((x: { requirements: string[] }) => x.requirements)).not.toContain("REQ-004");

    // ---- handed over, with the instruction compiled from all of the above --
    const next = data(await michi(root, ["task", "next", "--json"]));
    expect(next.task.task_id).toBe("TASK-001");

    const handover = data(await michi(root, ["task", "start", "TASK-001", "--agent", "claude-code", "--json"]));
    const instruction: string = handover.instruction;

    // Every section the contract names, in the order it names them.
    let at = -1;
    for (const heading of [
      "ROLE", "PROJECT", "TASK", "USER REQUIREMENT", "ENGINEERING INTERPRETATION",
      "APPROVED DECISIONS", "ARCHITECTURE", "SCOPE", "OUT OF SCOPE", "RELEVANT FILES",
      "IMPLEMENTATION RULES", "SECURITY REQUIREMENTS", "ACCEPTANCE CRITERIA",
      "TESTING", "VERIFICATION", "STOP CONDITIONS", "REPORT BACK",
    ]) {
      const found = instruction.indexOf(`## ${heading}`);
      expect(found, heading).toBeGreaterThan(at);
      at = found;
    }

    // The founder's own words, the decision they approved, its reasoning, the
    // limit they stated, and how it will be checked — all four phases, in one
    // instruction.
    expect(instruction).toContain("Manage products");
    expect(instruction).toContain("A proper database");
    expect(instruction).toContain("Two people record movements at once");
    expect(instruction).toContain("No budget for paid services yet");
    expect(instruction).toContain("it appears in the list");

    // Nothing about requirements that are not this task's business.
    expect(instruction).not.toContain("Export a stock report");

    // ---- what came back is a claim ---------------------------------------
    const reported = data(await michi(root, ["task", "report", "TASK-001", "--from", put(root, "r.json", {
      result: "REPORTED",
      files_touched: ["src/products.ts", "src/products.test.ts"],
      tests: { run: 4, passed: 4, failed: 0 },
      notes: "Added the product table and its tests.",
    }), "--json"]));

    expect(reported.task.status).toBe("CHANGES_DETECTED");
    expect(reported.task.verification.status).toBe("PENDING");
    expect(reported.task.verification.evidence).toEqual([]);
    expect(reported.run.result).toBe("REPORTED");
    expect(reported.run.verification_status).toBe("PENDING");

    // The handover is provable after the fact.
    const shown = data(await michi(root, ["task", "show", "TASK-001", "--json"]));
    expect(shown.runs[0].instruction_hash).toBe(handover.run.instruction_hash);
    expect(shown.task.context.packet).toMatch(/^CTX-/);

    // ---- reviewed, tested, and only then believed ------------------------
    // A review is a judgement, not evidence that anything runs.
    const reviewed = data(await michi(root, ["review", "TASK-001", "--verdict", "CHANGES_REQUIRED",
      "--findings", put(root, "fn.json", { findings: [
        { file: "src/products.ts", line: 12, problem: "The name is not validated before storing.",
          why: "An empty name would be saved and shown as a blank row.",
          fix: "Reject an empty or whitespace-only name." },
      ]}), "--json"]));
    expect(reviewed.task.status).toBe("CHANGES_DETECTED");

    // The fix is debugged in order: MICHI refuses a fix nobody reproduced.
    await expect(michi(root, ["debug", "TASK-001", "--stage", "FIX", "--note", "Added a check."]))
      .rejects.toThrow(/reproduc/i);
    await michi(root, ["debug", "TASK-001", "--stage", "REPRODUCE", "--note", "An empty name saves."]);
    await michi(root, ["debug", "TASK-001", "--stage", "ROOT_CAUSE", "--note", "The write path never checks."]);
    await michi(root, ["debug", "TASK-001", "--stage", "FIX", "--note", "Validate on the shared write path."]);

    await michi(root, ["review", "TASK-001", "--verdict", "PASS",
      "--findings", put(root, "fn.json", { findings: [] }), "--json"]);

    // What the agent says about its own tests is a claim, however green.
    await michi(root, ["test", "TASK-001", "--record", put(root, "v.json", {
      kind: "TESTS", summary: "I ran the suite and it passed.", passed: true,
    })]);

    const criteria: { id: string }[] =
      data(await michi(root, ["task", "show", "TASK-001", "--json"])).task.acceptance_criteria;
    expect(criteria.length).toBeGreaterThan(0);
    const verdict = (evidence: string[]) => put(root, "v.json", {
      criteria: criteria.map((c) => ({
        id: c.id, status: "SATISFIED", reason: "The suite covers it.", evidence,
      })),
    });

    // Refused: every piece of evidence so far came from the agent being judged.
    await expect(michi(root, ["verify", "TASK-001", "--from", verdict(["TESTS"])]))
      .rejects.toThrow(/claim|not observed/i);

    // So MICHI runs the one command it was allowed to run, and watches.
    const ran = data(await michi(root, ["test", "TASK-001", "--run", "test", "--json"]));
    expect(ran.evidence.produced_by).toBe("MICHI");
    expect(ran.evidence.exit_code).toBe(0);
    expect(ran.evidence.command).toContain("echo");

    const verified = data(await michi(root, ["verify", "TASK-001", "--from", verdict(["TESTS"]), "--json"]));
    expect(verified.task.status).toBe("VERIFIED");
    expect(verified.task.verification.status).toBe("PASSED");
    expect(verified.task.verification.evidence.some(
      (e: { produced_by: string }) => e.produced_by === "MICHI")).toBe(true);

    // Verified is not the same as finished with. Closing is its own act.
    const filed = data(await michi(root, ["task", "done", "TASK-001", "--json"]));
    expect(filed.task.status).toBe("DONE");
    expect(existsSync(join(root, ".michi/tasks/completed/TASK-001.yaml"))).toBe(true);
    expect(data(await michi(root, ["status", "--json"])).counts.tasks_done).toBe(1);

    // And the verdict still says which part MICHI never saw for itself.
    const settled = data(await michi(root, ["task", "show", "TASK-001", "--json"]));
    expect(settled.task.verification.verified_at).toBeTruthy();
    expect(settled.task.verification.evidence.filter(
      (e: { produced_by: string }) => e.produced_by === "AGENT").length).toBeGreaterThan(0);

    // And MICHI wrote no application code.
    expect(readdirSync(root).filter((x) => !x.startsWith(".michi") && x !== "package.json"
      && !x.startsWith("t.json") && !x.startsWith("p.json") && !x.startsWith("d.json")
      && !x.startsWith("adr.md") && !x.startsWith("r.json")
      && !x.startsWith("fn.json") && !x.startsWith("v.json")))
      .toEqual([]);
  });
});
