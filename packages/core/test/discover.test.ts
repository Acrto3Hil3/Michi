import { describe, it, expect } from "vitest";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverStatus, discoverAnswer, discoverExport, discoverClose } from "../src/commands/discover.js";
import { readYaml } from "../src/fs/brain.js";
import { StateSchema } from "../src/schemas/state.js";

function ready(files: Record<string, string> = { "package.json": '{"name":"shop"}' }) {
  const root = tempProject(files);
  init({ root, now: clock });
  return root;
}

function update(root: string, payload: object) {
  const file = join(root, "update.json");
  writeFileSync(file, JSON.stringify(payload), "utf8");
  return discoverAnswer({ root, now: clock, file });
}

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

describe("discover start", () => {
  it("refuses before init", () => {
    const r = discoverStart({ root: tempProject(), now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_INITIALIZED");
  });

  it("opens the first session in STARTED", () => {
    const d = unwrap(discoverStart({ root: ready(), now: clock }));
    expect(d.session.session_id).toBe("SESSION-001");
    expect(d.session.status).toBe("STARTED");
    expect(d.resumed).toBe(false);
  });

  it("resumes the open session rather than opening a second", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const d = unwrap(discoverStart({ root, now: clock }));
    expect(d.session.session_id).toBe("SESSION-001");
    expect(d.resumed).toBe(true);
  });
});

describe("discover answer — validation", () => {
  it("refuses when no session is open", () => {
    const root = ready();
    const r = update(root, { answers: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("NOT_FOUND");
      expect(r.error.next).toMatch(/discover start/);
    }
  });

  it("refuses a file that is not valid JSON", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const file = join(root, "bad.json");
    writeFileSync(file, "{ nope", "utf8");
    const r = discoverAnswer({ root, now: clock, file });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses an answer with a confidence outside the vocabulary", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const r = update(root, {
      answers: [{ key: "users", value: "shop owner", confidence: "PRETTY_SURE", question: "Who?" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("REFUSES to confirm a requirement without naming who confirmed it", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    update(root, { requirements: [{ title: "T", description: "D", type: "functional", priority: "high", origin_confidence: "INFERRED", acceptance_criteria: ["a"] }] });
    const r = update(root, { confirm: { requirements: ["REQ-001"] } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_ERROR");
      expect(r.error.message.toLowerCase()).toMatch(/by/);
    }
  });

  it("refuses to confirm a requirement that does not exist", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const r = update(root, { confirm: { requirements: ["REQ-099"], by: "user" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });
});

describe("discover answer — recording", () => {
  it("records answers with their confidence and the question they came from", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const d = unwrap(update(root, {
      answers: [{ key: "shop_count", value: "one", confidence: "STATED", question: "One shop or several?" }],
    }));
    expect(d.session.answers).toHaveLength(1);
    expect(d.session.answers[0]?.confidence).toBe("STATED");
    expect(d.session.answers[0]?.question).toBe("One shop or several?");
    expect(d.session.status).toBe("GATHERING");
  });

  it("replaces an earlier answer to the same question rather than duplicating it", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    update(root, { answers: [{ key: "shop_count", value: "one", confidence: "ASSUMED", question: "How many?" }] });
    const d = unwrap(update(root, {
      answers: [{ key: "shop_count", value: "three", confidence: "STATED", question: "How many?" }],
    }));
    expect(d.session.answers).toHaveLength(1);
    expect(d.session.answers[0]?.value).toBe("three");
    expect(d.session.answers[0]?.confidence).toBe("STATED");
  });

  it("never upgrades an inference into something the user stated", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const d = unwrap(update(root, {
      intent: { problem: { value: "They lose track of stock", confidence: "INFERRED" } },
      answers: [{ key: "budget", value: "unknown", confidence: "ASSUMED", question: "Budget?" }],
    }));
    expect(d.session.intent.problem.confidence).toBe("INFERRED");
    expect(d.session.answers[0]?.confidence).toBe("ASSUMED");
    expect(d.session.intent.goal.confidence).toBe("UNKNOWN");
  });

  it("allocates stable question ids and resolves them on request", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const a = unwrap(update(root, { questions: [{ text: "Negative stock?", why: "Affects approval" }] }));
    expect(a.session.open_questions[0]?.id).toBe("Q-001");
    const b = unwrap(update(root, { resolve_questions: ["Q-001"] }));
    expect(b.session.open_questions).toHaveLength(0);
  });

  it("brings requirements in as PROPOSED, never confirmed", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const d = unwrap(update(root, {
      requirements: [{ title: "Manage products", description: "Add and edit products.", type: "functional", priority: "high", origin_confidence: "INFERRED", acceptance_criteria: ["can add"] }],
    }));
    expect(d.session.requirements[0]?.id).toBe("REQ-001");
    expect(d.session.requirements[0]?.status).toBe("PROPOSED");
    expect(d.session.requirements[0]?.confirmed_by).toBeNull();
  });

  it("confirms a requirement only when a human is named, keeping its origin", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    update(root, { requirements: [{ title: "T", description: "D", type: "functional", priority: "high", origin_confidence: "INFERRED", acceptance_criteria: ["a"] }] });
    const d = unwrap(update(root, { confirm: { requirements: ["REQ-001"], by: "user" } }));
    expect(d.session.requirements[0]?.status).toBe("CONFIRMED");
    expect(d.session.requirements[0]?.confirmed_by).toBe("user");
    expect(d.session.requirements[0]?.origin_confidence).toBe("INFERRED");
  });

  it("keeps rejected requirements instead of deleting them", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    update(root, { requirements: [{ title: "T", description: "D", type: "functional", priority: "low", origin_confidence: "INFERRED", acceptance_criteria: ["a"] }] });
    const d = unwrap(update(root, { reject: { requirements: ["REQ-001"], by: "user", reason: "Out of scope" } }));
    expect(d.session.requirements[0]?.status).toBe("REJECTED");
    expect(d.session.requirements[0]?.rejected_reason).toBe("Out of scope");
  });
});

