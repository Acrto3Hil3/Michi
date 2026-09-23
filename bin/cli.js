#!/usr/bin/env node
/**
 * phaseforge — your engineering team, installed into your project.
 *
 *   npx phaseforge init            set up in this project
 *   npx phaseforge init --agent=X  target a specific AI agent
 *   npx phaseforge status          what's installed
 *   npx phaseforge uninstall       remove it
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (f) => argv.includes(f);
const flag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : null;
};

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  cy: (s) => `\x1b[36m${s}\x1b[0m`,
};

if (has("--postinstall-hint")) {
  console.log(`\n${c.b("phaseforge")} installed.\n\n  Set it up in your project:  ${c.g("npx phaseforge init")}\n`);
  process.exit(0);
}

/**
 * Where each supported agent reads its instructions from.
 * AGENTS.md is the cross-agent standard and is always written.
 */
const AGENTS = {
  claude: { label: "Claude Code", instructions: "CLAUDE.md", commands: ".claude/commands", skills: ".claude/skills" },
  codex: { label: "Codex", instructions: "AGENTS.md" },
  cursor: { label: "Cursor", instructions: ".cursor/rules/phaseforge.mdc" },
  antigravity: { label: "Antigravity", instructions: "AGENTS.md" },
  copilot: { label: "GitHub Copilot", instructions: ".github/copilot-instructions.md" },
  windsurf: { label: "Windsurf", instructions: ".windsurfrules" },
  gemini: { label: "Gemini CLI", instructions: "GEMINI.md" },
};

function copyTree(from, to, out = { copied: [], skipped: [] }) {
  if (!existsSync(from)) return out;
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dest = join(to, entry);
    if (statSync(src).isDirectory()) {
      copyTree(src, dest, out);
    } else if (existsSync(dest)) {
      out.skipped.push(dest);
    } else {
      cpSync(src, dest);
      out.copied.push(dest);
    }
  }
  return out;
}

