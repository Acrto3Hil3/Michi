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

## Where intelligence lives

The single most important boundary in the system:

```text
MICHI core         deterministic.   state, schemas, selection, compilation, validation
The coding agent   probabilistic.   conversation, judgement, prose, writing code
```

The core contains **no model calls and no network access**. Everything it does
is reproducible from the same inputs. If a piece of work requires judgement, the
core does not do it — it prepares the structured material for a skill running
inside the user's agent, and persists what comes back.

This is what makes MICHI cheap, offline-capable, provider-neutral and testable.

## Package layout

Start with three packages. Split further only when a real boundary demands it.

```text
michi/
├── packages/
│   ├── core/          @michi/core     engines, schemas, state, no I/O beyond the project brain
│   ├── cli/           @michi/cli      the michi binary; thin — argument parsing and rendering
│   └── skills/        @michi/skills   the seven SKILL.md files and their templates
│
├── schemas/           JSON Schema, generated from the Zod definitions in core
├── templates/         what gets scaffolded into a user's project brain
├── docs/              these specifications, plus user documentation
├── examples/          worked end-to-end example projects
└── tests/             cross-package integration tests
```

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
- `core` makes no network calls and reads no files outside the project root.
- `cli` contains no engineering logic — it parses arguments, calls one or more
  engines, and renders. If a command's body contains a real algorithm, that
  algorithm belongs in `core`.
- `skills` contain no deterministic logic that could live in `core`. A `SKILL.md`
  that grows into a program is a bug; see `SKILL_CONTRACT.md`.
- Nothing outside `adapters/` may branch on which coding agent is in use.

## How a skill, the CLI and the core fit together

```text
Human
  ↕     conversation
AI coding agent
  ↕     reads .claude/skills/… (or the equivalent for its own format)
MICHI skill
  ↕     shells out: michi <command> --json
MICHI CLI
  ↕     function calls
MICHI core
  ↕     validated reads and writes
.michi/  — the project brain
```

The agent holds the conversation. The skill tells the agent what the process is
and which commands to call. The CLI is the only way into the state. The core
guarantees the state is valid.

A consequence worth stating plainly: **every command that participates in a
conversation needs a `--json` mode**, because its real caller is an agent, not a
person at a terminal. See open question OQ-004 in `README.md`.

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
