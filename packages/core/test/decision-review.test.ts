/**
 * OQ-009 — per-decision review flags.
 *
 * A republished specification marked the architecture as a whole for review.
 * That is tolerable at one decision and useless at thirty. Core can do better:
 * it knows which requirements a revision moved, and which decisions name them.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm, decideList } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { architectureClose, architectureStatus } from "../src/commands/architecture.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-06T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `r${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed"],
});
const decisions = (root: string) => unwrap(decideList({ root, now: tick })).decisions;

/** Two MVP requirements, one decision governing each, architecture locked. */
function locked() {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("Warn before running out")],
  }));
  unwrap(discover(root, { confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" },
                          confirm_intent: { by: "user" } }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Owner", description: "Runs a shop.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "asked for" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-002", kind: "PLAIN", text: "A warning appears." }],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002"], by: "user" },
                      confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));

  for (const [id, title, reqs] of [
    ["D001", "Where stock is kept", ["REQ-001"]],
    ["D002", "How the warning reaches the owner", ["REQ-002"]],
  ] as const) {
    unwrap(decidePropose({ root, now: tick, file: put(root, {
      title, type: "engineering", category: title.includes("stock") ? "database" : "notifications",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: reqs,
    })}));
    unwrap(decideConfirm({ root, now: tick, id, choice: "a", by: "user",
      rationale: "Because.", adrFile: put(root, "Reasoning.") }));
  }
  unwrap(architectureClose({ root, now: tick }));
  return root;
}

describe("a decision starts un-reviewed", () => {
  it("is not flagged when nothing has changed", () => {
    const root = locked();
    for (const d of decisions(root)) {
      expect(d.needs_review).toBe(false);
      expect(d.review_reason).toBeNull();
    }
  });
});

describe("a revision flags only the decisions it actually touched", () => {
  function revise(root: string) {
    unwrap(plan(root, {
      revision: { reason: "The owner decided the warning can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-002"], by: "user" },
                        confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));
  }

  it("flags the decision governing the changed requirement", () => {
    const root = locked();
    revise(root);
    const d002 = decisions(root).find((d) => d.id === "D002");
    expect(d002?.needs_review).toBe(true);
    expect(d002?.review_reason).toMatch(/REQ-002/);
  });

  it("leaves the untouched decision alone", () => {
    const root = locked();
    revise(root);
    expect(decisions(root).find((d) => d.id === "D001")?.needs_review).toBe(false);
  });

  it("does not unlock anything", () => {
    const root = locked();
    revise(root);
    for (const d of decisions(root)) expect(d.status).toBe("LOCKED");
  });

  it("names the flagged decisions in architecture status, not just the whole architecture", () => {
    const root = locked();
    revise(root);
    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.needs_review).toBe(true);
    expect(d.decisions_needing_review).toEqual(["D002"]);
    expect(d.next_step).toMatch(/D002/);
  });

  it("clears the flags when the architecture is agreed again", () => {
    const root = locked();
    revise(root);
    unwrap(architectureClose({ root, now: tick }));
    for (const d of decisions(root)) {
      expect(d.needs_review).toBe(false);
      expect(d.review_reason).toBeNull();
    }
  });

  it("flags nothing when a revision touches no governed requirement", () => {
    const root = locked();
    unwrap(plan(root, {
      revision: { reason: "Adding a persona we missed in the first pass.", by: "user" },
      personas: [{ name: "Assistant", description: "Serves customers.", goals: [] }],
    }));
    unwrap(plan(root, { confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));
    for (const d of decisions(root)) expect(d.needs_review).toBe(false);
  });
});

describe("a new requirement flags nothing, because nothing decided it yet", () => {
  it("leaves existing decisions unflagged when a requirement is added", () => {
    const root = locked();
    unwrap(discoverStart({ root, now: tick }));
    unwrap(discover(root, { requirements: [draft("Scan barcodes")] }));
    unwrap(discover(root, { confirm: { requirements: ["REQ-003"], by: "user" },
                            confirm_intent: { by: "user" } }));
    unwrap(discoverClose({ root, now: tick }));
    for (const d of decisions(root)) expect(d.needs_review).toBe(false);
  });
});
