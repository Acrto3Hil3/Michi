import { existsSync } from "node:fs";
import { join } from "node:path";
import { baselineAgentsMd } from "./baseline.js";
import type { AgentAdapter, Capabilities, DetectionResult, InstallContext, PlannedFile } from "./types.js";

/**
 * Every adapter MICHI ships. This file and `baseline.ts` are the only places
 * an agent's name appears anywhere in MICHI.
 *
 * Adding an agent is one entry here plus a row in
 * `AGENT_ADAPTER_MODEL.md`. If adding one ever requires touching `core`, the
 * boundary has already leaked.
 */

/** Signs of an agent in the project. Reads paths; writes nothing. */
function sightings(root: string, paths: readonly string[]): string[] {
  return paths.filter((p) => existsSync(join(root, p)));
}

function makeDetect(id: string, displayName: string, signs: readonly string[]) {
  return async (root: string): Promise<DetectionResult> => {
    const evidence = sightings(root, signs);
    return { id, displayName, present: evidence.length > 0, evidence };
  };
}

const baselineOnly = (id: string) => (ctx: InstallContext) => ({
  agent: id,
  files: [{ path: "AGENTS.md", content: baselineAgentsMd(ctx) }],
  notes: [] as string[],
});

/** The baseline, plus one file wherever this agent actually reads. */
function withInstructionFile(
  id: string, path: string, heading: string,
): (ctx: InstallContext) => { agent: string; files: PlannedFile[]; notes: string[] } {
  return (ctx) => ({
    agent: id,
    files: [
      { path: "AGENTS.md", content: baselineAgentsMd(ctx) },
      {
        path,
        content: [
          `# ${heading}`,
          "",
          "This project uses MICHI. The whole process, the commands and the",
          "rules are in `AGENTS.md` at the project root — read that file first,",
          "and start every session with `michi status`.",
          "",
          "Four things that are easy to get wrong here:",
          "",
          "- Only the user confirms a requirement, a decision or the scope.",
          "- A report of your own work is a claim; evidence is what MICHI ran.",
          "- `michi test --run <key>` only runs commands the user allow-listed.",
          "- If a decision is missing, stop and ask. Do not invent one.",
          "",
        ].join("\n"),
      },
    ],
    notes: [],
  });
}

const CAN_RUN: Capabilities = { native_skills: false, runs_commands: true };
const UNKNOWN_RUN: Capabilities = { native_skills: false, runs_commands: null };

const manual: AgentAdapter = {
  id: "manual",
  displayName: "No adapter (any agent, or none)",
  capabilities: UNKNOWN_RUN,
  // The baseline is the guarantee, so this one always applies.
  detect: async () => ({
    id: "manual", displayName: "No adapter (any agent, or none)", present: true,
    evidence: ["always available — AGENTS.md and the CLI are enough on their own"],
  }),
  installPlan: (ctx) => ({
    ...baselineOnly("manual")(ctx),
    notes: [
      "Nothing agent-specific was written. AGENTS.md and the michi CLI are the",
      "whole integration, which is what makes a MICHI project portable.",
    ],
  }),
};

const claudeCode: AgentAdapter = {
  id: "claude-code",
  displayName: "Claude Code",
  capabilities: { native_skills: true, runs_commands: true },
  detect: makeDetect("claude-code", "Claude Code",
    [".claude", ".claude/settings.json", ".claude/skills", "CLAUDE.md"]),
  installPlan: (ctx) => ({
    agent: "claude-code",
    files: [
      { path: "AGENTS.md", content: baselineAgentsMd(ctx) },
      ...ctx.skills.map((s) => ({
        path: `.claude/skills/${s.name}/SKILL.md`,
        content: s.body,
      })),
    ],
    notes: [`${ctx.skills.length} skills in Claude Code's own format, unchanged.`],
  }),
};

const cursor: AgentAdapter = {
  id: "cursor",
  displayName: "Cursor",
  capabilities: CAN_RUN,
  detect: makeDetect("cursor", "Cursor", [".cursor", ".cursor/rules", ".cursorrules"]),
  installPlan: (ctx) => ({
    agent: "cursor",
    files: [
      { path: "AGENTS.md", content: baselineAgentsMd(ctx) },
      {
        path: ".cursor/rules/michi.mdc",
        // Without frontmatter a Cursor rule never applies, so it is not
        // decoration — it is the difference between installed and ignored.
        content: [
          "---",
          "description: How to work in this project: MICHI holds the requirements, decisions and evidence.",
          "globs:",
          "alwaysApply: true",
          "---",
          "",
          "This project uses MICHI. Read `AGENTS.md` at the project root for the",
          "whole process and the commands; start every session with",
          "`michi status`.",
          "",
          "- Only the user confirms a requirement, a decision or the scope.",
          "- A report of your own work is a claim; evidence is what MICHI ran.",
          "- `michi test --run <key>` only runs commands the user allow-listed.",
          "- If a decision is missing, stop and ask. Do not invent one.",
          "",
        ].join("\n"),
      },
    ],
    notes: [],
  }),
};

const codex: AgentAdapter = {
  id: "codex",
  displayName: "Codex",
  capabilities: CAN_RUN,
  detect: makeDetect("codex", "Codex", [".codex", "AGENTS.md"]),
  installPlan: baselineOnly("codex"),
};

const geminiCli: AgentAdapter = {
  id: "gemini-cli",
  displayName: "Gemini CLI",
  capabilities: CAN_RUN,
  detect: makeDetect("gemini-cli", "Gemini CLI", [".gemini", "GEMINI.md"]),
  installPlan: withInstructionFile("gemini-cli", "GEMINI.md", "Project instructions"),
};

