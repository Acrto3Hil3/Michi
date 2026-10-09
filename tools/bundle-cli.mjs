/**
 * Put the CLI inside the extension.
 *
 * The point is that installing the extension is the only thing a person has
 * to do. No `npm install -g`, and no Node on the machine either — the bundle
 * runs on the Node the editor already ships.
 *
 * The skills are copied rather than bundled because they are Markdown that
 * the adapters read from disk, and the layout matters: `dist/cli/michi.mjs`
 * resolves `../../skills/`, which is `<extension>/skills/`.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const ext = join(repo, "packages", "vscode");

const esbuild = readdirSync(join(repo, "node_modules", ".pnpm"))
  .filter((d) => d.startsWith("esbuild@"))
  .map((d) => join(repo, "node_modules", ".pnpm", d, "node_modules", "esbuild", "bin", "esbuild"))
  .find((p) => existsSync(p));
if (!esbuild) throw new Error("esbuild not found — run pnpm install");

mkdirSync(join(ext, "dist", "cli"), { recursive: true });
execFileSync(process.execPath, [
  esbuild,
  join(repo, "packages", "cli", "src", "index.ts"),
  "--bundle", "--platform=node", "--format=esm", "--target=node20", "--minify",
  `--outfile=${join(ext, "dist", "cli", "michi.mjs")}`,
  // commander is CommonJS and calls require(); an ESM bundle has to supply one.
  "--banner:js=import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
], { stdio: "inherit" });

const skills = join(ext, "skills");
rmSync(skills, { recursive: true, force: true });
mkdirSync(skills, { recursive: true });
for (const name of readdirSync(join(repo, "packages", "skills"))) {
  const from = join(repo, "packages", "skills", name, "SKILL.md");
  if (!existsSync(from)) continue;
  mkdirSync(join(skills, name), { recursive: true });
  cpSync(from, join(skills, name, "SKILL.md"));
}

const size = statSync(join(ext, "dist", "cli", "michi.mjs")).size;
console.log(`bundled michi.mjs — ${Math.round(size / 1024)} KB, ${readdirSync(skills).length} skills`);
