import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tempProject, NOW } from "./helpers.js";
import { brainDir, isInitialized, readYaml, writeYaml, BRAIN_DIRS } from "../src/fs/brain.js";
import { StateSchema, newState } from "../src/schemas/state.js";
import { MichiError } from "../src/errors.js";

describe("brain paths", () => {
  it("puts project state in .michi/ and nowhere else", () => {
    const root = tempProject();
    expect(brainDir(root)).toBe(join(root, ".michi"));
  });

  it("reports an uninitialized project", () => {
    expect(isInitialized(tempProject())).toBe(false);
  });

  it("lists the directories from STATE_MODEL.md", () => {
    expect(BRAIN_DIRS).toContain("decisions");
    expect(BRAIN_DIRS).toContain("requirements");
    expect(BRAIN_DIRS).toContain("tasks/active");
    expect(BRAIN_DIRS).toContain("tasks/completed");
    expect(BRAIN_DIRS).toContain("context/packets");
    expect(BRAIN_DIRS).toContain("state");
  });
});

describe("validated yaml round-trip", () => {
  it("writes and reads back an identical record", () => {
    const root = tempProject();
    const file = join(root, "state.yaml");
    const state = newState({ projectId: "p", now: NOW });
    writeYaml(file, state);
    expect(readYaml(file, StateSchema)).toEqual(state);
  });

  it("writes atomically, leaving no temporary files behind", () => {
    const root = tempProject();
    const file = join(root, "state.yaml");
    writeYaml(file, newState({ projectId: "p", now: NOW }));
    const { readdirSync } = require("node:fs");
    expect(readdirSync(root).filter((f: string) => f.includes("tmp"))).toEqual([]);
  });

  it("refuses a file that is not valid YAML", () => {
    const root = tempProject();
    const file = join(root, "state.yaml");
    writeFileSync(file, "this: [is: not: yaml", "utf8");
    try {
      readYaml(file, StateSchema);
      throw new Error("should have thrown");
    } catch (e) {
      const err = MichiError.from(e);
      expect(err.payload.code).toBe("VALIDATION_ERROR");
      expect(err.exitCode).toBe(4);
    }
  });

  it("refuses a well-formed file that fails the schema", () => {
    const root = tempProject();
    const file = join(root, "state.yaml");
    writeFileSync(file, "schema_version: 1\nstage: VIBING\n", "utf8");
    try {
      readYaml(file, StateSchema);
      throw new Error("should have thrown");
    } catch (e) {
      const err = MichiError.from(e);
      expect(err.payload.code).toBe("VALIDATION_ERROR");
      expect(err.payload.message).toMatch(/state\.yaml/);
      expect(err.payload.detail).toBeDefined();
    }
  });

  it("refuses a schema version it does not understand rather than guessing", () => {
    const root = tempProject();
    const file = join(root, "state.yaml");
    const state: any = newState({ projectId: "p", now: NOW });
    state.schema_version = 99;
    writeFileSync(file, `schema_version: 99\n`, "utf8");
    expect(() => readYaml(file, StateSchema)).toThrow();
  });

  it("reports a missing file as NOT_FOUND, not as corruption", () => {
    const root = tempProject();
    try {
      readYaml(join(root, "absent.yaml"), StateSchema);
      throw new Error("should have thrown");
    } catch (e) {
      expect(MichiError.from(e).payload.code).toBe("NOT_FOUND");
    }
  });
});
