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
8. **Commits are authored `Subhash Yadav <subhashyadav98146@gmail.com>`**, and
   carry `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` as a trailer.
   The author line is always the owner's; the co-author trailer records that
   the work was done with Claude Code. Never put Claude on the author line.
9. **Never publish or push without explicit say-so.** Not `npm publish`, not
   `git push`, not creating the GitHub repo.

## Verify

```bash
pnpm verify        # typecheck + tests + spec consistency
```

Do not report work as done without running it (P3).

## Current state (2026-09-28)

Phase 0 complete and internally consistent. **Phases 1 to 6 complete**:
`michi init`, `scan`, `status`, `discover` (start/status/answer/export/close),
`decide` (list/show/propose/confirm/reject/supersede), `plan`
(status/update/export/close), and the `architecture` (status/export/close), `context`, `graph`, `plan tasks`,
`plan validate`, `task` (list/show/next/start/report/block), and the
`senior-engineer`, `product-planner`, `architecture` and `implementer` skills.
517 tests, TypeScript build clean. Nothing published.

Still deliberately absent: the reviewer, tester and debugger skills, agent
adapters and the verification executor. Those are Phases 7–8;
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
  merged. The executor takes an allow-list *key*, never a command string.

- **OQ-009** a specification revision flags the individual locked decisions
  governing the requirements it moved (`needs_review`, `review_reason`), never
  unlocking them. `architecture close` clears the flags. Context packets show a
  flagged decision rather than hiding it or treating it as valid.
- **OQ-008** a published specification may be changed, but only through a
  revision (`REV-*`) recording what, why, who and when. Core derives *what*
  changed and refuses a revision that changed nothing. Product artifacts are
  tombstoned, never deleted. The stage is current readiness, not high-water
  progress, so new requirements move a project back and flag what needs review.

**Open — needs the owner, don't decide these unasked:**

1. **`npm login`, then `npm org ls michi`** — the only thing between here and
   a published package — **done**: signed in as `subhashyadav98146`, and both
   `@michi` and `@subhashyadav` turned out to be owned by other accounts.
   OQ-002 is settled as `@subhashyadav98146/*` with the CLI at
   `michi-cli`. The command stays `michi`: bin names are not registered
   on npm. Never publish without being asked.
2. **Publishing to npm — attempted, then set aside by the owner.** The
   artifact is proven (`pnpm release:check` packs, inspects, installs into a
   clean project and drives the whole loop from the installed binary) and
   nothing is published. The blocker, if it is picked up again: npm requires
   2FA to publish. A `npm login` session token never satisfies that, and
   `npm login` overwrites whatever token is already in `~/.npmrc` — which is
   how the first attempt was lost. Do not retry with a session token; it fails
   identically every time, with a 403 naming 2FA.

   The durable route is an **authenticator app** plus `--otp=<real code>`.
   A classic **Automation** token also works today, but npm is deprecating it:
   "npm tokens that bypass 2FA are being restricted for account changes and
   direct publishing" (gh.io/npm-gat-bypass2fa-deprecation). `npm token
   create` is not a shortcut — it mints publish-type tokens, which still
   demand an OTP. Publishing stays a deliberate act and a green build is not
   authorisation.
3. **The GitHub remote.** `https://github.com/Acrto3Hil3/Michi` exists; commits
   from `4b7e6b1` onward are local only, from an earlier outage. Do not push
   unless asked.

**OQ-007 is answered and implemented**: discovery is cumulative. Requirements
are project-level, ids come from `requirements/requirements.yaml`, `close`
merges, and a requirement is superseded rather than deleted. A proposal
repeating an active requirement's title is refused unless it declares
`supersedes`. Do not add a bypass for either rule.

All nine phases are built, plus `michi explain` and `michi decide impact` —
the last two commands the contract specified and nothing implemented. The only
things still specified-but-unbuilt are `michi task split` (needs a lifecycle
decision the contract does not make) and the graph queries `pathsBetween`,
`implementers` and `cycles`, which nothing calls yet.

`explain` is the P11 command, and its one rule is that every sentence traces
to a recorded field: a missing field becomes a sentence saying it is missing,
never a plausible reconstruction. Tests hold the prose to that, and to not
doubling a full stop or mangling a recorded title's capitalisation — both of
which the real binary showed before the tests did.

**Nothing is published**, and publishing is not
authorised — see the open list above.

Phase 9's shape:

- **`pnpm release:check` is the only thing that proves a release.** It packs
  the four tarballs, inspects them for dev files, state, missing licences,
  `workspace:` deps and credential-shaped strings, installs them into a clean
  throwaway project, and drives the whole loop — discovery through
  `task done` — using only the installed binary. A green `pnpm verify` proves
  the repository works, which is a different claim.
- **`pnpm pack`/`pnpm publish`, never the `npm` equivalents.** pnpm rewrites
  `workspace:*` to the real version on the way out; npm ships it verbatim and
  the published package fails to install with `EUNSUPPORTEDPROTOCOL`. This is
  not theoretical: `michi-adapters@0.1.0` was published with `npm publish` and
  is permanently broken, because published versions are immutable. Publishing
  goes through `pnpm release:publish`, which also installs what it published
  from the registry afterwards — a successful upload proves only that the
  upload worked.
