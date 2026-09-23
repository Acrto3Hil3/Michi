#!/usr/bin/env node
/**
 * phaseforge CLI
 *
 * Installs the phaseforge commands and skills into a project's .claude/
 * directory, and optionally scaffolds the docs/ structure.
 *
 * Usage:
 *   npx phaseforge init          install commands + skills into ./.claude
 *   npx phaseforge init --global install into ~/.claude (all projects)
 *   npx phaseforge init --docs   also scaffold docs/ templates
 *   npx phaseforge status        show what's installed
 *   npx phaseforge uninstall     remove installed phaseforge files
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const cmd = args[0];
const has = (f) => args.includes(f);

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
};

// npm postinstall runs this — print a hint, never mutate the user's project.
if (has("--postinstall-hint")) {
  console.log(`\n${c.b("phaseforge")} installed. Set it up in a project:\n\n  ${c.g("npx phaseforge init")}\n`);
  process.exit(0);
}

function targetRoot() {
  return has("--global") ? join(homedir(), ".claude") : join(process.cwd(), ".claude");
}

/** Copy a directory's children, skipping files that already exist. */
function copyTree(from, to) {
  if (!existsSync(from)) return { copied: [], skipped: [] };
  mkdirSync(to, { recursive: true });
  const copied = [];
  const skipped = [];

  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dest = join(to, entry);

    if (statSync(src).isDirectory()) {
      const r = copyTree(src, dest);
      copied.push(...r.copied);
      skipped.push(...r.skipped);
      continue;
    }
    if (existsSync(dest)) {
      skipped.push(dest);
      continue;
    }
    cpSync(src, dest);
    copied.push(dest);
  }
  return { copied, skipped };
}

function rel(p) {
  return p.replace(process.cwd() + "/", "").replace(homedir(), "~");
}

function init() {
  const root = targetRoot();
  const scope = has("--global") ? "globally (~/.claude)" : `in this project (${rel(root)})`;

  console.log(`\n${c.b("phaseforge")} — installing ${scope}\n`);

  const results = [
    ["commands", copyTree(join(PKG_ROOT, "commands"), join(root, "commands"))],
    ["skills", copyTree(join(PKG_ROOT, "skills"), join(root, "skills"))],
  ];

  if (has("--docs")) {
    const docsRoot = join(process.cwd(), "docs");
    results.push(["docs", copyTree(join(PKG_ROOT, "templates"), docsRoot)]);
  }

  let totalCopied = 0;
  let totalSkipped = 0;

  for (const [label, r] of results) {
    totalCopied += r.copied.length;
    totalSkipped += r.skipped.length;
    console.log(`  ${c.g("✓")} ${label.padEnd(10)} ${r.copied.length} installed${r.skipped.length ? c.dim(`, ${r.skipped.length} already present (left alone)`) : ""}`);
  }

  console.log(`\n${c.b("Next:")}`);
  if (!has("--docs")) {
    console.log(`  Run ${c.g("/gsd-init")} in Claude Code to scaffold docs and write your constitution.`);
  } else {
    console.log(`  Edit ${c.g("docs/ENGINEERING-CONSTITUTION.md")} — make it yours.`);
    console.log(`  Then run ${c.g("/gsd-init")} to fill the templates with this project's real details.`);
  }
  console.log(`  Then: ${c.g("/gsd-discuss <phase>")} → ${c.g("/gsd-plan")} → ${c.g("/gsd-execute")} → ${c.g("/gsd-verify")}\n`);

  if (totalSkipped > 0) {
    console.log(c.dim(`  ${totalSkipped} existing file(s) were left untouched. Nothing was overwritten.\n`));
  }
  if (totalCopied === 0) {
    console.log(c.y("  Everything was already installed — nothing to do.\n"));
  }
}

function status() {
  for (const root of [join(process.cwd(), ".claude"), join(homedir(), ".claude")]) {
    const commands = join(root, "commands");
    const skills = join(root, "skills");
    const found = [];

    if (existsSync(commands)) {
      found.push(...readdirSync(commands).filter((f) => f.startsWith("gsd-")));
    }
    const ourSkills = ["senior-engineer", "requirement-analyst", "architecture-memory"]
      .filter((s) => existsSync(join(skills, s)));

    console.log(`\n${c.b(rel(root))}`);
    console.log(`  commands: ${found.length ? c.g(found.join(", ")) : c.dim("none")}`);
    console.log(`  skills:   ${ourSkills.length ? c.g(ourSkills.join(", ")) : c.dim("none")}`);
  }
  console.log("");
}

function uninstall() {
  const root = targetRoot();
  const removed = [];

  const commandsDir = join(root, "commands");
  if (existsSync(commandsDir)) {
    for (const f of readdirSync(commandsDir).filter((f) => f.startsWith("gsd-"))) {
      rmSync(join(commandsDir, f));
      removed.push(join(commandsDir, f));
    }
  }
  for (const s of ["senior-engineer", "requirement-analyst", "architecture-memory"]) {
    const p = join(root, "skills", s);
    if (existsSync(p)) {
      rmSync(p, { recursive: true });
      removed.push(p);
    }
  }

  console.log(`\n${c.b("phaseforge")} — removed ${removed.length} file(s) from ${rel(root)}`);
  console.log(c.dim("  Your docs/ folder was not touched — that's your project's content.\n"));
}

switch (cmd) {
  case "init":
    init();
    break;
  case "status":
    status();
    break;
  case "uninstall":
    uninstall();
    break;
  default:
    console.log(`
${c.b("phaseforge")} — senior engineering discipline for AI coding sessions

  ${c.g("npx phaseforge init")}             install into this project's .claude/
  ${c.g("npx phaseforge init --docs")}      also scaffold docs/ templates
  ${c.g("npx phaseforge init --global")}    install into ~/.claude for every project
  ${c.g("npx phaseforge status")}           show what's installed
  ${c.g("npx phaseforge uninstall")}        remove phaseforge files

Docs: https://github.com/Acrto3Hil3/phaseforge
`);
}
