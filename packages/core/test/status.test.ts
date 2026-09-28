import { describe, it, expect } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { status } from "../src/commands/status.js";

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