- **The four packages share one version and ship together.** Bumping means all
  four `package.json` files *and* `core/src/identity.ts`, which is what the CLI
  reports. An invariant holds them in step.
- **Publishing is never a side effect of a green build.** CI runs the release
  check and has no `npm publish` step, deliberately.

Phase 8's shape:

- **`packages/adapters` is the only place an agent's name means anything.** A
  test greps every agent name across `packages/**/*.ts` outside
  `adapters/src` and fails on a hit. Core cannot import adapters at all, and
  adapters cannot import Core — the CLI composes the two. If you find yourself
  adding an agent name to `core` or `cli`, the boundary has leaked and the fix
  is in `adapters`, not a conditional.
- **Adapters are pure.** `installPlan` describes files; the CLI writes them,
  which is where the permission policy lives. There is no `DELETE` and no
  `OVERWRITE` outcome by construction: a differing file is a `CONFLICT`,
  reported with a diff, exit 7, with everything else still written.
- **There is no method for packaging the compiled instruction, deliberately.**
  The compiled instruction is canonical and agent-independent; `task start`
  prints it. Adapters change where an agent reads its *standing* instructions,
  never the brief for one task. Do not add a `renderInstruction`.
- **`AGENTS.md` is the guarantee, not a fallback.** Every adapter writes the
  same baseline, a test holds that it is byte-identical across all of them, and
  another holds that the whole loop is reachable from it. A feature that cannot
  be expressed through `AGENTS.md` plus the CLI breaks agent-agnosticism.
- **`runs_commands: null` means unknown, which is not `false`** (P9). Copilot
  is the current case.
- An adapter may suggest a **budget**; the CLI resolves it to a number before
  Core sees it, and the `chars/4` method stays (OQ-005).

Phase 7's shape:

- **`runAllowed` is the only place Core executes anything**, and its signature
  is the enforcement: it takes `{ root, now, key }` and has no parameter for a
  command. Do not add one. The command comes from `verification.allow[key]` in
  the user's own config; a `package.json` script, a README, a comment and an
  agent's report are all data, not permission.
- **`verify` refuses a verdict built only on the agent's word.** At least one
  piece of `produced_by: MICHI` evidence must exist and have passed. The
  schema enforces provenance both ways — `MICHI` evidence without its process
  record is invalid, and `AGENT` evidence carrying `allow_key`, `cwd`,
  `started_at` or `ended_at` is invalid too, because that would imply Core
  observed something it did not (P9).
- **Verifying and closing are separate acts.** `verify` reaches `VERIFIED`;
  `task done` reaches `DONE` and moves the file to `tasks/completed/`. A closed
  task stays readable — `loadTasks` reads both directories, because the next
  task's `READY` is derived from its dependencies being `DONE`.
- `debug` refuses `FIX` or `VERIFY` before a `REPRODUCE` exists.

Phase 6's shape:

- **No edge claims a file implements a requirement.** A task reports what it
  implements (`IMPLEMENTS → REQUIREMENT`) and what it touched
  (`TOUCHED → FILE`), separately. Any file-to-requirement relationship is
  derived through the task and carries its uncertainty. Touching a file does
  not make it the implementation, and `verified` stays `false` until the
  task's verification passes.
- **The compiled instruction is not stored.** It is a generated artifact,
  reproducible from state; the run record keeps its `instruction_hash` as proof
  of what was handed over. Do not write it to disk, and never edit one.
- **A report is a claim.** `task report` moves a task to `CHANGES_DETECTED` and
  nothing in it can move one towards `VERIFIED`. The verification record is
  written from observed results by `michi verify`, and nothing else.
- **Readiness is derived**, like a discovery session's status: `PENDING`/`READY`
  is recomputed from dependencies on every read.
- `michi task split` is deliberately **not implemented** — it needs a lifecycle
  decision the contract does not make, and nothing drives it yet.

Phase 4's shape is worth knowing before extending it: **architecture adds no
state file.** Architecture *is* the locked decisions, and `michi decide`
already records those. `michi architecture` reads across requirements,
specification and the decision registry and answers one question — does
everything in the first version have a decided approach? Do not add an
`architecture.yaml`. It builds on the MVP scope
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
- **Relevance is a graph relationship, not a similarity score.** There are
  no embeddings and no model in the context engine — nothing to tune. Every
  inclusion in a packet carries a reason a person can check, because when an
  agent does something strange the packet is the first place to look.
- **A gate Core can enforce beats an agenda an agent declares.** The
  architecture gate is "every first-version requirement is governed by a locked
  decision", not "the skill says it is done". Prefer the checkable version
  every time.
- **Nothing important disappears, and nothing important changes silently.**
  Requirements supersede, specifications revise, decisions supersede, product
  artifacts are tombstoned. There is no delete anywhere, and every change names
  the human who asked for it.
