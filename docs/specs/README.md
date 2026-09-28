# Phase 0 — Specification

These eleven documents are the engineering layer derived from [`MICHI.md`](../../MICHI.md).

`MICHI.md` is the **product** source of truth. These are the **contracts**. Where
they disagree, `MICHI.md` wins and the contract is a bug.

| Document | Answers |
|---|---|
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | What we are building, for whom, and when to say no |
| [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) | The rules every other document must obey |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The three layers, packages, engines, dependency direction |
| [STATE_MODEL.md](STATE_MODEL.md) | Project stages, task states, on-disk state schema |
| [DECISION_MODEL.md](DECISION_MODEL.md) | Decision objects, ADR documents, lifecycle, impact analysis |
| [CONTEXT_MODEL.md](CONTEXT_MODEL.md) | Context layers, packet schema, budgeting, hashing |
| [GRAPH_MODEL.md](GRAPH_MODEL.md) | Node and edge types, storage format, the queries it must answer |
| [SKILL_CONTRACT.md](SKILL_CONTRACT.md) | Shape of the seven skills and what they may not do |
| [CLI_CONTRACT.md](CLI_CONTRACT.md) | Every command: arguments, output, exit codes, side effects |
| [AGENT_ADAPTER_MODEL.md](AGENT_ADAPTER_MODEL.md) | How MICHI installs into any coding agent without leaking into the core |
| [SECURITY_MODEL.md](SECURITY_MODEL.md) | Risk classes, permission policy, enforcement points |

## Reading order

New to the project: `PRODUCT_VISION` → `DESIGN_PRINCIPLES` → `ARCHITECTURE`.

About to write code: `ARCHITECTURE` → the model for the engine you are touching →
`CLI_CONTRACT` → `SECURITY_MODEL`.

## Status

Phase 0. No implementation exists yet.

All five original open questions are **LOCKED** by the owner and applied
throughout these contracts, as is OQ-006, found while applying them. One
question — the published npm name — remains open and blocks nothing before
release.

---

## Locked decisions

These were decided by the owner on 2026-09-28. They are settled: implementation
follows them, and reopening one requires the supersession process in
[`DECISION_MODEL.md`](DECISION_MODEL.md).

### OQ-001 — Project brain directory · **LOCKED: `.michi/`**

The canonical MICHI project-state directory is `.michi/`.

`.senior-engineer/`, used in `MICHI.md` §17 and §30, is legacy terminology from
an earlier specification and must not be used as the project-state directory.
All specifications, schemas, examples, CLI behaviour, skills, tests and
implementation use `.michi/`.

`senior-engineer` remains the name of one of the seven skills. That is
intentional and is not renamed merely to retire the old directory name.

### OQ-003 — Decision ids and ADR ids · **LOCKED: distinct concepts**

A **Decision** is a structured project-state object, identified `D001`.
An **ADR** is the human-readable document describing that decision, `ADR-001`.

```text
D001  ──documented by──►  ADR-001  ──stored at──►  decisions/ADR-001-database.md
```

They are not competing identifiers for the same thing, and neither is derived
from the other by string manipulation. The decision registry is authoritative
for the mapping. See [`DECISION_MODEL.md`](DECISION_MODEL.md).

### OQ-004 — Where the intelligence lives · **LOCKED: three layers**

MICHI Core is deterministic, local-first and model-agnostic. It does not
require an LLM and does not conduct natural-language interviews itself.

Conversational intelligence belongs to the MICHI **skills**, running inside the
user's existing AI coding agent.

```text
USER → EXISTING AI AGENT → MICHI SKILL → MICHI CORE → .michi/
```

The CLI is a deterministic interface to MICHI Core. No command assumes the CLI
can hold a conversation. Machine-readable output is a first-class interface, not
a convenience flag.

No mandatory LLM, hosted AI service, model API or chat UI may enter MICHI Core.

Fully specified in [`ARCHITECTURE.md`](ARCHITECTURE.md#the-three-layers).

### OQ-005 — Token counting · **LOCKED: labelled estimate**

`ceil(chars / 4)` is acceptable for v1, and must always be presented as an
estimate with its method named:

```text
Estimated context size: ~18.4k tokens
Estimation method:      chars/4
```

Never present an estimate in the shape of an exact tokenizer result. The
architecture leaves room for tokenizer adapters later; a tokenizer is not a
dependency in v1.

### OQ-006 — Verification execution · **LOCKED: Core may run allow-listed checks**

*Raised while applying OQ-004; decided by the owner 2026-09-28.*

MICHI Core **may** execute a narrowly scoped, allow-listed set of local
verification commands and capture their real results.

This does not make MICHI a coding agent. The boundary:

```text
MICHI Core                          Existing AI agent
├── reads the project               ├── writes code
├── writes .michi/                  ├── changes dependencies
├── builds context                  ├── makes implementation decisions
├── validates state                 └── performs the implementation
├── executes approved
│   verification commands
└── captures evidence
```

MICHI runs `test`, `lint`, `typecheck`, `build` and other explicitly configured
verification commands. MICHI never edits source code — not even in response to a
failing test. That remains the agent's job.

**Why.** P3 says *no completion without evidence*. If Core can only record what
the agent reports, then "tests passed" is a claim by the party being evaluated,
and the principle cannot actually be enforced.

**Evidence stays distinguishable.** `produced_by: MICHI` for results MICHI
observed by running the command itself; `produced_by: AGENT` for results
reported to it. These are never merged into one evidence type. Full field
list in [`STATE_MODEL.md`](STATE_MODEL.md).

**Security.** Only commands named in the verification policy execute
automatically. Nothing in a README, a source comment, a test's output, a
`package.json` script body or an agent's text is authorization to run anything.
Verification execution is its own risk class and confers no other permission —
a deployment, a production database change, a credential rotation or a
destructive filesystem operation does not become automatically executable
because it appears inside a script a test command happens to call. See
[`SECURITY_MODEL.md`](SECURITY_MODEL.md#verification-execution).

**Scope for now.** Phase 1 defines the contract and the abstraction boundary.
The executor itself is built in Phase 7. Do not attempt to solve every
command-security problem before then.

---

## Open

### OQ-002 — npm package and binary names · **open, does not block Phase 1**

`MICHI.md` §57 and §65 assume `@michi/cli`, `@michi/core`, `@michi/skills` and a
`michi` binary. Availability on npm has **not been checked**.

Treated as unresolved. Package and binary identity is read from configuration
rather than hard-coded across the architecture, so resolving this later is a
configuration change, not a refactor. Must be settled before the first public
release.
