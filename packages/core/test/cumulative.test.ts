/**
 * OQ-007 — discovery is cumulative.
 *
 * Requirements are project-level and persistent; a later session adds to them
 * and supersedes explicitly. Nothing a previous session confirmed is ever
 * removed by closing a later one.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose, discoverStatus } from "../src/commands/discover.js";
import { status as statusCmd } from "../src/commands/status.js";
import { readYaml } from "../src/fs/brain.js";
import { RequirementsRegistrySchema } from "../src/schemas/discovery.js";
import { StateSchema } from "../src/schemas/state.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

function ready() {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: clock });
  return root;
}

let n = 0;
function send(root: string, update: object) {
  const f = join(root, `u${n++}.json`);
  writeFileSync(f, JSON.stringify(update), "utf8");
  return discoverAnswer({ root, now: clock, file: f });
}

const draft = (title: string, extra: object = {}) => ({
  title, description: `${title} description.`, type: "functional",
  priority: "high", origin_confidence: "STATED", acceptance_criteria: ["a criterion"],
  ...extra,
});

const registry = (root: string) =>
  readYaml(join(root, ".michi/requirements/requirements.yaml"), RequirementsRegistrySchema);

/** Run one complete session confirming the given requirement drafts. */
function session(root: string, drafts: object[], intent = true) {
  discoverStart({ root, now: clock });
  if (intent) {
    send(root, { intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } } });
  }
  const added = unwrap(send(root, { requirements: drafts })).applied.requirements_added;
  send(root, { confirm: { requirements: added, by: "user" } });
  send(root, { confirm_intent: { by: "user" } });
  return { added, closed: unwrap(discoverClose({ root, now: clock })) };
}

describe("requirement ids are project-wide", () => {
  it("continues numbering in a second session rather than restarting", () => {
    const root = ready();
    const first = session(root, [draft("Manage products"), draft("See current stock")]);
    expect(first.added).toEqual(["REQ-001", "REQ-002"]);

    const second = session(root, [draft("Record stock coming in")], false);
    expect(second.added).toEqual(["REQ-003"]);
  });

  it("spends a number on a proposal even when it is rejected", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const a = unwrap(send(root, { requirements: [draft("A thing")] })).applied.requirements_added;
    expect(a).toEqual(["REQ-001"]);
    send(root, { reject: { requirements: ["REQ-001"], by: "user", reason: "no" } });
    const b = unwrap(send(root, { requirements: [draft("Another thing")] })).applied.requirements_added;
    expect(b).toEqual(["REQ-002"]);
    expect(registry(root).next_requirement_id).toBe(3);
  });
});

describe("close merges rather than replaces", () => {
  it("keeps what an earlier session confirmed", () => {
    const root = ready();
    session(root, [draft("Manage products"), draft("See current stock")]);
    expect(registry(root).requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002"]);

    session(root, [draft("Warn before running out")], false);
    const after = registry(root);
    expect(after.requirements.map((r) => r.id)).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
    expect(after.requirements.every((r) => r.status === "CONFIRMED")).toBe(true);
  });

  it("records which session confirmed each requirement", () => {
    const root = ready();
    session(root, [draft("Manage products")]);
    session(root, [draft("See current stock")], false);
    const byId = new Map(registry(root).requirements.map((r) => [r.id, r.confirmed_in]));
    expect(byId.get("REQ-001")).toBe("SESSION-001");
    expect(byId.get("REQ-002")).toBe("SESSION-002");
  });

  it("counts only active requirements in project state", () => {
    const root = ready();
    session(root, [draft("Manage products"), draft("See current stock")]);
    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.counts.requirements).toBe(2);
  });
});

describe("supersession, not deletion", () => {
  it("replaces a requirement while keeping both", () => {
    const root = ready();
    session(root, [draft("Warn before running out")]);

    const second = session(root, [
      draft("Warn before running out, per location", { supersedes: "REQ-001" }),
    ], false);
    expect(second.added).toEqual(["REQ-002"]);

    const after = registry(root);
    const old = after.requirements.find((r) => r.id === "REQ-001");
    const now = after.requirements.find((r) => r.id === "REQ-002");
    expect(old?.status).toBe("SUPERSEDED");
    expect(old?.superseded_by).toBe("REQ-002");
    expect(now?.status).toBe("CONFIRMED");
    expect(now?.supersedes).toBe("REQ-001");

    // Both are still on the record.
    expect(after.requirements).toHaveLength(2);
    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.counts.requirements).toBe(1);
  });

  it("refuses to supersede something that was never confirmed", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const r = send(root, { requirements: [draft("A thing", { supersedes: "REQ-404" })] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });
});

