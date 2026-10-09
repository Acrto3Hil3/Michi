# Changelog

All notable changes to MICHI are recorded here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The four packages are released in lockstep and share one version number — a
mixed set is a configuration nobody tested:

| Package | Role |
|---|---|
| `@dev-subhash/michi` | the CLI, and the `michi` command |
| `@dev-subhash/michi-core` | engines, schemas, state |
| `@dev-subhash/michi-adapters` | the agent adapters |
| `@dev-subhash/michi-skills` | the seven skills |

Until 1.0.0, the `.michi/` state format may change between minor versions. It
carries a `schema_version`, and MICHI refuses to read state it does not
understand rather than guessing at it.

## [0.2.0] — 2026-10-09

### Changed

- **The packages moved to `@dev-subhash/`**, and the CLI is now
  `@dev-subhash/michi`:

  ```bash
  npm install -g @dev-subhash/michi
  ```

  `@subhashyadav98146/*` worked, but it carried account digits into every
  install line. `@michi` and `@subhashyadav` are both owned by other accounts;
  `@dev-subhash` was free. 0.1.0–0.1.2 stay published under the old scope and
  are deprecated with a pointer here — nothing is deleted.

  **The command is unchanged.** `bin` names are not registered on npm, so
  `michi` is still what you type.

- Every package now carries the author, a description written for someone who
  has never heard of MICHI, and the keywords a stranger would actually search.

## [Unreleased]

### Added

- **A VS Code extension** (`packages/vscode`). Install it, open a project, and
  it offers to connect MICHI to whichever coding agent you already use —
  detecting what's there, listing every option, showing the exact files before
  writing any of them, and remembering "never for this project".

  It is a thin client over the CLI by design: it knows no agent's name, parses
  no project state, and passes MICHI's own plain-language errors through rather
  than replacing them. A test asserts each of those. It is **not published to
  the marketplace**, and it has never been run inside a real editor — only its
  non-UI half is covered by tests.

## [0.1.2] — 2026-10-09

### Added

- Adapters for **Google Antigravity, Zed, JetBrains Junie, AWS Kiro and Trae**,
  bringing the total to thirteen. Most of them read `AGENTS.md`, which MICHI
  already wrote, so these are largely detection plus the one native file each
  prefers — `michi agents` now recognises the editor rather than leaving the
  user to guess.
- Trae's rules path comes from community tooling rather than Trae's own
  documentation, and the adapter says so rather than implying it was verified.
- `michi example <name> [--raw]` — a complete, valid file for every command
  that takes `--file`. A schema failure names one missing field at a time, so
  finding a file's shape by trial cost a round-trip per field; the first
  dogfood run needed seven to write one discovery update, and never learned
  which values `confidence` accepts. Every `VALIDATION_ERROR` now points at
  the matching example, which makes it one round-trip.

### Fixed

- `michi status` said nothing at `SPECIFICATION` and several later stages,
  stranding the user at the exact command the README tells them to trust. It
  now always answers "what now", from the stage when nothing else is
  outstanding.

## [0.1.1] — 2026-10-08  ·  first working release

### Fixed

- `@dev-subhash/michi-adapters@0.1.0` was published with a
  `workspace:*` dependency and cannot be installed — `npm publish` ships that
  protocol verbatim where `pnpm publish` rewrites it to a real version.
  Published versions are immutable, so 0.1.1 is the fix and 0.1.0 is
  deprecated. `michi-core@0.1.0` and `michi-skills@0.1.0` were unaffected.
- Publishing now goes through `pnpm release:publish`, which refuses a version
  already on the registry, uses pnpm throughout, and afterwards installs what
  it published **from the registry** into a clean directory — a successful
  upload proves only that the upload worked.

### Added

- `michi explain <id> [--simple]` — what a decision, requirement, task or file
  is and why, in plain language, answered from the artifacts alone. An ADR id
  resolves to the decision it documents. Where the record does not contain the
  answer it says so, rather than reconstructing a plausible one.
- `michi decide impact <id>` — the blast radius of changing a decision,
  computed from the graph: the requirements it governs, the locked decisions
  resting on the same requirements, the work planned under it (marked where an
  agent has already attempted it), and the files those tasks reported
  touching. Reported files are labelled as a claim, not a measured cost.

## [0.1.0] — withdrawn

The first version. MICHI turns an idea into requirements, decisions,
architecture, a plan and a precise brief for a coding agent, then checks the
result against evidence.

> `michi-adapters@0.1.0` and `michi-cli@0.1.0` cannot be installed — see the
> 0.1.1 entry above. Use 0.1.1 or later. Everything described below is in
> 0.1.1; only the packaging was wrong.

### The project state

- `michi init` · `michi scan` · `michi status` — set up in an existing project
  and record what is actually there, saying plainly what it could not
  establish rather than guessing.
- Everything lives in `.michi/` as plain text, under version control, readable
  without MICHI. Nothing is deleted; superseded things are marked, so the
  history of what changed and why survives.

### Understanding what is wanted

- `michi discover` — a structured discovery session. A requirement is
  `PROPOSED` until the user confirms it by name, and the confirmation records
  who and when.
- Discovery is cumulative: a second session adds to what was already agreed and
  supersedes rather than overwrites.

### Deciding what ships, and how

- `michi plan` — personas, the MVP boundary and acceptance criteria. `FUTURE`
  is a promise, not a deletion.
- `michi decide` · `michi architecture` — technical choices as options with
  honest trade-offs and one recommendation. A decision reaches `LOCKED` only
  with an approval, a rationale and an ADR.
- A published specification changes only through a revision (`REV-*`) recording
  what, why, who and when, and a revision that changed nothing is refused.

### Handing work to an agent

- `michi context` · `michi graph` — the project knowledge one piece of work
  needs, and what was left out and why. Token counts are `chars/4` estimates,
  always labelled with the method.
- `michi plan tasks` · `michi task` — the task DAG and the compiled
  instruction: the requirement in the user's words, the decision they approved
  and its reasoning, the limits, and how anyone will know it worked.
- The compiled instruction is not stored. It is reproducible from state, and
  the run record keeps its hash as proof of what was handed over.
- `michi task report` records what the agent said. It moves nothing towards
  verified.

### Knowing whether it actually happened

- `michi test --run <key>` runs a command the user allow-listed under
  `verification.allow` and records the real result as observed by MICHI.
  `--record` ingests what only the agent saw, kept separately.
- `michi review` · `michi debug` — findings with a file and a line; the debug
  stages refuse to reach a fix before a reproduction exists.
- `michi verify` is the only path to `VERIFIED`, and it refuses a verdict built
  only on the agent's word. There is no override flag.
- `michi task done` closes a verified task and files it under
  `tasks/completed/`.

### Working with any agent

- `michi agents` · `michi install` — integration files for Claude Code, Cursor,
  Codex, Gemini CLI, Copilot, Windsurf and Cline, or the universal `AGENTS.md`
  baseline for anything else.
- Installing never overwrites: a file that differs is reported with a diff and
  left alone.

### Deliberately not included

No LLM, no AI API key, no database, no web service, no editor integration, no
autonomous coding loop, and no application-code generation. The judgement
happens in the agent the user already has; MICHI is the engineering layer
around it.

`michi task split` is specified and not implemented — it needs a lifecycle
decision the contract does not yet make.

[Unreleased]: https://github.com/Acrto3Hil3/Michi/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Acrto3Hil3/Michi/releases/tag/v0.1.1
[0.1.0]: https://github.com/Acrto3Hil3/Michi/releases/tag/v0.1.0