const copilot: AgentAdapter = {
  id: "copilot",
  displayName: "GitHub Copilot",
  capabilities: UNKNOWN_RUN,
  detect: makeDetect("copilot", "GitHub Copilot",
    [".github/copilot-instructions.md", ".github/instructions"]),
  installPlan: (ctx) => {
    const plan = withInstructionFile(
      "copilot", ".github/copilot-instructions.md", "Project instructions",
    )(ctx);
    return {
      ...plan,
      notes: [
        "MICHI cannot tell whether this agent can run commands here. If it",
        "cannot, verification for those tasks is a human step — MICHI will say",
        "what it could not check rather than lowering the bar for done.",
      ],
    };
  },
};

const windsurf: AgentAdapter = {
  id: "windsurf",
  displayName: "Windsurf",
  capabilities: CAN_RUN,
  detect: makeDetect("windsurf", "Windsurf", [".windsurfrules", ".windsurf"]),
  installPlan: withInstructionFile("windsurf", ".windsurfrules", "Project rules"),
};

const cline: AgentAdapter = {
  id: "cline",
  displayName: "Cline / Roo",
  capabilities: CAN_RUN,
  detect: makeDetect("cline", "Cline / Roo", [".clinerules", ".roo", ".roorules"]),
  installPlan: withInstructionFile("cline", ".clinerules", "Project rules"),
};

/**
 * The editors that arrived after `AGENTS.md` settled as the common standard.
 *
 * Zed takes it as the primary instructions file, Kiro picks up a root one
 * automatically, Junie reads it before its own legacy format, and Antigravity
 * reads it alongside `GEMINI.md`. So for most of these the baseline *is* the
 * integration, and the adapter exists so `michi agents` recognises the editor
 * and writes the one extra file it prefers.
 */

const antigravity: AgentAdapter = {
  id: "antigravity",
  displayName: "Google Antigravity",
  capabilities: CAN_RUN,
  detect: makeDetect("antigravity", "Google Antigravity",
    [".antigravity", ".agents/rules", ".agent/rules"]),
  installPlan: (ctx) => ({
    ...withInstructionFile("antigravity", ".agents/rules/michi.md", "Project rules")(ctx),
    notes: [
      "Antigravity reads AGENTS.md alongside its own GEMINI.md. Where both" +
      " define the same thing, GEMINI.md is reported to win — so keep anything" +
      " Antigravity-specific there and leave AGENTS.md for everyone.",
    ],
  }),
};

const zed: AgentAdapter = {
  id: "zed",
  displayName: "Zed",
  capabilities: CAN_RUN,
  detect: makeDetect("zed", "Zed", [".zed", ".rules"]),
  installPlan: (ctx) => ({
    ...baselineOnly("zed")(ctx),
    notes: [
      "AGENTS.md is Zed's primary project instructions file, so it is the whole" +
      " integration. Zed picks one file from a priority list rather than merging," +
      " so a stray .cursorrules or .rules in this project can hide AGENTS.md.",
    ],
  }),
};

const junie: AgentAdapter = {
  id: "junie",
  displayName: "JetBrains Junie",
  capabilities: CAN_RUN,
  detect: makeDetect("junie", "JetBrains Junie", [".junie", ".idea"]),
  installPlan: (ctx) => ({
    ...withInstructionFile("junie", ".junie/AGENTS.md", "Project instructions")(ctx),
    notes: [
      "Junie checks .junie/AGENTS.md before the root AGENTS.md, so the file in" +
      " .junie wins for Junie while the root one still serves every other agent.",
    ],
  }),
};

const kiro: AgentAdapter = {
  id: "kiro",
  displayName: "AWS Kiro",
  capabilities: CAN_RUN,
  detect: makeDetect("kiro", "AWS Kiro", [".kiro", ".kiro/steering"]),
  installPlan: (ctx) => ({
    ...baselineOnly("kiro")(ctx),
    notes: [
      "Kiro picks up a root AGENTS.md automatically as steering, so nothing" +
      " else is needed. Project-specific steering lives in .kiro/steering/ and" +
      " is yours, not MICHI's to write.",
    ],
  }),
};

const trae: AgentAdapter = {
  id: "trae",
  displayName: "Trae",
  capabilities: UNKNOWN_RUN,
  detect: makeDetect("trae", "Trae", [".trae", ".trae/rules"]),
  installPlan: (ctx) => ({
    ...withInstructionFile("trae", ".trae/rules/project_rules.md", "Project rules")(ctx),
    notes: [
      "Trae's rules path comes from community tooling rather than from Trae's" +
      " own documentation — MICHI could not confirm it against an official" +
      " source. AGENTS.md is written either way, and that is the part MICHI" +
      " is sure about.",
    ],
  }),
};

export const ADAPTERS: Record<string, AgentAdapter> = {
  manual,
  "claude-code": claudeCode,
  cursor,
  codex,
  "gemini-cli": geminiCli,
  copilot,
  windsurf,
  cline,
  antigravity,
  zed,
  junie,
  kiro,
  trae,
};

export function adapterIds(): string[] {
  return Object.keys(ADAPTERS);
}

export function adapterFor(id: string): AgentAdapter {
  const found = ADAPTERS[id];
  if (found) return found;
  throw new Error(
    `"${id}" is not an agent MICHI has an adapter for. Known: ${adapterIds().join(", ")}. ` +
    `Any other agent works through "manual" — AGENTS.md and the CLI are the whole integration.`,
  );
}

/** Every adapter's verdict on this project, in registry order. Reads only. */
export async function detectAll(projectRoot: string): Promise<DetectionResult[]> {
  return Promise.all(Object.values(ADAPTERS).map((a) => a.detect(projectRoot)));
}
