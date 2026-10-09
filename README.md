# MICHI

<div align="center">
  <img src="assets/michi-logo-512.png" alt="MICHI" width="240" />
</div>

<p align="center">
  <strong>The path from idea to software.</strong>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-96.3%25-blue.svg" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.7%25-3776AB.svg" />
  <img alt="Local-first" src="https://img.shields.io/badge/Local-first-Yes-0EA5E9.svg" />
  <img alt="AI agent ready" src="https://img.shields.io/badge/AI%20agent-ready-4ade80.svg" />
</p>

MICHI is an engineering layer between a human and an AI coding agent. It helps turn vague product intent into clear requirements, structured decisions, architecture, and precise implementation instructions.

Instead of handing your agent a loose idea, MICHI turns it into a reliable engineering brief that keeps the project aligned, reviewable, and verifiable.

## Why MICHI exists

Most people do not struggle because AI cannot code. They struggle because they do not know how to tell an AI agent exactly what should be built, what constraints matter, and what decisions have already been made.

MICHI fills that gap.

- It asks the engineering questions a senior engineer would ask.
- It captures decisions as durable project memory.
- It prevents accidental architecture drift.
- It keeps project context small, relevant, and useful.
- It gives your coding agent a crisp brief instead of a vague wish.
- It records what was decided, why, and what changed later.

## Getting started

```bash
npm install -g @dev-subhash/michi
```

Or install the **VS Code extension**, which offers to connect MICHI to
whichever coding agent is already in your project — detecting what's there,
showing the exact files before writing any of them, and remembering if you say
no. It drives the CLI, so you still need the command above.

Needs Node 20 or newer, and an AI coding agent you already use.

Then, in your own project:

```bash
michi init --agent claude-code     # or cursor, codex, zed, antigravity, junie, …
michi status                       # always start here
michi discover start               # tell it what you want to build
```

`michi status` answers "what now" at every point. Every command takes `--json`
as well, which is what the skills running inside your agent use.

Two commands worth knowing if you do not read code:

```bash
michi explain D001 --simple    # what this decision is, and why, in plain words
michi decide impact D001       # what changing it would affect
```

`explain` answers only from what was written down. If the record does not
contain the answer, it says so rather than inventing a plausible one.

```bash
michi agents                       # what MICHI found, and what it can set up
michi install                      # no adapter needed: AGENTS.md works anywhere
```

MICHI never overwrites a file you wrote. If your `AGENTS.md` differs from the
one MICHI would write, it shows you the difference and leaves yours alone.

## The core idea

```text
You describe the goal in ordinary language
        ↓
MICHI asks the important engineering questions
        ↓
You choose the decisions that matter
        ↓
MICHI records them as project memory
        ↓
MICHI compiles a precise task brief
        ↓
Your AI coding agent implements it
        ↓
MICHI checks the evidence and keeps the project honest
```

## What MICHI is

MICHI is a local-first, open-source software engineering intelligence layer for AI-assisted development.

It does not replace your coding agent. It makes your coding agent significantly more effective by creating a disciplined bridge between:

- human intent
- product requirements
- engineering decisions
- technical architecture
- relevant project context
- actionable implementation instructions
- verification and review

## What MICHI is not

MICHI is not:

- a SaaS platform
- a hosted AI service
- a replacement for Claude Code, Codex, Cursor, Gemini CLI, Windsurf, Copilot, or similar tools
- a new AI model
- a cloud dependency
- a forced architecture system

MICHI is a local engineering control layer that improves how software gets built with AI.

## The problem it solves

A founder or product owner might say:

> “I want an app where customers can sign up, buy products, and track orders.”

That sounds clear, but it leaves many questions unanswered:

- Who are the users?
- What is the admin model?
- Which auth system should be used?
- What database and schema fit this product?
- What APIs are required?
- What is in scope for version 1?
- What should be deferred?
- How do we verify correctness?

MICHI helps convert that intent into a structured engineering understanding before implementation begins.

## How it works

MICHI has three layers:

1. Skills
   - The conversational intelligence layer that runs inside your existing AI coding agent.
   - It helps explore requirements, recommend decisions, ask clarifying questions, and keep the project grounded.

2. MICHI Core
   - Deterministic, local-first software with no mandatory AI dependency.
   - It validates project state, stores decisions, and manages project memory.

3. `.michi/`
   - A plain-text project brain that stores the decisions, requirements, architecture, and state that matter.

## Architecture in one glance

```text
Human idea
   ↓
MICHI discovery and decision workflow
   ↓
Requirements + approved decisions + architecture
   ↓
Context packet + implementation brief
   ↓
Existing AI coding agent
   ↓
Code + tests + review + verification
   ↓
Persistent project knowledge
```

## Key capabilities

### Decision-first workflow

MICHI recommends, explains, asks, confirms, and locks important product and engineering decisions before implementation continues.

### Project memory that lasts

Conversation is temporary. Project artifacts are durable. MICHI records decisions, requirements, and architecture in a way future agents can understand.

### Context engineering

MICHI does not dump entire repositories into every prompt. It selects only the relevant requirements, decisions, files, and constraints needed for the current task.

### Verification-first mindset

“An agent says it works” is not enough. MICHI treats evidence as a first-class concept, including tests, linting, build checks, and runtime verification.

### Minimal-complexity philosophy

MICHI encourages the smallest engineering solution that satisfies the approved requirement reliably, without unnecessary dependencies or premature abstraction.

## Project status

**Published and working.** 690 tests, 147 specification-consistency
invariants, and `pnpm release:check` — which packs the real tarballs, inspects
them, installs them into a clean throwaway project and drives the whole loop
from the installed binary, 47 checks in all. It publishes nothing, and nothing
is published.

| Phase | What | Status |
|---|---|---|
| 0 | Specification — eleven engineering contracts | done |
| 1 | `init` · `scan` · `status` | done |
| 2 | The `senior-engineer` skill · `discover` · `decide` | done |
| 3 | The `product-planner` skill · `plan` · the PRD | done |
| 4 | The `architecture` skill · SYSTEM and TRD | done |
| 5 | The context engine · `context` · `graph` | done |
| 6 | The `implementer` skill · the task DAG · the prompt compiler | done |
| 7 | Review, test, debug, verification | done |
| 8 | Agent adapters | done |
| 9 | Release readiness · npm packaging | done, unpublished |

The packages will publish as `@dev-subhash/michi`, `-core`,
`-adapters` and `-skills`, with `michi` as the command you type — `bin` names
are not registered on npm, so the two are independent. Two notes if you go
looking: the unscoped `michi` package on npm is **not** this project (an
unrelated URL router, last touched 2022), and the `@michi` scope belongs to
somebody else.

## Documentation

- [`MICHI.md`](MICHI.md) — the master product and product-design document
- [`docs/specs/README.md`](docs/specs/README.md) — engineering contracts and architecture specifications
- [`docs/specs/`](docs/specs/) — the specification set derived from the product vision
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to work on MICHI, and the rules that will get a change rejected
- [`CHANGELOG.md`](CHANGELOG.md) — what is in each version, and what is deliberately not included

## The idea in one line

> You decide what you want. MICHI works out how it should be built. Your coding agent builds it.

## Why this matters

AI coding agents are already powerful. The bottleneck is not raw code generation—it is decision quality, architectural clarity, and context discipline.

MICHI is built to reduce that gap.

It helps people move from rough ideas to software with fewer wrong turns, less confusion, and better alignment between product intent and implementation.

## License

MIT. See [`LICENSE`](LICENSE).

---

<p align="center">
  <sub>Built for a clearer path from idea to software.</sub>
</p>
