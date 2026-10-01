# MICHI — repo entry point

**This repo is the MICHI tool itself**, not a project built with it.

It has nothing to do with Kundan Gems (`~/Kundan Gems`) — a separate, unrelated
project. Don't read or reference it from here.

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
| `docs/specs/` | Phase 0 — eleven engineering contracts, the locked decisions and the open questions |
| `packages/core/` | MICHI Core — schemas, state, scanner, commands. Deterministic; no model, no network. |
| `packages/cli/` | The binary. Thin: parse, call Core, render. No engineering logic. |
| `packages/skills/` | The Experience Layer — instructions for the user's own agent. One `SKILL.md` per department. |
| `tools/check-phase0.py` | Reproducible consistency check over the contracts. Run it after editing any spec. |
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
   product decision. Raise a new `OQ-*` in `docs/specs/README.md` instead of
   deciding it; the questions listed there as open are open on purpose.
4. **Respect the three layers.** Conversation and judgement live in the skills,
   inside the user's own agent. MICHI Core is deterministic, model-agnostic and
   contains no model call, no network access and no chat interface — not behind
   a flag, not optionally. `.michi/` holds the durable state. The coding agent
   is an external executor, not part of MICHI. See
   [`docs/specs/ARCHITECTURE.md`](docs/specs/ARCHITECTURE.md#the-three-layers).
5. **Build the vertical slice, not twenty commands.** `MICHI.md` §133–§134. The
   whole product hypothesis rests on one flow working end to end:
   `init → discover → requirement → decision → ADR → task → compiled prompt`.
6. **Never bundle someone else's skill.** Ponytail (MIT, © Dietrich Gebert,
   github.com/DietrichGebert/ponytail) and graphify are referenced with
   attribution only. Republishing them under this package would be wrong.
7. **Test for real before claiming it works.** When there is an installer:
   fresh init, a second init (must write 0 files), `--agent=<one>`, a bad
   `--agent`, `status`, `uninstall`, then `npm pack --dry-run`. Use a scratch
   directory.
8. **Commits are authored `Subhash Yadav <subhashyadav98146@gmail.com>` only.**
   No Claude author line, no Claude co-author line.
9. **Never publish or push without explicit say-so.** Not `npm publish`, not
   `git push`, not creating the GitHub repo.

## Verify

```bash
pnpm verify        # typecheck + tests + spec consistency
```

Do not report work as done without running it (P3).

## Current state (2026-09-28)

Phase 0 complete and internally consistent. **Phases 1, 2 and 3 complete**:
`michi init`, `scan`, `status`, `discover` (start/status/answer/export/close),
`decide` (list/show/propose/confirm/reject/supersede), `plan`
(status/update/export/close), and the `senior-engineer` and `product-planner`
skills. 254 tests, TypeScript build clean. Nothing published.

Still deliberately absent: the graph engine, the context engine, the other five
skills, agent adapters and the verification executor. Those are Phases 4–8;
building their abstractions now would be the premature scaffolding the product
exists to prevent (P4).

**Phase 2's real limitation**: the `senior-engineer` skill is verified
structurally, never behaviourally. 165 green tests say nothing about whether an
agent following that skill asks good questions or avoids confirming things the
user did not agree to. Never cite the test count as evidence of agent
behaviour. See
[`SKILL_CONTRACT.md`](docs/specs/SKILL_CONTRACT.md#known-limitation-skills-are-verified-structurally-not-behaviourally).

**Locked by the owner** — settled, follow them, don't relitigate:

- **OQ-001** the project-state directory is `.michi/`
- **OQ-003** a Decision (`D001`) and an ADR (`ADR-001`) are distinct concepts —
  a structured object and the document describing it
- **OQ-004** the three layers: skills converse, Core is deterministic and
  model-agnostic, `.michi/` persists
- **OQ-005** token counts are estimates (`chars/4`) and are always labelled as
  estimates with the method named

- **OQ-006** MICHI Core may execute an allow-listed set of local verification
  commands and capture real results. It never edits source code. Evidence is
  tagged `produced_by: MICHI` or `produced_by: AGENT` and the two are never
  merged. Executor lands in Phase 7.

**Open — needs the owner, don't decide these unasked:**

1. **OQ-008** — how does a *published* specification change? Right now
   `plan update` on a published specification is refused outright, which is a
   dead end the first time a founder wants a different MVP. Three options and a
   recommendation are in
   [`docs/specs/README.md`](docs/specs/README.md#open). Blocks nothing in
   Phase 4; architecture reads the specification and does not change it.
2. **OQ-002** — npm package and binary names are unverified. Doesn't block
   implementation; package identity is read from configuration.
3. `npm login` — the user must run it themselves.
4. No GitHub repository exists, and `gh` is not installed.

**OQ-007 is answered and implemented**: discovery is cumulative. Requirements
are project-level, ids come from `requirements/requirements.yaml`, `close`
merges, and a requirement is superseded rather than deleted. A proposal
repeating an active requirement's title is refused unless it declares
`supersedes`. Do not add a bypass for either rule.

Next: **Phase 4** — the `architecture` skill: options, tradeoffs, ADRs, and the
`TRD.md` that Phase 3 deliberately did not write. It builds on the MVP scope
the specification now fixes.

Three Phase 3 rules that later phases depend on:

- **Requirements are canonical and belong to discovery.** The specification
  references `REQ-*` and never copies or invents them.
- **A scope call needs a named human**, like a requirement confirmation and a
  locked decision. There is no bypass; do not add one.
- **Dropping a requirement a locked decision was made for is refused.** The fix
  is to supersede the decision, deliberately.

Two rules that Phase 2 established and that everything after it depends on:

- **Nothing is confirmed without a named human.** The schema refuses a
  `CONFIRMED` requirement with no `confirmed_by`, and a `LOCKED` decision with
  no approval, no rationale or no ADR. Do not add a bypass.
- **A locked decision is superseded, never edited.** `decide confirm` on a
  locked decision exits 7 and points at `decide supersede`.