describe("conflicting proposals are refused", () => {
  it("refuses a proposal whose title repeats an active requirement", () => {
    const root = ready();
    session(root, [draft("Manage products")]);

    discoverStart({ root, now: clock });
    const r = send(root, { requirements: [draft("Manage Products!")] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/REQ-001/);
      expect(r.error.next).toMatch(/supersedes/);
    }
  });

  it("allows the same title when the proposal declares what it replaces", () => {
    const root = ready();
    session(root, [draft("Manage products")]);
    discoverStart({ root, now: clock });
    const r = send(root, { requirements: [draft("Manage products", { supersedes: "REQ-001" })] });
    expect(r.ok).toBe(true);
  });

  it("refuses a duplicate of something confirmed earlier in the same session", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const added = unwrap(send(root, { requirements: [draft("Manage products")] })).applied.requirements_added;
    send(root, { confirm: { requirements: added, by: "user" } });
    const r = send(root, { requirements: [draft("manage  products")] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("does not block a title that only matches a superseded requirement", () => {
    const root = ready();
    session(root, [draft("Warn before running out")]);
    session(root, [draft("Warn differently", { supersedes: "REQ-001" })], false);
    discoverStart({ root, now: clock });
    const r = send(root, { requirements: [draft("Warn before running out")] });
    expect(r.ok).toBe(true);
  });
});

describe("a second session is ordinary", () => {
  it("can be started on a project already past discovery", () => {
    const root = ready();
    session(root, [draft("Manage products")]);
    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.stage).toBe("SPECIFICATION");

    const r = discoverStart({ root, now: clock });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.session.session_id).toBe("SESSION-002");
    expect(r.data.resumed).toBe(false);
    // Starting a session does not drag the project backwards.
    expect(readYaml(join(root, ".michi/state/state.yaml"), StateSchema).stage).toBe("SPECIFICATION");
  });

  it("surfaces a second open session in project status, whatever the stage", () => {
    const root = ready();
    session(root, [draft("Manage products")]);
    discoverStart({ root, now: clock });

    const st = unwrap(statusCmd({ root, now: clock }));
    expect(st.stage).toBe("SPECIFICATION");
    expect(st.discovery?.session_id).toBe("SESSION-002");
    expect(st.needs_you.join(" ")).toMatch(/SESSION-002/);
  });

  it("tells a new session how much the project already knows", () => {
    const root = ready();
    const first = unwrap(discoverStart({ root, now: clock }));
    expect(first.existing_requirements).toBe(0);

    discoverClose({ root, now: clock });   // refused; session still open
    session(root, [draft("Manage products"), draft("See current stock")], false);

    const second = unwrap(discoverStart({ root, now: clock }));
    expect(second.session.session_id).toBe("SESSION-002");
    expect(second.existing_requirements).toBe(2);
  });

  it("reports what a close superseded", () => {
    const root = ready();
    session(root, [draft("Warn before running out")]);
    const second = session(root, [draft("Warn per location", { supersedes: "REQ-001" })], false);
    expect(second.closed.superseded).toEqual([{ old: "REQ-001", by: "REQ-002" }]);
    expect(second.closed.requirements_written).toBe(1);
    expect(second.closed.requirements_total).toBe(1);
  });

  it("leaves a completed session untouched when a later one closes", () => {
    const root = ready();
    session(root, [draft("Manage products")]);
    const first = readFileSync(join(root, ".michi/sessions/SESSION-001.yaml"), "utf8");
    session(root, [draft("See current stock")], false);
    expect(readFileSync(join(root, ".michi/sessions/SESSION-001.yaml"), "utf8")).toBe(first);
  });

  it("holds the invariant that a completed session has no open questions", () => {
    // OQ-007 question 7: carry-forward is unreachable precisely because of
    // this. If this ever fails, carry-forward must be implemented.
    const root = ready();
    session(root, [draft("Manage products")]);
    const s = unwrap(discoverStatus({ root: (discoverStart({ root, now: clock }), root), now: clock }));
    expect(s.session.open_questions).toEqual([]);
    const completed = readFileSync(join(root, ".michi/sessions/SESSION-001.yaml"), "utf8");
    expect(completed).toMatch(/open_questions:\s*\[\]/);
  });
});
