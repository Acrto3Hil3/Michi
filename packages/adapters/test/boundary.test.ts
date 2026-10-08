import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "A `grep` for an agent's name outside `adapters/` should return nothing, and
 * that is worth enforcing in CI" — AGENT_ADAPTER_MODEL.md.
 *
 * This is that CI check. Vendor conditionals spread quietly and are miserable
 * to remove later, so the time to catch one is the commit that adds it.
 */

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));

/** Whole words only: "roo" is also the end of "projectRoot". */
const AGENT_NAMES = [
  "claude-code", "cursor", "codex", "gemini", "copilot",
  "windsurf", "cline", "roorules", "aider",
].map((name) => ({ name, pattern: new RegExp(`\\b${name.replace(".", "\\.")}\\b`, "i") }));

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const at = join(dir, entry);
    if (statSync(at).isDirectory()) sources(at, out);
    else if (at.endsWith(".ts")) out.push(at);
  }
  return out;
}

describe("the adapter boundary", () => {
  it("keeps every agent name inside packages/adapters", () => {
    const leaks: string[] = [];
    for (const file of sources(PACKAGES)) {
      const relative = file.slice(PACKAGES.length);
      // The adapters package is where agent names belong; tests may name an
      // agent to prove behaviour, which is not a branch in shipped code.
      if (relative.startsWith("adapters/src/")) continue;
      if (relative.includes("/test/")) continue;

      const body = readFileSync(file, "utf8");
      for (const { name, pattern } of AGENT_NAMES) {
        if (pattern.test(body)) leaks.push(`${relative}: "${name}"`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps Core from importing the adapters at all", () => {
    for (const file of sources(join(PACKAGES, "core", "src"))) {
      expect(readFileSync(file, "utf8"), file).not.toContain("@subhashyadav98146/michi-adapters");
    }
  });

  it("keeps the adapters out of Core and out of project state", () => {
    for (const file of sources(join(PACKAGES, "adapters", "src"))) {
      const body = readFileSync(file, "utf8");
      // Adapters may *tell an agent* about .michi/config.yaml — that is a
      // sentence in a document. What they may not do is read or write it, so
      // the check is on the import, and the planned paths are checked in
      // adapters.test.ts ("never into .michi").
      expect(body, file).not.toContain("@subhashyadav98146/michi-core");
      expect(body, file).not.toMatch(/(read|write)[A-Za-z]*\([^)]*\.michi/);
    }
  });

  it("keeps the adapters offline and model-free", () => {
    for (const file of sources(join(PACKAGES, "adapters", "src"))) {
      const body = readFileSync(file, "utf8");
      for (const forbidden of ["node:http", "node:https", "fetch(", "node:child_process",
                               "anthropic", "openai", "api_key", "apiKey"]) {
        expect(body.toLowerCase(), `${file} must not use ${forbidden}`)
          .not.toContain(forbidden.toLowerCase());
      }
    }
  });
});