function writeIfMissing(path, content, out) {
  if (existsSync(path)) {
    out.skipped.push(path);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  out.copied.push(path);
}

function init() {
  const cwd = process.cwd();
  const global = has("--global");
  const root = global ? join(homedir(), ".claude") : cwd;
  const requested = flag("agent");
  const targets = requested ? [requested] : Object.keys(AGENTS);

  if (requested && !AGENTS[requested]) {
    console.log(`\n${c.y("Unknown agent:")} ${requested}`);
    console.log(`Supported: ${Object.keys(AGENTS).join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n${c.b("phaseforge")} — installing your engineering team\n`);

  const out = { copied: [], skipped: [] };
  const agentsMd = readFileSync(join(PKG, "templates", "AGENTS.md"), "utf8");

  if (global) {
    // Global install: Claude Code commands + skills for every project.
    copyTree(join(PKG, "commands"), join(root, "commands"), out);
    copyTree(join(PKG, "skills"), join(root, "skills"), out);
    console.log(`  ${c.g("✓")} Installed globally to ${c.dim("~/.claude")} — available in every project`);
  } else {
    // Cross-agent instructions file — the universal entry point.
    writeIfMissing(join(cwd, "AGENTS.md"), agentsMd, out);

    // Claude Code gets executable commands + skills.
    if (targets.includes("claude")) {
      copyTree(join(PKG, "commands"), join(cwd, ".claude", "commands"), out);
      copyTree(join(PKG, "skills"), join(cwd, ".claude", "skills"), out);
      writeIfMissing(
        join(cwd, "CLAUDE.md"),
        `# Project instructions\n\nSee [AGENTS.md](AGENTS.md) — the same rules apply here.\n\nphaseforge commands are available: \`/setup\`, \`/idea\`, \`/prd\`, \`/trd\`, \`/plan\`,\n\`/refine\`, \`/build\`, \`/test\`, \`/review\`, \`/cloud\`, \`/ship\`, \`/status\`.\n`,
        out,
      );
    }

    // Other agents read a pointer to AGENTS.md from their own conventional path.
    const pointer = `# Engineering rules\n\nThis project follows the process in [AGENTS.md](AGENTS.md).\nRead that file before making changes — it defines how work is planned,\nbuilt, verified, and what must never be decided without asking.\n`;

    for (const key of targets) {
      const a = AGENTS[key];
      if (!a || a.instructions === "AGENTS.md" || key === "claude") continue;
      // Cursor .mdc files need frontmatter or the rule is never applied.
      const body = key === "cursor" ? `---\ndescription: phaseforge engineering process\nalwaysApply: true\n---\n\n${pointer}` : pointer;
      writeIfMissing(join(cwd, a.instructions), body, out);
    }

    // Project docs scaffold.
    copyTree(join(PKG, "templates", "architecture"), join(cwd, "docs", "architecture"), out);
    copyTree(join(PKG, "templates", "phases"), join(cwd, "docs", "phases"), out);
    for (const f of ["ENGINEERING-CONSTITUTION.md", "PROGRESS.md"]) {
      writeIfMissing(join(cwd, "docs", f), readFileSync(join(PKG, "templates", f), "utf8"), out);
    }

    console.log(`  ${c.g("✓")} ${c.b("AGENTS.md")} ${c.dim("— works with Codex, Cursor, Antigravity, Copilot, any agent")}`);
    if (targets.includes("claude")) {
      console.log(`  ${c.g("✓")} ${c.b(".claude/")} ${c.dim("— 12 commands + 8 engineering skills")}`);
    }
    console.log(`  ${c.g("✓")} ${c.b("docs/")} ${c.dim("— constitution, progress, architecture templates")}`);
  }

  console.log(`\n  ${c.dim(`${out.copied.length} files created${out.skipped.length ? `, ${out.skipped.length} already existed and were left alone` : ""}`)}\n`);

  console.log(c.b("  Start here:\n"));
  console.log(`    ${c.cy("/setup")}   tell your agent about this project`);
  console.log(`    ${c.cy("/idea")}    describe what you want to build, in plain words\n`);
  console.log(c.dim("  Not using Claude Code? Open AGENTS.md and paste the workflow"));
  console.log(c.dim("  section into your agent — it works the same way.\n"));
}

function status() {
  const cwd = process.cwd();
  console.log(`\n${c.b("phaseforge")} — what's installed here\n`);

  const checks = [
    ["AGENTS.md", join(cwd, "AGENTS.md")],
    ["CLAUDE.md", join(cwd, "CLAUDE.md")],
    [".claude/commands", join(cwd, ".claude", "commands")],
    [".claude/skills", join(cwd, ".claude", "skills")],
    ["docs/ENGINEERING-CONSTITUTION.md", join(cwd, "docs", "ENGINEERING-CONSTITUTION.md")],
    ["docs/PROGRESS.md", join(cwd, "docs", "PROGRESS.md")],
  ];

  for (const [label, path] of checks) {
    const there = existsSync(path);
    let detail = "";
    if (there && statSync(path).isDirectory()) {
      detail = c.dim(` (${readdirSync(path).length} items)`);
    }
    console.log(`  ${there ? c.g("✓") : c.dim("·")} ${there ? label : c.dim(label)}${detail}`);
  }

  const globalCmds = join(homedir(), ".claude", "commands");
  if (existsSync(globalCmds)) {
    console.log(`\n  ${c.dim("global:")} ~/.claude/commands ${c.dim(`(${readdirSync(globalCmds).length} items)`)}`);
  }
  console.log("");
}

function uninstall() {
  const cwd = process.cwd();
  const removed = [];
  const ours = new Set(readdirSync(join(PKG, "commands")));
  const ourSkills = new Set(readdirSync(join(PKG, "skills")));

  const cmdDir = join(cwd, ".claude", "commands");
  if (existsSync(cmdDir)) {
    for (const f of readdirSync(cmdDir)) {
      if (ours.has(f)) {
        rmSync(join(cmdDir, f));
        removed.push(f);
      }
    }
  }
  const skillDir = join(cwd, ".claude", "skills");
  if (existsSync(skillDir)) {
    for (const s of readdirSync(skillDir)) {
      if (ourSkills.has(s)) {
        rmSync(join(skillDir, s), { recursive: true });
        removed.push(s);
      }
    }
  }

  console.log(`\n${c.b("phaseforge")} — removed ${removed.length} item(s)`);
  console.log(c.dim("  Your docs/, AGENTS.md and CLAUDE.md were left alone — they're your project's content.\n"));
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
${c.b("phaseforge")} — a senior engineering team, installed into your project

  ${c.g("npx phaseforge init")}              set up in this project
  ${c.g("npx phaseforge init --agent=codex")} target one agent
  ${c.g("npx phaseforge init --global")}     Claude Code, every project
  ${c.g("npx phaseforge status")}            what's installed
  ${c.g("npx phaseforge uninstall")}         remove it

  ${c.dim(`agents: ${Object.keys(AGENTS).join(", ")}`)}

Docs: https://github.com/Acrto3Hil3/phaseforge
`);
}
