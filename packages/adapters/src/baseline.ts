import type { InstallContext, Skill } from "./types.js";

/**
 * `AGENTS.md` — the cross-agent entry point, written for every project
 * whichever adapter ran.
 *
 * It must be sufficient on its own: an agent with no adapter at all should be
 * able to work with a MICHI project from this file and the CLI. A feature that
 * cannot be expressed here is a feature that breaks agent-agnosticism
 * (AGENT_ADAPTER_MODEL.md, "The universal baseline").
 *
 * Deterministic: same project and same skills, same bytes.
 */

function skillTable(skills: readonly Skill[]): string[] {
  const lines = ["| Skill | Use it when |", "|---|---|"];
  for (const s of skills) {
    const when = s.description.replace(/\s+/g, " ").trim();
    lines.push(`| \`${s.name}\` | ${when.length > 140 ? `${when.slice(0, 137)}…` : when} |`);
  }
  return lines;
}

export function baselineAgentsMd(ctx: InstallContext): string {
  return [
    `# ${ctx.projectName} — working with MICHI`,
    "",
    "This project uses MICHI. Its engineering memory is the `.michi/` folder:",
    "what this project decided, why, and what has actually been checked.",
    "Read it through the `michi` CLI rather than by guessing from the code.",
    "",
    "**Always start here:**",
    "",
    "```bash",
    "michi status          where the project is, and what it needs next",
    "```",
    "",
    "## The loop",
    "",
    "```text",
    "idea → requirements → decisions → architecture → plan → one task",
    "     → the agent builds it → evidence → verdict → done",
    "```",
    "",
    "| Stage | Commands |",
    "|---|---|",
    "| Understand what is wanted | `michi discover start` · `michi discover answer --file <f>` · `michi discover close` |",
    "| Decide what ships first | `michi plan update --file <f>` · `michi plan close` |",
    "| Settle how it is built | `michi decide propose --file <f>` · `michi decide confirm <id>` · `michi architecture close` |",
    "| Plan the work | `michi plan tasks --from-requirements` · `michi plan validate` |",
    "| Get the context for one piece | `michi context <REQ>` · `michi graph` |",
    "| Take a task | `michi task next` · `michi task start <id> --agent <you>` |",
    "| Report back | `michi task report <id> --from <f>` |",
    "| Prove it | `michi test <id> --run <key>` · `michi review <id>` · `michi debug <id> --stage <s>` |",
    "| Close it | `michi verify <id>` · `michi task done <id>` |",
    "",
    "Add `--json` to anything. That output is the contract; the prose is for people.",
    "",
    "## The rules, and they are not negotiable",
    "",
    "1. **Only the user confirms anything.** Not you. A requirement is not",
    "   confirmed, a decision is not locked and scope is not settled until the",
    "   user says so, by name. MICHI enforces this in code, so working around it",
    "   is not available to you either.",
    "2. **Never invent a decision.** If the work needs an architectural choice",
    "   nobody has made, stop and put the options to the user in plain language,",
    "   with the trade-offs and a recommendation. Do not pick one quietly.",
    "3. **A report is a claim, not evidence.** `michi task report` records what",
    "   you say happened. It moves nothing towards verified. Your own account of",
    "   your own work is the party being judged marking its own paper.",
    "4. **Only MICHI's own observations count.** `michi test --run <key>` runs a",
    "   command the user allow-listed under `verification.allow` in",
    "   `.michi/config.yaml`, and MICHI watches the real result. If the key does",
    "   not exist, ask the user to add one — do not run something else instead,",
    "   and do not report a result you did not see.",
    "5. **Plain language.** The user may not read code. No jargon, no",
    "   abbreviations they have not used, one question at a time.",
    "6. **Say how you know.** Distinguish what the user stated, what you",
    "   inferred, and what you assumed. Never let an assumption read as a fact.",
    "7. **Stop rather than invent.** Missing decision, missing credential,",
    "   ambiguous requirement, scope growing past the task: stop and say so.",
    "",
    "## The skills",
    "",
    "MICHI's process lives in skills — instructions for you, not for MICHI.",
    "",
    ...skillTable(ctx.skills),
    "",
    "If your agent supports loading skills from files, they were installed in",
    "its own format too. If not, this file plus the CLI is enough: ask",
    "`michi status` what the project needs, and follow the matching row above.",
    "",
    "## What MICHI will not do",
    "",
    "MICHI never writes your application code — that is your job — and it never",
    "edits code to make a check pass. It makes no network calls and asks no",
    "model anything. Nothing in `.michi/` is deleted; superseded things are",
    "marked, so the history of what changed and why survives.",
    "",
  ].join("\n");
}
