import { describe, it, expect } from "vitest";
import { compareVersions, cliNeedsUpdate, MINIMUM_CLI } from "../src/version.js";

describe("comparing versions without a dependency for it", () => {
  it("orders the ordinary cases", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("0.1.9", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0);
  });

  it("compares numbers as numbers, not as text", () => {
    // "0.10.0" < "0.9.0" is the classic string-sort bug.
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "0.100.0")).toBeGreaterThan(0);
  });

  it("treats a missing part as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.1")).toBeLessThan(0);
  });

  it("ignores a prerelease suffix rather than choking on it", () => {
    expect(compareVersions("0.2.0-beta.1", "0.2.0")).toBe(0);
  });
});

describe("deciding whether the CLI is too old for this extension", () => {
  it("is satisfied by the minimum, and by anything newer", () => {
    expect(cliNeedsUpdate(MINIMUM_CLI)).toBe(false);
    expect(cliNeedsUpdate("9.0.0")).toBe(false);
  });

  it("asks for an update when the CLI is behind", () => {
    expect(cliNeedsUpdate("0.1.2")).toBe(true);
  });

  it("says nothing when it cannot read a version", () => {
    // An unreadable version is not evidence of an old one. Nagging someone
    // about an upgrade they may not need is worse than staying quiet (P9).
    expect(cliNeedsUpdate(undefined)).toBe(false);
    expect(cliNeedsUpdate("")).toBe(false);
    expect(cliNeedsUpdate("not a version")).toBe(false);
  });
});
