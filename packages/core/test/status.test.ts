import { describe, it, expect } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { status } from "../src/commands/status.js";
import { discoverStart } from "../src/commands/discover.js";
import { readYaml, writeYaml } from "../src/fs/brain.js";
import { StateSchema, PROJECT_STAGES } from "../src/schemas/state.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};
const tick = clock;

describe("michi status", () => {
  it("says a project is not initialized, with the next step", () => {
    const r = status({ root: tempProject(), now: clock });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("NOT_INITIALIZED");
    expect(r.error.next).toMatch(/michi init/);
  });

  it("reports stage, identity and schema version from disk", () => {
    const root = tempProject({ "package.json": '{"name":"pharmacy"}', "pnpm-lock.yaml": "" });
    init({ root, now: clock });
    const r = status({ root, now: clock });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.initialized).toBe(true);
    expect(r.data.stage).toBe("DISCOVERY");
    expect(r.data.schema_version).toBe(1);
    expect(r.data.project.name).toBe("pharmacy");
    expect(r.data.current_milestone).toBeNull();
    expect(r.data.active_task).toBeNull();
    expect(r.data.last_scan?.at).toBe(NOW);
  });

  it("surfaces what needs the human", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const r = status({ root, now: clock });
    if (!r.ok) return;
    expect(Array.isArray(r.data.needs_you)).toBe(true);
    expect(r.data.needs_you.join(" ")).toMatch(/discover/i);
  });

  it("stops telling the user to start discovery once discovery is under way", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const before = status({ root, now: clock });
    if (!before.ok) throw new Error("expected ok");
    expect(before.data.needs_you.join(" ")).toMatch(/discover start/);

    discoverStart({ root, now: clock });
    const after = status({ root, now: clock });
    if (!after.ok) throw new Error("expected ok");
    expect(after.data.needs_you.join(" ")).not.toMatch(/discover start/);
    expect(after.data.needs_you.join(" ")).toMatch(/SESSION-001/);
    expect(after.data.discovery?.status).toBe("STARTED");
  });

  it("produces the same data twice — it never writes", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const a = status({ root, now: clock });
    const b = status({ root, now: clock });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("reports a corrupt state file as a validation error", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    writeFileSync(join(root, ".michi/state/state.yaml"), "stage: [unclosed\n");
    const r = status({ root, now: clock });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("still works when the project map is missing", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    rmSync(join(root, ".michi/project/map.json"));
    const r = status({ root, now: clock });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.detected).toBeNull();
  });
});

describe("status always answers 'what now'", () => {
  it("never goes silent, at any stage", () => {
    // The README and every skill point at `michi status` as the answer to
    // "what now". A stage where it says nothing strands the user — which is
    // exactly what a dogfood run of 0.1.1 hit at SPECIFICATION.
    const root = tempProject({ "package.json": '{"name":"x"}' });
    init({ root, now: tick });
    const statePath = join(root, ".michi/state/state.yaml");

    for (const stage of PROJECT_STAGES) {
      const state = readYaml(statePath, StateSchema);
      writeYaml(statePath, { ...state, stage });
      const data = unwrap(status({ root, now: tick }));
      expect(data.stage, stage).toBe(stage);
      expect(data.needs_you, `${stage} left the user with no next step`)
        .not.toHaveLength(0);
    }
  });

  it("names the command for the stage it is actually in", () => {
    const root = tempProject({ "package.json": '{"name":"x"}' });
    init({ root, now: tick });
    const statePath = join(root, ".michi/state/state.yaml");

    const expected: Record<string, RegExp> = {
      SPECIFICATION: /plan update|plan status/,
      ARCHITECTURE: /decide|architecture status/,
      PLANNING: /plan tasks|plan validate/,
      IMPLEMENTATION: /task next|task list/,
    };
    for (const [stage, pattern] of Object.entries(expected)) {
      const state = readYaml(statePath, StateSchema);
      writeYaml(statePath, { ...state, stage: stage as never });
      const items = unwrap(status({ root, now: tick })).needs_you.join(" ");
      expect(items, stage).toMatch(pattern);
    }
  });
});
