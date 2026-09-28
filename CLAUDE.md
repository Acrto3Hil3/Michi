# MICHI — repo entry point

**This repo is the MICHI tool itself**, not a project built with it.

It has nothing to do with Kundan Gems (`~/Kundan Gems`) — a separate, unrelated
project. Don't read or reference it from here.

This directory was previously a different project called *phaseforge*, which was
wiped on 2026-09-28 and replaced by MICHI. Phaseforge's files are recoverable at
commit `58c71e1` if ever needed; nothing in this repo should refer to it.

## What MICHI is

A local-first engineering layer that sits between a non-technical founder and
whichever AI coding agent they already use. It turns a rough idea into
requirements, decisions, architecture, a plan, and a precisely-scoped
instruction for the agent — then checks the result against evidence.

The audience is **people who can't code** but have a real product idea. It is
**agent-agnostic**: Claude Code, Codex, Cursor, Gemini CLI, Copilot, Windsurf,
Cline, and whatever comes next.

**Read [`MICHI.md`](MICHI.md) first.** It is the product source of truth. The
eleven contracts in [`docs/specs/`](docs/specs/) are derived from it — where they
disagree, `MICHI.md` wins and the contract is a bug.

## Layout

| Path | What it is |
|---|---|
| `MICHI.md` | The master product document. Source of truth. |
| `docs/specs/` | Phase 0 — eleven engineering contracts, plus the open questions |
| `LICENSE` | MIT, © Subhash Yadav |

Nothing is implemented yet. The intended package layout is in
[`docs/specs/ARCHITECTURE.md`](docs/specs/ARCHITECTURE.md).

## Rules for working on this repo

1. **Write for someone who can't code.** Every user-facing word — README,
   command output, skill prose, error messages — is read by a non-engineer. No
   unexplained jargon. Internal specs may be technical.
2. **Agent-agnostic by default.** Anything that can't work through `AGENTS.md`
   and the CLI breaks the premise. Agent-specific code lives only in
   `adapters/`.
3. **Don't silently redefine the product.** `MICHI.md` §139: if a requirement is
   ambiguous — identify it, explain it, propose options, ask. Don't invent a
   product decision. The five open questions in `docs/specs/README.md` are open
   on purpose.
4. **Build the vertical slice, not twenty commands.** `MICHI.md` §133–§134. The
   whole product hypothesis rests on one flow working end to end:
   `init → discover → requirement → decision → ADR → task → compiled prompt`.
5. **Never bundle someone else's skill.** Ponytail (MIT, © Dietrich Gebert,
   github.com/DietrichGebert/ponytail) and graphify are referenced with
   attribution only. Republishing them under this package would be wrong.
6. **Test for real before claiming it works.** When there is an installer:
   fresh init, a second init (must write 0 files), `--agent=<one>`, a bad
   `--agent`, `status`, `uninstall`, then `npm pack --dry-run`. Use a scratch
   directory.
7. **Commits are authored `Subhash Yadav <subhashyadav98146@gmail.com>` only.**
   No Claude author line, no Claude co-author line.
8. **Never publish or push without explicit say-so.** Not `npm publish`, not
   `git push`, not creating the GitHub repo.

## Current state (2026-09-28)

Phase 0 complete: `MICHI.md` plus eleven specs in `docs/specs/`. No code, no
`package.json`, no dependencies, nothing published.

**Blocking implementation — needs the owner, don't decide these unasked:**

1. The five open questions in
   [`docs/specs/README.md`](docs/specs/README.md#open-questions). OQ-001 (the
   project-brain directory name) and OQ-004 (what a conversational command does
   without an LLM) shape everything downstream.
2. `npm login` — the user must run it themselves.
3. No GitHub repository exists, and `gh` is not installed.

Next step once the open questions are answered: Phase 1 — `michi init`, `scan`,
`status` — built test-first against
[`STATE_MODEL.md`](docs/specs/STATE_MODEL.md) and
[`CLI_CONTRACT.md`](docs/specs/CLI_CONTRACT.md).
