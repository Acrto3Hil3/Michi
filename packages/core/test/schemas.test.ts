import { describe, it, expect } from "vitest";
import { ConfigSchema, newConfig } from "../src/schemas/config.js";
import { StateSchema, newState, PROJECT_STAGES } from "../src/schemas/state.js";
import { ProjectMapSchema, unknownDetection } from "../src/schemas/scan.js";
import { SCHEMA_VERSION } from "../src/schemas/version.js";

const NOW = "2026-09-28T12:00:00.000Z";

describe("config schema", () => {
  it("accepts a freshly created config", () => {
    const c = newConfig({ projectId: "michi", projectName: "michi", now: NOW });
    expect(() => ConfigSchema.parse(c)).not.toThrow();
    expect(c.schema_version).toBe(SCHEMA_VERSION);
    expect(c.project.id).toBe("michi");
    expect(c.created_at).toBe(NOW);
  });

  it("ships a verification policy placeholder with an empty allow-list", () => {
    const c = newConfig({ projectId: "p", projectName: "p", now: NOW });
    expect(c.verification.allow).toEqual({});
    expect(c.policy.verification_execute).toBe("AUTO");
  });

  it("rejects an unknown policy value", () => {
    const c: any = newConfig({ projectId: "p", projectName: "p", now: NOW });
    c.policy.source_write = "SOMETIMES";
    expect(() => ConfigSchema.parse(c)).toThrow();
  });

  it("rejects a future schema version rather than guessing", () => {
    const c: any = newConfig({ projectId: "p", projectName: "p", now: NOW });
    c.schema_version = SCHEMA_VERSION + 1;
    expect(() => ConfigSchema.parse(c)).toThrow();
  });
});

describe("state schema", () => {
  it("starts a new project in DISCOVERY", () => {
    const s = newState({ projectId: "p", now: NOW });
    expect(() => StateSchema.parse(s)).not.toThrow();
    expect(s.stage).toBe("DISCOVERY");
    expect(s.initialized_at).toBe(NOW);
    expect(s.active_task).toBeNull();
    expect(s.last_scan).toBeNull();
  });

  it("knows the ten project stages from STATE_MODEL.md", () => {
    expect(PROJECT_STAGES).toEqual([
      "DISCOVERY", "SPECIFICATION", "ARCHITECTURE", "DESIGN", "PLANNING",
      "IMPLEMENTATION", "VALIDATION", "REVIEW", "RELEASE", "OPERATIONS",
    ]);
  });

  it("rejects a stage that is not in the contract", () => {
    const s: any = newState({ projectId: "p", now: NOW });
    s.stage = "VIBING";
    expect(() => StateSchema.parse(s)).toThrow();
  });
});

describe("project map schema", () => {
  it("represents an unknown detection honestly", () => {
    const d = unknownDetection("nothing in the repository indicates a database");
    expect(d.value).toBeNull();
    expect(d.confidence).toBe("UNKNOWN");
    expect(d.sources).toEqual([]);
    expect(d.note).toMatch(/database/);
  });

  it("requires every detection to name its confidence and sources", () => {
    const bad: any = {
      schema_version: SCHEMA_VERSION,
      generated_at: NOW,
      detections: { package_manager: { value: "pnpm" } },
      structure: { directories: [], config_files: [], entry_points: [] },
      stats: { files_considered: 0 },
    };
    expect(() => ProjectMapSchema.parse(bad)).toThrow();
  });
});
