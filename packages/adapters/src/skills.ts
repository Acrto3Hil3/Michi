import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Skill } from "./types.js";

/**
 * MICHI's own skills, read from `@dev-subhash/michi-skills`.
 *
 * They are plain Markdown and ship as-is. Nothing here rewrites a skill's
 * content: an adapter chooses where a skill goes and how it is framed, never
 * what it says.
 */

/**
 * Where the skills are, in a published install and in this repository.
 *
 * Resolving the package is the reliable answer and is tried first. The
 * relative path is the fallback that covers running from source, where
 * `packages/adapters/{src,dist}` sits beside `packages/skills`.
 */
function skillsDir(): string {
  const tried: string[] = [];
  try {
    const manifest = createRequire(import.meta.url).resolve("@dev-subhash/michi-skills/package.json");
    const dir = `${dirname(manifest)}/`;
    if (existsSync(dir)) return dir;
    tried.push(dir);
  } catch {
    tried.push("@dev-subhash/michi-skills (not resolvable from here)");
  }
  const beside = fileURLToPath(new URL("../../skills/", import.meta.url));
  if (existsSync(beside)) return beside;
  tried.push(beside);
  throw new Error(`MICHI's skills are missing — looked in ${tried.join(", ")}`);
}

function frontmatterValue(source: string, key: string): string {
  const block = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!block || !block[1]) return "";
  const lines = block[1].split("\n");
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (at < 0) return "";
  const first = (lines[at] ?? "").slice(key.length + 1).trim();
  if (first && first !== ">" && first !== "|") return first;
  const folded: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^[a-z_]+:/.test(line)) break;
    folded.push(line.trim());
  }
  return folded.join(" ").trim();
}

export function loadSkills(): Skill[] {
  const dir = skillsDir();
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "SKILL.md")))
    .map((e) => {
      const body = readFileSync(join(dir, e.name, "SKILL.md"), "utf8");
      return { name: e.name, description: frontmatterValue(body, "description"), body };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
