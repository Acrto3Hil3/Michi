import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLES, example, exampleNames } from "../src/commands/example.js";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { planUpdate } from "../src/commands/plan.js";
import { decidePropose } from "../src/commands/decide.js";

let t = 0;
const BASE = Date.parse("2026-10-13T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, name: string, body: unknown): string => {
  const p = join(root, `${name}.json`);
  writeFileSync(p, JSON.stringify(body), "utf8");
  return p;
};

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

describe("michi example", () => {
  it("covers every command that takes a --file", () => {
    for (const name of ["discover-answer", "plan-update", "decide-propose",
                        "task-report", "test-record", "review", "verify"]) {
      expect(exampleNames(), name).toContain(name);
    }
  });

  it("every example is accepted by the command it is an example of", () => {
    // The whole point, and tested against the real command rather than a
    // schema picked by hand: an example that does not work is worse than
    // none, because it sends the reader back around the loop they were
    // trying to escape.
    const root = tempProject({ "package.json": '{"name":"expenses"}' });
    init({ root, now: tick });

    unwrap(discoverStart({ root, now: tick }));
    unwrap(discoverAnswer({ root, now: tick,
      file: put(root, "d", EXAMPLES["discover-answer"]?.body) }));

    // The example's own note says confirming is a separate send. Follow it.
    unwrap(discoverAnswer({ root, now: tick, file: put(root, "c", {
      confirm: { requirements: ["REQ-001"], by: "subhash" },
      confirm_intent: { by: "subhash" },
    })}));

    unwrap(discoverClose({ root, now: tick }));

    unwrap(planUpdate({ root, now: tick,
      file: put(root, "p", { personas: (EXAMPLES["plan-update"]?.body as never as
        { personas: unknown[] }).personas }) }));

    unwrap(decidePropose({ root, now: tick,
      file: put(root, "x", EXAMPLES["decide-propose"]?.body) }));
  });

  it("prints a complete file, not a fragment", () => {
    const d = unwrap(example({ name: "discover-answer" }));
    expect(d.name).toBe("discover-answer");
    expect(d.what.length).toBeGreaterThan(20);
    const parsed = JSON.parse(d.json);
    expect(parsed.intent).toBeTruthy();
    expect(parsed.requirements[0].origin_confidence).toBeTruthy();
    expect(parsed.requirements[0].acceptance_criteria.length).toBeGreaterThan(0);
  });

  it("says which values are allowed where a field is a fixed set", () => {
    const d = unwrap(example({ name: "discover-answer" }));
    expect(d.notes.join(" ")).toMatch(/STATED/);
    expect(d.notes.join(" ")).toMatch(/INFERRED|ASSUMED/);
  });

  it("names what it knows when asked for something it does not have", () => {
    const r = example({ name: "nonsense" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/nonsense/);
      expect(JSON.stringify(r.error)).toMatch(/discover-answer/);
    }
  });

  it("needs no project — it is a reference, not a reading of state", () => {
    expect(unwrap(example({ name: "verify" })).json.length).toBeGreaterThan(10);
  });
});
