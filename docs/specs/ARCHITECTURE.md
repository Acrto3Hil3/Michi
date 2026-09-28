# ARCHITECTURE

Derived from `MICHI.md` §29, §55, §65–§71, §84–§85, §133–§134.

## The shape of the system

MICHI is a **compiler for software engineering intent**. Human language goes in
at one end; a precise, scoped instruction for a coding agent comes out the
other; evidence flows back and updates durable state.

```text
Human intent
     ↓  Intent Engine
Intent model
     ↓  Requirement Engine
Requirement model
     ↓  Decision Engine          ← human approval gate
Decision model
     ↓  Architecture Engine      ← human approval gate
Architecture model
     ↓  Planning Engine
Task graph
     ↓  Context Engine
Context packet
     ↓  Prompt Engine
Agent instruction
     ↓
[ the user's existing coding agent ]
     ↓
Source code
     ↓  Tester · Reviewer
Evidence
     ↓  Verification Engine
Verified result
     ↓  State Engine
Project brain on disk
```

Read top-to-bottom it is a compiler. Read bottom-to-top it is a feedback loop.
Both directions must work for the product to be worth anything.

## The three layers

*OQ-004, locked 2026-09-28. This is the boundary that keeps MICHI from becoming
another AI-agent framework, and it outranks convenience everywhere it applies.*

```text
┌─────────────────────────────────────────────────────────┐
│                   EXPERIENCE LAYER                      │
│                                                         │
│   MICHI skills, running inside the user's own agent     │
│   Claude Code · Codex · Kimi · Gemini · Cursor · …      │
│                                                         │
│   conversation · clarification · interpretation         │
│   recommendation · explanation · asking for approval    │
│   translating all of that into structured operations    │
└────────────────────────────┬────────────────────────────┘
                             │  structured calls
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      MICHI CORE                         │
│                                                         │
│   intent · requirements · decisions · architecture      │
│   planning · tasks · context · graph · state            │
│   verification · artifacts · prompt compilation         │
│                                                         │
│   deterministic · local-first · model-agnostic          │
│   agent-agnostic · testable · scriptable                │
└────────────────────────────┬────────────────────────────┘
                             │  validated reads and writes
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    PROJECT STATE                        │
│                                                         │
│                       .michi/                           │
│                                                         │
│   requirements · architecture · decisions · ADRs        │
│   tasks · graph · context packets · sessions · state    │
│                                                         │
│   the persistent engineering memory of the project      │
└─────────────────────────────────────────────────────────┘
```

And then, outward:

```text
MICHI Core → compiled engineering instruction → existing coding agent
          → source repository → evidence → MICHI state
```

### What belongs where

| | Experience Layer | MICHI Core | Project State |
|---|---|---|---|
| **Is** | prompts and instructions | TypeScript | text files |
| **Runs in** | the user's agent | Node, locally | nothing — it is data |
| **Handles** | language and judgement | structure and rules | persistence |
| **Deterministic** | no | yes | n/a |
| **Needs a model** | yes — the user's own | never | never |
| **Ships as** | `SKILL.md` files | `core` + `cli` | scaffolded by `michi init` |

### The rules

1. **MICHI Core contains no model call, no network access, no chat interface.**
   Not optional, not configurable, not behind a flag. A mandatory LLM, hosted AI
   service, model API or chat UI in Core is a product-level violation, not a
   design preference.
2. **Core never conducts an interview.** Where the process requires a
   conversation, Core reports what it does not know, in structured form, and
   accepts structured answers back. The talking happens a layer up.
3. **The skills contain no deterministic logic.** Selection, validation,
   hashing, state transitions and compilation live in Core. A `SKILL.md` that
   grows an algorithm is a bug — the algorithm is in the wrong layer.
4. **The coding agent is not part of MICHI.** It is an external executor,
   downstream of the compiled instruction. MICHI does not wrap it, embed it,
   orchestrate it, or depend on which one it is. Core running an allow-listed
   `pnpm test` (OQ-006) does not blur this: it observes, it never writes code.
5. **Project State is readable without MICHI.** Every file is text a person can
   open, and a `git clone` carries the whole engineering memory with it.

### Why this boundary is load-bearing

It is what makes MICHI free to run, usable offline, portable across agents,
testable without mocking a model, and scriptable in CI. Each of those follows
from Core being deterministic, and every one of them is lost the moment a model
call appears below the Experience Layer.

It also protects the product from the failure mode in `MICHI.md` §71 — becoming
thirty agents, a gateway, a broker and a dashboard. There is nothing to
orchestrate here. The user already has an agent; MICHI gives it a brief.

A future local model changes nothing below the top layer.

## Package layout

Start with three packages. Split further only when a real boundary demands it.

```text
michi/
├── packages/
│   ├── core/          the engines, schemas and state layer
│   ├── cli/           the binary; thin — argument parsing and rendering
│   └── skills/        the seven SKILL.md files and their templates
│
├── schemas/           JSON Schema, generated from the Zod definitions in core
├── templates/         what gets scaffolded into a user's project brain
├── docs/              these specifications, plus user documentation
├── examples/          worked end-to-end example projects
└── tests/             cross-package integration tests
```

**Published names are not settled** (OQ-002). `MICHI.md` assumes `@michi/core`,
`@michi/cli`, `@michi/skills` and a `michi` binary, but npm availability has not
been checked. Package and binary identity is therefore read from configuration
and referenced through one constant — never spelled out across the codebase,
docs and help text — so that resolving OQ-002 is a configuration change rather
than a rename across the repository. These specifications say "Core", "the CLI"
and "the binary" for the same reason.

