import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock, NOW } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { ConfigSchema } from "../src/schemas/config.js";
import { StateSchema } from "../src/schemas/state.js";
import { readYaml } from "../src/fs/brain.js";

const run = (root: string, opts: object = {}) => init({ root, now: clock, ...opts });

describe("michi init", () => {
  it("creates .michi/ with the contract's directory tree", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    const r = run(root);
    expect(r.ok).toBe(true);
    for (const d of ["project", "requirements", "architecture", "decisions",
                     "graph", "tasks/active", "tasks/completed",
                     "context/packets", "sessions", "state"]) {
      expect(existsSync(join(root, ".michi", d))).toBe(true);
    }
  });

  it("writes a valid config and a valid state", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    run(root);
    const cfg = readYaml(join(root, ".michi/config.yaml"), ConfigSchema);
    const st = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(cfg.project.name).toBe("shop");
    expect(st.stage).toBe("DISCOVERY");
    expect(st.initialized_at).toBe(NOW);
    expect(st.project_id).toBe(cfg.project.id);
  });

  it("records an initial project map from the repository", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    const r = run(root);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(existsSync(join(root, ".michi/project/map.json"))).toBe(true);
    expect(r.data.scan.detections.package_manager.confidence).not.toBe("DETECTED");
  });

  it("takes the project name from package.json when present", () => {
    const root = tempProject({ "package.json": '{"name":"pharmacy-app"}' });
    const r = run(root);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.project.name).toBe("pharmacy-app");
  });

  it("falls back to the directory name when there is no manifest", () => {
    const root = tempProject();
    const r = run(root);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.project.name).toBe(root.split("/").pop());
  });

  it("does not modify application source code", () => {
    const root = tempProject({
      "package.json": '{"name":"shop"}',
      "src/index.ts": "export const x = 1;\n",
      "README.md": "# shop\n",
    });
    const before = new Map(
      ["package.json", "src/index.ts", "README.md"].map((f) => [f, readFileSync(join(root, f), "utf8")]),
    );
    run(root);
    for (const [f, content] of before) {
      expect(readFileSync(join(root, f), "utf8")).toBe(content);
    }
    expect(readdirSync(root).sort()).toEqual([".michi", "README.md", "package.json", "src"]);
  });

  it("refuses to initialize twice and changes nothing", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    run(root);
    const first = readFileSync(join(root, ".michi/state/state.yaml"), "utf8");

    const second = run(root);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("ALREADY_INITIALIZED");
    expect(second.error.next).toMatch(/michi status/);
    expect(readFileSync(join(root, ".michi/state/state.yaml"), "utf8")).toBe(first);
  });

  it("--force restores a missing file without overwriting one that has content", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    run(root);
    const statePath = join(root, ".michi/state/state.yaml");
    writeFileSync(statePath, readFileSync(statePath, "utf8").replace("DISCOVERY", "PLANNING"), "utf8");
    require("node:fs").rmSync(join(root, ".michi/config.yaml"));

    const r = run(root, { force: true });
    expect(r.ok).toBe(true);
    expect(existsSync(join(root, ".michi/config.yaml"))).toBe(true);
    expect(readFileSync(statePath, "utf8")).toContain("PLANNING");
  });

  it("--dry-run reports the plan and writes nothing at all", () => {
    const root = tempProject({ "package.json": '{"name":"shop"}' });
    const r = run(root, { dryRun: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.dry_run).toBe(true);
    expect(r.data.created).toContain("config.yaml");
    expect(r.data.created).toContain("state/state.yaml");
    expect(existsSync(join(root, ".michi"))).toBe(false);
    expect(readdirSync(root).sort()).toEqual(["package.json"]);
  });

  it("refuses a path that is not a directory", () => {
    const root = tempProject({ "afile.txt": "x" });
    const r = init({ root: join(root, "afile.txt"), now: clock });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("USAGE_ERROR");
  });

  it("refuses to initialize the home directory or the filesystem root", () => {
    for (const dangerous of [require("node:os").homedir(), "/"]) {
      const r = init({ root: dangerous, now: clock });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.error.code).toBe("BLOCKED");
    }
  });
});
