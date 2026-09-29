import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { decideList, decidePropose, decideConfirm, decideReject, decideShow, decideSupersede } from "../src/commands/decide.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

function ready() {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: clock });
  return root;
}

const PROPOSAL = {
  title: "How people log in",
  type: "engineering",
  category: "authentication",
  options: [
    { key: "managed", label: "A login service", explanation: "A company handles passwords for you.", tradeoffs: "Costs money once you have many users." },
    { key: "passwords", label: "Email and password", explanation: "You store passwords yourself.", tradeoffs: "You become responsible for keeping them safe." },
  ],
};

function propose(root: string, proposal: object = PROPOSAL) {
  const file = join(root, "proposal.json");
  writeFileSync(file, JSON.stringify(proposal), "utf8");
  return decidePropose({ root, now: clock, file });
}

function adr(root: string, body = "Because it removes most of the ways we could get this wrong.") {
  const file = join(root, "adr.md");
  writeFileSync(file, body, "utf8");
  return file;
}

describe("proposing", () => {
  it("refuses before init", () => {
    const root = tempProject();
    writeFileSync(join(root, "p.json"), JSON.stringify(PROPOSAL));
    const r = decidePropose({ root, now: clock, file: join(root, "p.json") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_INITIALIZED");
  });

  it("creates a PROPOSED decision with no choice and no ADR", () => {
    const root = ready();
    const d = unwrap(propose(root));
    expect(d.decision.id).toBe("D001");
    expect(d.decision.status).toBe("PROPOSED");
    expect(d.decision.selected_option).toBeNull();
    expect(d.decision.adr).toBeNull();
    expect(d.decision.approval).toBeNull();
  });

  it("allocates sequential decision ids", () => {
    const root = ready();
    propose(root);
    expect(unwrap(propose(root)).decision.id).toBe("D002");
  });

  it("refuses a proposal with fewer than two options", () => {
    const root = ready();
    const r = propose(root, { ...PROPOSAL, options: [PROPOSAL.options[0]] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a proposal whose options have no plain-language explanation", () => {
    const root = ready();
    const r = propose(root, {
      ...PROPOSAL,
      options: [{ key: "a", label: "A" }, { key: "b", label: "B" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("confirming", () => {
  it("locks a decision, records the approver, and writes the ADR", () => {
    const root = ready();
    propose(root);
    const d = unwrap(decideConfirm({
      root, now: clock, id: "D001", choice: "managed", by: "user",
      rationale: "Least security-sensitive code to maintain.", adrFile: adr(root),
    }));
    expect(d.decision.status).toBe("LOCKED");
    expect(d.decision.selected_option).toBe("managed");
    expect(d.decision.approval?.by).toBe("user");
    expect(d.decision.adr).toBe("ADR-001");
    expect(d.decision.adr_file).toBe("ADR-001-how-people-log-in.md");
    expect(existsSync(join(root, ".michi/decisions/ADR-001-how-people-log-in.md"))).toBe(true);
  });

  it("writes an ADR whose frontmatter names the decision and duplicates no state", () => {
    const root = ready();
    propose(root);
    decideConfirm({ root, now: clock, id: "D001", choice: "managed", by: "user", rationale: "R", adrFile: adr(root) });
    const text = readFileSync(join(root, ".michi/decisions/ADR-001-how-people-log-in.md"), "utf8");
    expect(text).toMatch(/^---/);
    expect(text).toMatch(/decision: D001/);
    expect(text).toMatch(/adr: ADR-001/);
    expect(text).not.toMatch(/status:/);
    expect(text).toContain("Because it removes most");
  });

  it("refuses a choice that was not among the options", () => {
    const root = ready();
    propose(root);
    const r = decideConfirm({ root, now: clock, id: "D001", choice: "smoke-signals", by: "user", rationale: "R", adrFile: adr(root) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses to confirm a decision that does not exist", () => {
    const root = ready();
    const r = decideConfirm({ root, now: clock, id: "D099", choice: "managed", by: "user", rationale: "R", adrFile: adr(root) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses to lock without an ADR", () => {
    const root = ready();
    propose(root);
    const r = decideConfirm({ root, now: clock, id: "D001", choice: "managed", by: "user", rationale: "R", adrFile: join(root, "missing.md") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });
});

describe("a locked decision cannot be silently changed", () => {
  const lock = (root: string) => {
    propose(root);
    decideConfirm({ root, now: clock, id: "D001", choice: "managed", by: "user", rationale: "R", adrFile: adr(root) });
  };

  it("refuses to re-confirm it with a different choice", () => {
    const root = ready();
    lock(root);
    const r = decideConfirm({ root, now: clock, id: "D001", choice: "passwords", by: "user", rationale: "changed my mind", adrFile: adr(root) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.next).toMatch(/supersede/i);
    }
  });

  it("refuses to reject it", () => {
    const root = ready();
    lock(root);
    const r = decideReject({ root, now: clock, id: "D001", reason: "no" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("supersedes it with a new locked decision, keeping both", () => {
    const root = ready();
    lock(root);
    propose(root, { ...PROPOSAL, title: "How people log in, revisited" });
    decideConfirm({ root, now: clock, id: "D002", choice: "passwords", by: "user", rationale: "Cheaper", adrFile: adr(root) });

    const d = unwrap(decideSupersede({ root, now: clock, id: "D001", withId: "D002" }));
    expect(d.superseded.status).toBe("SUPERSEDED");
    expect(d.superseded.superseded_by).toBe("D002");
    expect(d.replacement.supersedes).toBe("D001");

    const all = unwrap(decideList({ root, now: clock })).decisions;
    expect(all.map((x) => x.id)).toEqual(["D001", "D002"]);
    expect(existsSync(join(root, ".michi/decisions/ADR-001-how-people-log-in.md"))).toBe(true);
  });

  it("refuses to supersede with a decision that is not itself locked", () => {
    const root = ready();
    lock(root);
    propose(root, { ...PROPOSAL, title: "Second thoughts" });
    const r = decideSupersede({ root, now: clock, id: "D001", withId: "D002" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });
});

describe("rejecting and reading", () => {
  it("rejects a proposal, keeping it on the record", () => {
    const root = ready();
    propose(root);
    const d = unwrap(decideReject({ root, now: clock, id: "D001", reason: "Not needed yet" }));
    expect(d.decision.status).toBe("REJECTED");
    expect(d.decision.rejected_reason).toBe("Not needed yet");
    expect(unwrap(decideList({ root, now: clock })).decisions).toHaveLength(1);
  });

  it("shows a decision together with its ADR", () => {
    const root = ready();
    propose(root);
    decideConfirm({ root, now: clock, id: "D001", choice: "managed", by: "user", rationale: "R", adrFile: adr(root) });
    const d = unwrap(decideShow({ root, now: clock, id: "D001" }));
    expect(d.decision.id).toBe("D001");
    expect(d.adr_text).toContain("Because it removes most");
  });

  it("lists an empty registry without complaining", () => {
    expect(unwrap(decideList({ root: ready(), now: clock })).decisions).toEqual([]);
  });
});
