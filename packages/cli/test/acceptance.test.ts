/**
 * Phase 2 acceptance.
 *
 * A non-technical founder describes an idea. Everything below is what the
 * senior-engineer skill would do on their behalf: the conversation happens in
 * the agent, and each turn lands in MICHI as structure. No application code is
 * written, and nothing is confirmed that the user did not confirm.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

let tick = 0;
const now = () => `2026-09-29T10:${String(tick++).padStart(2, "0")}:00.000Z`;

async function michi(root: string, args: string[]) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } }, { now });
  if (code !== 0) throw new Error(`michi ${args.join(" ")} exited ${code}\n${err}${out}`);
  return { out, err };
}

function payload(root: string, name: string, data: unknown): string {
  const p = join(root, name);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data, null, 2), "utf8");
  return p;
}

const send = (root: string, name: string, update: object) =>
  michi(root, ["discover", "answer", "--file", payload(root, name, update)]);

describe("a founder describes an inventory app", () => {
  it("becomes durable engineering state, and nothing else", async () => {
    const root = mkdtempSync(join(tmpdir(), "michi-accept-"));
    made.push(root);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");

    // ---------------------------------------------------------------------
    // "I want to build an inventory management application for small
    //  retailers. Store owners should be able to manage products, see current
    //  stock, record stock coming in and going out, and receive low-stock
    //  alerts. I don't know the technical details."
    // ---------------------------------------------------------------------
    await michi(root, ["init"]);
    await michi(root, ["discover", "start"]);

    // Turn 1 — the skill restates what it heard, and marks how it knows each part.
    await send(root, "t1.json", {
      intent: {
        problem: { value: "Small retailers lose track of what is in stock and find out too late.", confidence: "INFERRED" },
        goal: { value: "Let a store owner see and correct stock, and be warned before running out.", confidence: "STATED" },
        users: { value: ["Store owner"], confidence: "STATED" },
        desired_outcome: { value: "Stock counts the owner trusts, and no surprise stockouts.", confidence: "INFERRED" },
      },
      questions: [
        { text: "Is this for one shop, or several under one owner?", why: "It changes whether stock is tracked per location." },
        { text: "Who else touches stock day to day — assistants, a stockroom person?", why: "It decides whether we need more than one kind of user." },
      ],
    });

    let status = JSON.parse((await michi(root, ["discover", "status", "--json"])).out);
    expect(status.data.session.status).toBe("GATHERING");
    expect(status.data.open_questions).toHaveLength(2);
    expect(status.data.inferred).toContain("problem");

    // Turn 2 — "One shop. Just me and one assistant."
    await send(root, "t2.json", {
      resolve_questions: ["Q-001", "Q-002"],
      answers: [
        { key: "locations", value: "one", confidence: "STATED", question: "Is this for one shop, or several under one owner?" },
        { key: "people", value: ["Store owner", "Shop assistant"], confidence: "STATED", question: "Who else touches stock day to day?" },
      ],
      intent: {
        users: { value: ["Store owner", "Shop assistant"], confidence: "STATED" },
        constraints: { value: ["One location", "No existing system to migrate from"], confidence: "STATED" },
        assumptions: { value: ["Stock is counted by hand today"], confidence: "ASSUMED" },
      },
    });

    // Turn 3 — the skill drafts requirements. They arrive PROPOSED.
    await send(root, "t3.json", {
      requirements: [
        { title: "Manage products", description: "A store owner can add, edit and retire the products they stock.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["A store owner can add a product", "A store owner can edit a product", "A retired product stops appearing in stock lists"] },
        { title: "See current stock", description: "Anyone signed in can see how many of each product is on hand.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["Current quantity is shown for every product"] },
        { title: "Record stock coming in", description: "A delivery increases the recorded quantity, and who recorded it is kept.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["Recording a delivery increases the quantity", "The person who recorded it is kept"] },
        { title: "Record stock going out", description: "A sale or write-off decreases the recorded quantity.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["Recording an outgoing movement decreases the quantity", "Quantity cannot go below zero without an explicit correction"] },
        { title: "Warn before running out", description: "The owner is told when a product falls below a level they chose.", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["A per-product threshold can be set", "Falling below it produces a warning"] },
      ],
    });

    const proposed = JSON.parse((await michi(root, ["discover", "status", "--json"])).out);
    expect(proposed.data.requirements).toEqual({ proposed: 5, confirmed: 0, rejected: 0 });
    expect(proposed.data.session.requirements.every((r: { confirmed_by: null }) => r.confirmed_by === null)).toBe(true);
    expect(proposed.data.next_step).toMatch(/confirm/i);

    // Turn 4 — the user reads them back and says yes. Only now are they real.
    await send(root, "t4.json", {
      confirm: { requirements: ["REQ-001", "REQ-002", "REQ-003", "REQ-004", "REQ-005"], by: "user" },
    });
    const ready = JSON.parse((await michi(root, ["discover", "status", "--json"])).out);
    expect(ready.data.session.status).toBe("READY_FOR_CONFIRMATION");

    // ---------------------------------------------------------------------
    // Two decisions the requirements now make necessary — and not before.
    // ---------------------------------------------------------------------
    await michi(root, ["decide", "propose", "--file", payload(root, "d1.json", {
      title: "Where the stock information is kept",
      type: "engineering",
      category: "database",
      options: [
        { key: "relational", label: "A relational database", explanation: "Stock, products and movements are kept in linked tables, and the database itself refuses to let a movement exist without a product.", tradeoffs: "One more thing to run and back up." },
        { key: "spreadsheet", label: "A spreadsheet file", explanation: "Everything lives in one file you could open yourself.", tradeoffs: "Two people editing at once will lose each other's work." },
      ],
      affects_requirements: ["REQ-001", "REQ-002", "REQ-003", "REQ-004"],
    })]);
    await michi(root, ["decide", "confirm", "D001", "--choice", "relational", "--by", "user",
      "--rationale", "Two people record movements, and the database can guarantee stock never detaches from a product.",
      "--adr", payload(root, "adr1.md", "Two people will record stock movements at the same time, and a spreadsheet loses one of their edits silently. A relational database also refuses to record a movement for a product that does not exist, which is the failure the owner would notice last and trust least.")]);

    await michi(root, ["decide", "propose", "--file", payload(root, "d2.json", {
      title: "How the low-stock warning reaches the owner",
      type: "product",
      category: "notifications",
      options: [
        { key: "in_app", label: "A warning inside the app", explanation: "The owner sees it when they next open the app.", tradeoffs: "They miss it if they do not open the app that day." },
        { key: "email", label: "An email", explanation: "It arrives whether or not they open the app.", tradeoffs: "Costs a little per message, and email can land in spam." },
      ],
      affects_requirements: ["REQ-005"],
    })]);
    await michi(root, ["decide", "confirm", "D002", "--choice", "email", "--by", "user",
      "--rationale", "The owner is on the shop floor, not in the app, which is exactly when running out matters.",
      "--adr", payload(root, "adr2.md", "The owner opens the app when they are already thinking about stock. The warning is worth having precisely when they are not, so it has to leave the app.")]);

    // ---------------------------------------------------------------------
    // The user confirms the whole understanding, and discovery closes.
    // ---------------------------------------------------------------------
    await send(root, "t5.json", { confirm_intent: { by: "user" } });
    await michi(root, ["discover", "close"]);

    // ---------------------------------------------------------------------
    // What now exists
    // ---------------------------------------------------------------------
    const final = JSON.parse((await michi(root, ["status", "--json"])).out).data;
    expect(final.stage).toBe("SPECIFICATION");
    expect(final.counts.requirements).toBe(5);
    expect(final.counts.decisions_locked).toBe(2);
    expect(final.counts.decisions_open).toBe(0);

    const session = JSON.parse((await michi(root, ["discover", "export", "--json"])).out).data;
    expect(session.session.status).toBe("COMPLETED");
    expect(session.open_questions).toHaveLength(0);

    for (const artifact of [
      ".michi/requirements/requirements.yaml",
      ".michi/project/identity.md",
      ".michi/decisions/index.yaml",
      ".michi/decisions/ADR-001-where-the-stock-information-is-kept.md",
      ".michi/decisions/ADR-002-how-the-low-stock-warning-reaches-the-owner.md",
      ".michi/sessions/SESSION-001.yaml",
    ]) {
      expect(existsSync(join(root, artifact)), artifact).toBe(true);
    }

    // Every confirmed requirement names the human who confirmed it.
    const requirements = readFileSync(join(root, ".michi/requirements/requirements.yaml"), "utf8");
    expect(requirements.match(/confirmed_by: user/g)).toHaveLength(5);
    expect(requirements).not.toContain("PROPOSED");

    // The plain-language statement says which parts were inferred.
    const identity = readFileSync(join(root, ".michi/project/identity.md"), "utf8");
    expect(identity).toContain("Small retailers lose track");
    expect(identity).toMatch(/problem: INFERRED/);
    expect(identity).toMatch(/goal: STATED/);

    // The ADR records reasoning and does not duplicate mutable state.
    const adr = readFileSync(join(root, ".michi/decisions/ADR-001-where-the-stock-information-is-kept.md"), "utf8");
    expect(adr).toContain("decision: D001");
    expect(adr).not.toMatch(/^status:/m);
    expect(adr).toContain("loses one of their edits silently");

    // And MICHI wrote no application code: the only things in the project are
    // the manifest we started with, the payload files this test wrote, and
    // .michi itself.
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(root).sort()).toEqual([
      ".michi",
      "adr1.md", "adr2.md",
      "d1.json", "d2.json",
      "package.json",
      "t1.json", "t2.json", "t3.json", "t4.json", "t5.json",
    ]);
  });
});
