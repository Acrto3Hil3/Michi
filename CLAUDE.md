# phaseforge — repo entry point

**This repo is the phaseforge npm package itself**, not a project built with it.
It has nothing to do with Kundan Gems (`~/Kundan Gems`) — that is a separate,
unrelated project. Don't read or reference it from here.

## What phaseforge is

A senior software engineering team, installed into someone else's project.

The audience is **non-technical founders**: people with a real product idea and
an AI coding agent, but no engineering background and nobody to tell them when
the agent is about to build something wrong. It is **agent-agnostic** — Claude
Code, Codex, Cursor, Antigravity, Copilot, Windsurf, Gemini CLI.

The core mechanism: it refines a non-technical person's rough request into the
brief a senior engineer would have written, then hands that to their agent. See
`commands/refine.md` — that file is the heart of the product.

It covers the whole lifecycle: idea → PRD → technical design → phased plan →
build → senior review → real QA → hosting sized to their actual budget → deploy.

## Layout

| Path | What it is |
|---|---|
| `bin/cli.js` | The installer. `npx phaseforge init`. Idempotent — never overwrites. |
| `commands/` | 12 slash commands (Claude Code format), copied into `.claude/commands/` |
| `skills/` | 8 "departments", copied into `.claude/skills/` |
| `templates/` | What gets scaffolded into the user's project — `AGENTS.md`, constitution, progress, phase + architecture templates |
| `.claude-plugin/` | Claude Code plugin + marketplace manifests |
| `docs/` | `GETTING-STARTED.md` (walkthrough), `CONTEXT-ENGINEERING.md` (why it costs fewer tokens) |

`templates/AGENTS.md` is the cross-agent entry point — the one file every modern
agent reads. `init` also writes pointer files for Cursor (`.mdc`, needs
frontmatter or the rule never applies), Copilot, Windsurf and Gemini CLI.

## Rules for working on this repo

1. **Write for someone who can't code.** Every user-facing word — README, command
   descriptions, skill prose — is read by a non-engineer. No unexplained jargon.
2. **Agent-agnostic by default.** Claude-only features are fine as an *extra*,
   never as the only path. If a feature can't work via `AGENTS.md`, say so.
3. **Never bundle someone else's skill.** Ponytail (MIT, © Dietrich Gebert,
   github.com/DietrichGebert/ponytail) and graphify are referenced as companions
   with attribution only. Republishing them under this package would be wrong.
4. **Test the installer for real** before claiming it works: fresh `init`, a
   second `init` (must write 0 files), `--agent=<one>`, a bad `--agent`,
   `status`, `uninstall`, then `npm pack --dry-run`. Use a scratch directory.
5. **Commits are authored `Subhash Yadav <subhashyadav98146@gmail.com>` only.**
   No Claude author or co-author line.
6. **Never publish or push without explicit say-so.** Not `npm publish`, not
   `git push`, not creating the GitHub repo.

## Current state (2026-09-24)

v0.1.0, unpublished. Two local commits, neither pushed.

Done and verified: the 12 commands, the 8 skills, the templates, the installer
(all paths exercised), README and both docs rewritten for the non-technical
audience, all JSON valid, `npm pack` → 36 files / 43.1 kB.

**Three things need the user, and nothing should be done about them unasked:**

1. Commit `6810737` (the first one) is authored `Kundan Jewellers
   <kundanjewellers@Kundans-MacBook-Air.local>`. Local git config is correct now,
   so only that commit is wrong, and it's unpushed — offer to amend it.
2. `npm login` — the user must run it themselves. `npm whoami` → `ENEEDAUTH`.
3. `github.com/Acrto3Hil3/phaseforge` **does not exist** and `gh` is not
   installed. Every URL in the package points at it.

Not yet done: no real-world trial of the whole lifecycle on a throwaway project.
That's the highest-value next step — it's the only way to find out whether the
commands actually hold up when a non-technical person uses them in order.