describe("discover lifecycle", () => {
  const fullSession = (root: string) => {
    discoverStart({ root, now: clock });
    update(root, {
      intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
      requirements: [{ title: "Manage products", description: "D", type: "functional", priority: "high", origin_confidence: "STATED", acceptance_criteria: ["a"] }],
    });
    update(root, { confirm: { requirements: ["REQ-001"], by: "user" } });
  };

  it("reaches READY_FOR_CONFIRMATION once nothing is outstanding", () => {
    const root = ready();
    fullSession(root);
    expect(unwrap(discoverStatus({ root, now: clock })).session.status).toBe("READY_FOR_CONFIRMATION");
  });

  it("drops back to GATHERING when a new question opens", () => {
    const root = ready();
    fullSession(root);
    const d = unwrap(update(root, { questions: [{ text: "One more thing?", why: "It matters" }] }));
    expect(d.session.status).toBe("GATHERING");
  });

  it("only reaches CONFIRMED when the human confirms the intent", () => {
    const root = ready();
    fullSession(root);
    const d = unwrap(update(root, { confirm_intent: { by: "user" } }));
    expect(d.session.status).toBe("CONFIRMED");
    expect(d.session.intent_confirmed_by).toBe("user");
  });

  it("refuses to close a session the human has not confirmed", () => {
    const root = ready();
    fullSession(root);
    const r = discoverClose({ root, now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/confirm/i);
    }
  });

  it("closes a confirmed session, writing artifacts and advancing the stage", () => {
    const root = ready();
    fullSession(root);
    update(root, { confirm_intent: { by: "user" } });
    const d = unwrap(discoverClose({ root, now: clock }));

    expect(d.session.status).toBe("COMPLETED");
    expect(d.requirements_written).toBe(1);
    expect(existsSync(join(root, ".michi/requirements/requirements.yaml"))).toBe(true);
    expect(existsSync(join(root, ".michi/project/identity.md"))).toBe(true);

    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.stage).toBe("SPECIFICATION");
    expect(state.counts.requirements).toBe(1);
  });

  it("promotes only confirmed requirements", () => {
    const root = ready();
    fullSession(root);
    update(root, { requirements: [{ title: "Later", description: "D", type: "functional", priority: "low", origin_confidence: "INFERRED", acceptance_criteria: ["a"] }] });
    update(root, { reject: { requirements: ["REQ-002"], by: "user", reason: "later" } });
    update(root, { confirm_intent: { by: "user" } });
    const d = unwrap(discoverClose({ root, now: clock }));
    expect(d.requirements_written).toBe(1);
    const yaml = readFileSync(join(root, ".michi/requirements/requirements.yaml"), "utf8");
    expect(yaml).toContain("REQ-001");
    expect(yaml).not.toContain("REQ-002");
  });

  it("refuses to accept new answers into a closed session", () => {
    const root = ready();
    fullSession(root);
    update(root, { confirm_intent: { by: "user" } });
    discoverClose({ root, now: clock });
    const r = update(root, { answers: [{ key: "x", value: "y", confidence: "STATED", question: "?" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses to close twice", () => {
    const root = ready();
    fullSession(root);
    update(root, { confirm_intent: { by: "user" } });
    discoverClose({ root, now: clock });
    const r = discoverClose({ root, now: clock });
    expect(r.ok).toBe(false);
  });
});

describe("discover status and export", () => {
  it("separates what is known, assumed and still unknown", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    update(root, {
      intent: { problem: { value: "P", confidence: "STATED" }, users: { value: ["owner"], confidence: "INFERRED" } },
      questions: [{ text: "How many shops?", why: "scope" }],
    });
    const d = unwrap(discoverStatus({ root, now: clock }));
    expect(d.known).toContain("problem");
    expect(d.inferred).toContain("users");
    expect(d.unknown).toContain("goal");
    expect(d.open_questions).toHaveLength(1);
  });

  it("export never writes", () => {
    const root = ready();
    discoverStart({ root, now: clock });
    const before = readFileSync(join(root, ".michi/sessions/SESSION-001.yaml"), "utf8");
    const a = discoverExport({ root, now: clock });
    const b = discoverExport({ root, now: clock });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(readFileSync(join(root, ".michi/sessions/SESSION-001.yaml"), "utf8")).toBe(before);
  });
});
