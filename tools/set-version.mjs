/**
 * Set one version across every package that has one.
 *
 * There are six places a version lives — five manifests and identity.ts,
 * which is what the CLI actually reports. Bumping them by hand is how they
 * drift, and the extension carrying a copy of the CLI makes drift invisible
 * rather than merely untidy.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: pnpm version:set <x.y.z>");
  process.exit(1);
}

for (const pkg of ["core", "cli", "adapters", "skills", "vscode"]) {
  const at = join(repo, "packages", pkg, "package.json");
  const json = JSON.parse(readFileSync(at, "utf8"));
  json.version = version;
  writeFileSync(at, `${JSON.stringify(json, null, 2)}\n`);
}

const identity = join(repo, "packages", "core", "src", "identity.ts");
writeFileSync(identity,
  readFileSync(identity, "utf8").replace(/version: "[\d.]+[\w.-]*"/, `version: "${version}"`));

console.log(`set ${version} across 5 packages and identity.ts`);
console.log("next: update CHANGELOG.md, then pnpm release");