`scanner/` and `adapters/` are described in §65 as separate packages. They start
as directories inside `core/`; they graduate to packages when something outside
`core` needs to depend on them alone. Premature package fragmentation is the
same mistake as premature microservices (P4).

## Engines

Each engine is a module with an explicit input type, an explicit output type,
predictable typed errors, deterministic behaviour, its own tests, and minimal
coupling to its siblings.

| Engine | Input | Output |
|---|---|---|
| `Scanner` | repository path | project map: stack, structure, symbols, config |
| `IntentEngine` | natural-language description | intent model, with unknowns preserved |
| `RequirementEngine` | intent model | `REQ-*` records, acceptance criteria, scope |
| `DecisionEngine` | requirements, constraints, project state | decision records and their lifecycle |
| `ArchitectureEngine` | requirements, constraints, locked decisions | architecture model, ADRs, tradeoffs |
| `PlanningEngine` | architecture, requirements | milestones, tasks, dependency DAG |
| `GraphEngine` | all artifacts plus the project map | nodes, edges, traversal queries |
| `ContextEngine` | task, state, graph, repository | context packet within a budget |
| `PromptEngine` | context packet plus task | compiled agent instruction |
| `VerificationEngine` | evidence from an agent run | verification verdict and record |
| `StateEngine` | any of the above | durable, validated writes to `.michi/` |

**There is no `MichiEngine`.** No god object, no orchestrator class that knows
all of them. Composition happens in the CLI command layer and in the workflows
the skills follow.

## Dependency direction

Strictly one way:

```text
cli  ────────►  core  ◄──────── skills (via the CLI's --json interface only)
                 │
                 ▼
            project brain on disk
```

Rules, enforceable by lint:

- `core` imports nothing from `cli`, `skills`, or any adapter.
- `core` makes no network calls and no model calls, ever.
- `core` **reads** the user's repository — the scanner must, to build the
  project map — and **writes** only inside `.michi/`. Read widely, write
  narrowly.
- `core` **executes** exactly one category of thing in the user's project:
  verification commands named in `verification.allow` (OQ-006). It never edits
  source code, not even to fix a failing check. That is the agent's job.
- `cli` contains no engineering logic — it parses arguments, calls one or more
  engines, and renders. If a command's body contains a real algorithm, that
  algorithm belongs in `core`.
- `skills` contain no deterministic logic that could live in `core`. A `SKILL.md`
  that grows into a program is a bug; see `SKILL_CONTRACT.md`.
- Nothing outside `adapters/` may branch on which coding agent is in use.

## How a skill, the CLI and the core fit together

```text
Human
  ↕     conversation                          ┐
AI coding agent                                │  Experience Layer
  ↕     reads .claude/skills/… (or the equivalent for its own format)
MICHI skill                                    ┘
  ↕     shells out: michi <command> --json
MICHI CLI                                      ┐
  ↕     function calls                         │  MICHI Core
MICHI core                                     ┘
  ↕     validated reads and writes
.michi/  — the project brain                      Project State
```

The agent holds the conversation. The skill tells the agent what the process is
and which commands to call. The CLI is the only way into the state. The core
guarantees the state is valid.

A consequence worth stating plainly: **every command that participates in a
conversation needs a `--json` mode**, because its real caller is an agent, not a
person at a terminal. This follows from OQ-004, locked above.

## Storage

Markdown for anything a human reads. YAML for structured records a human also
reads. JSON for machine-only structures such as the graph.

No database, no embedded store, no vector index in v1 (§67, §68). The project
brain is a directory of text files, because that makes it human-readable,
git-friendly, portable, inspectable, trivially backed up, migration-free and
dependency-free.

If real usage later proves a store is needed, that becomes a decision with
evidence behind it — not an assumption made now.

## Technology

| Concern | Choice |
|---|---|
| Language | TypeScript on Node.js |
| CLI framework | Commander |
| Schema and validation | Zod, with JSON Schema generated from it |
| Code intelligence | Tree-sitter — structural parsing, not regex |
| Tests | Vitest |
| Package manager | pnpm workspaces |
| Build | tsup |
| Release | npm, GitHub Actions, Changesets |

Tree-sitter is the one heavyweight dependency. It is justified: regex-based code
analysis produces context selections that are wrong in ways nobody can debug,
and context quality is the product (P6).

## Build order

Per §133 and §134 — a working vertical slice beats twenty disconnected commands.

```text
Phase 0   these specifications                                      ← we are here
Phase 1   michi init · scan · status        filesystem foundation
Phase 2   senior-engineer skill             intent, clarification, decision recording
Phase 3   product-planner skill             discovery, PRD, TRD, requirements
Phase 4   architecture skill                options, tradeoffs, ADRs, locking
Phase 5   context engine                    graph, selection, ranking, packets, hashing
Phase 6   implementer                       task DAG, prompt compiler, handoff
Phase 7   reviewer · tester · debugger      verification
Phase 8   agent adapters                    the other agents
Phase 9   open-source release
```

The first slice worth having, threaded through those phases:

```text
michi init → michi discover → store intent → create a requirement
→ propose a decision → user confirms → store the ADR → generate a task
→ compile the agent prompt
```

When that runs end to end for a real person with a real idea, the product
hypothesis is proved. Until then, every additional command is speculation.
