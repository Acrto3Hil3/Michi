import { describe, it, expect } from "vitest";
import { resolveCli, describeSource } from "../src/resolve.js";

const never = () => false;
const always = () => true;

describe("finding a michi to run, without making the user install one", () => {
  const bundled = "/ext/dist/cli/michi.mjs";

  it("uses the bundled copy when nothing else is available", () => {
    const found = resolveCli({ setting: "", onPath: never, bundled });
    expect(found.source).toBe("bundled");
    expect(found.command).toMatch(/node|execPath/i);
    expect(found.args).toContain(bundled);
  });

  it("prefers a michi the user installed themselves", () => {
    // Someone who ran `npm install -g` has opinions about which version runs.
    // Quietly using the bundled one instead would surprise them, and they are
    // the one who would then be debugging the difference.
    const found = resolveCli({ setting: "", onPath: always, bundled });
    expect(found.source).toBe("path");
    expect(found.command).toBe("michi");
    expect(found.args).toEqual([]);
  });

  it("prefers an explicit setting over everything", () => {
    const found = resolveCli({ setting: "/opt/michi", onPath: always, bundled });
    expect(found.source).toBe("setting");
    expect(found.command).toBe("/opt/michi");
  });

  it("ignores a setting that is only the default placeholder", () => {
    const found = resolveCli({ setting: "michi", onPath: never, bundled });
    expect(found.source).toBe("bundled");
  });

  it("runs the bundle on the editor's own Node, so none need installing", () => {
    const found = resolveCli({ setting: "", onPath: never, bundled, execPath: "/Applications/Code" });
    expect(found.command).toBe("/Applications/Code");
    expect(found.env?.ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("says which one it picked, in words a person can act on", () => {
    expect(describeSource("bundled")).toMatch(/built in|included/i);
    expect(describeSource("path")).toMatch(/installed/i);
    expect(describeSource("setting")).toMatch(/michi\.path|setting/i);
  });
});
