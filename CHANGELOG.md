# Changelog

All notable changes to MICHI are recorded here.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The four packages — `@michi/cli`, `@michi/core`, `@michi/adapters` and
`@michi/skills` — are released in lockstep and share one version number: a
mixed set is a configuration nobody tested.

Until 1.0.0, the `.michi/` state format may change between minor versions. It
carries a `schema_version`, and MICHI refuses to read state it does not
understand rather than guessing at it.

## [Unreleased]

Nothing yet.

## [0.1.0] — unreleased

The first version. MICHI turns an idea into requirements, decisions,
architecture, a plan and a precise brief for a coding agent, then checks the
result against evidence.

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

[Unreleased]: https://github.com/Acrto3Hil3/Michi/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Acrto3Hil3/Michi/releases/tag/v0.1.0
