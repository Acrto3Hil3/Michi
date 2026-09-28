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

Four of the five original open questions are **LOCKED** by the owner and applied
throughout these contracts. One remains open and does not block Phase 1. One new
question was found while applying them, and is open.

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

---

## Open

### OQ-002 — npm package and binary names · **open, does not block Phase 1**

`MICHI.md` §57 and §65 assume `@michi/cli`, `@michi/core`, `@michi/skills` and a
`michi` binary. Availability on npm has **not been checked**.

Treated as unresolved. Package and binary identity is read from configuration
rather than hard-coded across the architecture, so resolving this later is a
configuration change, not a refactor. Must be settled before the first public
release.

### OQ-006 — Does MICHI Core execute anything in the user's project? · **open, blocks Phase 7**

**Found while applying OQ-004.** Not decided here.

`MICHI.md` §51 gives a permission policy containing `tests: AUTO` and
`git_diff: AUTO`, which reads as MICHI running those commands itself. §95 lists
tests, build, lint and typecheck as verification evidence.

But under the three layers now locked by OQ-004, the coding agent is the
external executor and MICHI Core is a deterministic state layer. If Core never
runs anything, then `tests: AUTO` governs an action MICHI never takes, and all
evidence is recorded second-hand from the agent's report.

The two readings produce different products:

**A — Core records only.** `michi test --record <file>` ingests what the agent
ran. Core needs no subprocess runner. Maximum layer purity. Weakness: every
piece of evidence is a claim the agent made about itself, which sits awkwardly
against P3 (*no completion without evidence*) — the whole point of which is that
an agent's self-report is not evidence.

**B — Core may run read-only verification commands.** Core can execute a
configured test, build, lint or typecheck command and capture the real exit code
and output. Still no model, still deterministic, still local. Verification
becomes genuinely independent of the agent's claims. Weakness: Core now spawns
processes in the user's repository, which is a real expansion of its blast
radius and makes the permission policy load-bearing.

**Recommendation: B**, narrowly scoped — an allow-list of verification commands
read from `.michi/config.yaml`, never inferred, never arbitrary, governed by the
existing `ASK`/`AUTO`/`BLOCK` policy. P3 is one of the top-three principles, and
under A it cannot actually be enforced.

Until this is decided, the contracts describe evidence capture in a way that
works under either reading: `SECURITY_MODEL.md` keeps the policy as written in
`MICHI.md`, and `STATE_MODEL.md` records for each piece of evidence *who
produced it*. Phase 7 cannot be specified in detail without an answer, but
Phases 1–6 are unaffected.
