/**
 * Phase 5 acceptance.
 *
 * The inventory project, and a request for the context needed to implement
 * low-stock alerts. The packet must carry what that work needs, leave out what
 * it does not, explain both, reproduce exactly, and change when the project
 * changes.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let t = 0;
const BASE = Date.parse("2026-10-06T11:00:00.000Z");
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
const file = (root: string, body: unknown): string => {
  const p = join(root, `q${f++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2), "utf8");
  return p;
};
const draft = (title: string, description: string) => ({
  title, description, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: [`${title} works as agreed`],
});

/** The inventory project through all four earlier phases. */
async function inventory(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "michi-a5-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
  await michi(root, ["init"]);
  await michi(root, ["discover", "start"]);
  await michi(root, ["discover", "answer", "--file", file(root, {
    intent: {
      problem: { value: "Small retailers lose track of stock and find out too late.", confidence: "STATED" },
      goal: { value: "Trust the counts and be warned before running out.", confidence: "STATED" },
      users: { value: ["Store owner"], confidence: "STATED" },
      constraints: { value: ["One shop", "No budget for paid services yet"], confidence: "STATED" },
    },
    requirements: [
      draft("Manage products", "Add, edit and retire products."),
      draft("See current stock", "See how many of each product is on hand."),
      draft("Warn before running out", "Tell the owner when stock falls below a chosen level."),
      draft("Export a stock report", "Download the current stock as a file."),
    ],
  })]);
  const reqs = ["REQ-001", "REQ-002", "REQ-003", "REQ-004"];
  await michi(root, ["discover", "answer", "--file", file(root, {
    confirm: { requirements: reqs, by: "user" }, confirm_intent: { by: "user" },
  })]);
  await michi(root, ["discover", "close"]);
  await michi(root, ["plan", "update", "--file", file(root, {
    personas: [{ name: "Store owner", description: "Runs a single shop.", goals: ["Never run out of a seller"] },
               { name: "Shop assistant", description: "Serves customers.", goals: [] }],
    use_cases: [
      { title: "Notice a product running low", persona: "PER-001",
        trigger: "Stock falls below the chosen level.",
        steps: ["a warning reaches the owner", "the owner reorders"],
        requirements: ["REQ-002", "REQ-003"] },
      { title: "Sell something at the counter", persona: "PER-002",
        trigger: "A customer buys.", steps: ["record it"], requirements: ["REQ-002"] },
    ],
    scope: [
      { requirement: "REQ-001", scope: "MVP", reason: "Nothing works until products exist." },
      { requirement: "REQ-002", scope: "MVP", reason: "Seeing the count is the point." },
      { requirement: "REQ-003", scope: "MVP", reason: "The owner asked for alerts from day one." },
      { requirement: "REQ-004", scope: "FUTURE", reason: "Nice once the counts are trusted." },
    ],
    criteria: [
      { requirement: "REQ-001", kind: "GWT", given: ["no products exist"], when: "the owner adds one", then: ["it appears in the list"] },
      { requirement: "REQ-002", kind: "GWT", given: ["a product has 5 units"], when: "the owner opens the list", then: ["it shows 5"] },
      { requirement: "REQ-003", kind: "GWT", given: ["stock is below the chosen level"], when: "the owner opens the app", then: ["a warning is shown"] },
    ],
  })]);
  await michi(root, ["plan", "update", "--file", file(root, {
    confirm: { scope: reqs, by: "user" }, confirm_specification: { by: "user" },
  })]);
  await michi(root, ["plan", "close"]);

  for (const [id, title, category, affects] of [
    ["D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]],
    ["D002", "How the low-stock warning reaches the owner", "notifications", ["REQ-003"]],
  ] as const) {
    await michi(root, ["decide", "propose", "--file", file(root, {
      title, type: "engineering", category,
      options: [{ key: "a", label: "The chosen way", explanation: "Plain words about it.", tradeoffs: "A real cost." },
                { key: "b", label: "The other way", explanation: "Plain words about it.", tradeoffs: "A different cost." }],
      affects_requirements: affects,
    })]);
    await michi(root, ["decide", "confirm", id, "--choice", "a", "--by", "user",
      "--rationale", `Because of how ${category} has to behave here.`,
      "--adr", file(root, `The reasoning behind ${title}.`)]);
  }
  await michi(root, ["architecture", "close"]);
  return root;
}

describe("context for implementing low-stock alerts", () => {
  it("carries what that work needs and nothing else, and says why for both", async () => {
    const root = await inventory();

    // The skill turns "implement low-stock alerts" into a structured focus.
    const packet = data(await michi(root, ["context", "REQ-003", "--json"]));

    // ---- what it carries ------------------------------------------------
    const tier = (id: string) => packet.items.find((i: { id: string }) => i.id === id)?.tier;
    const why = (id: string) => packet.items.find((i: { id: string }) => i.id === id)?.reason;

    expect(tier("REQ-003")).toBe("MUST_INCLUDE");
    expect(why("REQ-003")).toBe("direct target");
    expect(tier("D002")).toBe("MUST_INCLUDE");
    expect(why("D002")).toMatch(/governs REQ-003/);
    expect(tier("ADR-002")).toBe("MUST_INCLUDE");
    expect(why("ADR-002")).toMatch(/documents D002/);
    expect(tier("AC-003")).toBe("MUST_INCLUDE");
    expect(why("AC-003")).toMatch(/verifies REQ-003/);
    expect(tier("UC-001")).toBe("PREFERRED");
    expect(tier("PER-001")).toBe("PREFERRED");
    expect(tier("REQ-002")).toBe("OPTIONAL");

    // The project's own constraints travel with it.
    expect(packet.project.constraints).toContain("No budget for paid services yet");

    // ---- what it leaves out ---------------------------------------------
    const carried = packet.items.map((i: { id: string }) => i.id);
    for (const unrelated of ["REQ-001", "REQ-004", "D001", "ADR-001", "AC-001", "UC-002", "PER-002"]) {
      expect(carried, unrelated).not.toContain(unrelated);
    }
    const excluded = (id: string) =>
      packet.excluded.find((x: { id: string }) => x.id === id)?.reason;
    expect(excluded("D001")).toMatch(/not connected to REQ-003/);
    expect(excluded("REQ-001")).toBeDefined();

    // Smaller than the project, by a long way.
    const whole = data(await michi(root, ["plan", "export", "--json"]));
    expect(packet.items.length).toBeLessThan(
      whole.specification.criteria.length + whole.specification.use_cases.length +
      whole.requirements.length + 6,
    );

    // ---- reproducible ----------------------------------------------------
    const again = data(await michi(root, ["context", "REQ-003", "--json"]));
    expect(again.context_hash).toBe(packet.context_hash);
    expect(again.packet_id).toBe(packet.packet_id);
    expect(again.items.map((i: { id: string }) => i.id)).toEqual(carried);

    // Resolving context wrote nothing.
    expect(readdirSync(join(root, ".michi/context/packets"))).toEqual([]);
    expect(readdirSync(join(root, ".michi/graph"))).toEqual([]);

    // ---- and it follows the project ---------------------------------------
    // The founder changes their mind: alerts move to version two.
    await michi(root, ["plan", "update", "--file", file(root, {
      revision: { reason: "The owner realised alerts are noise until the counts are trusted.", by: "user" },
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "Once the counts are trusted." }],
    })]);
    await michi(root, ["plan", "update", "--file", file(root, {
      confirm: { scope: ["REQ-003"], by: "user" }, confirm_specification: { by: "user" },
    })]);
    await michi(root, ["plan", "close"]);

    const changed = data(await michi(root, ["context", "REQ-003", "--json"]));
    expect(changed.context_hash).not.toBe(packet.context_hash);

    // The decision that governed it is now flagged — visible, not hidden,
    // and not presented as still valid.
    const d002 = changed.items.find((i: { id: string }) => i.id === "D002");
    expect(d002.needs_review).toBe(true);
    expect(d002.review_reason).toMatch(/REQ-003/);
    expect(changed.warnings.join(" ")).toMatch(/D002/);

    // And the revision that moved it is surfaced — only that one.
    expect(changed.revisions.map((r: { id: string }) => r.id)).toEqual(["REV-001"]);
    expect(changed.revisions[0].reason).toMatch(/noise until the counts/);
  });
});
