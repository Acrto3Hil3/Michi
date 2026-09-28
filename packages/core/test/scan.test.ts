import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { scan } from "../src/commands/scan.js";
import { readYaml } from "../src/fs/brain.js";
import { StateSchema } from "../src/schemas/state.js";

describe("michi scan", () => {
  it("refuses to run before init, and says what to do", () => {
    const r = scan({ root: tempProject(), now: clock });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("NOT_INITIALIZED");
    expect(r.error.next).toMatch(/michi init/);
  });

  it("writes the project map and records the scan in state", () => {
    const root = tempProject({ "package.json": '{"name":"a"}', "pnpm-lock.yaml": "" });
    init({ root, now: clock });
    const r = scan({ root, now: clock });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.map.detections.package_manager.value).toBe("pnpm");
    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.last_scan?.at).toBe(NOW);
    expect(state.last_scan?.project_map_hash).toBe(r.data.hash);
  });

  it("does not count MICHI's own folder as a change to the project", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    const created = init({ root, now: clock });
    expect(created.ok).toBe(true);
    // .michi/ appeared between init and this scan. It is MICHI's own
    // bookkeeping, not a change to the user's project.
    const r = scan({ root, now: clock });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.changed).toBe(false);
  });

  it("is repeatable: a second scan of an unchanged project changes nothing", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const first = scan({ root, now: clock });
    const mapAfterFirst = readFileSync(join(root, ".michi/project/map.json"), "utf8");
    const stateAfterFirst = readFileSync(join(root, ".michi/state/state.yaml"), "utf8");

    const second = scan({ root, now: clock });
    expect(second.ok && first.ok && second.data.hash).toBe(first.ok && first.data.hash);
    expect(readFileSync(join(root, ".michi/project/map.json"), "utf8")).toBe(mapAfterFirst);
    expect(readFileSync(join(root, ".michi/state/state.yaml"), "utf8")).toBe(stateAfterFirst);
    expect(second.ok && second.data.changed).toBe(false);
  });

  it("notices a real change and says so", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const first = scan({ root, now: clock });
    writeFileSync(join(root, "package.json"), '{"name":"a","dependencies":{"react":"18"}}');
    const second = scan({ root, now: clock });
    expect(second.ok && second.data.changed).toBe(true);
    expect(second.ok && second.data.hash).not.toBe(first.ok && first.data.hash);
    expect(second.ok && second.data.map.detections.frameworks.value).toEqual(["React"]);
  });

  it("reports corrupt state rather than overwriting it", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const statePath = join(root, ".michi/state/state.yaml");
    writeFileSync(statePath, "stage: NONSENSE\n");
    const r = scan({ root, now: clock });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION_ERROR");
    expect(readFileSync(statePath, "utf8")).toBe("stage: NONSENSE\n");
  });
});
