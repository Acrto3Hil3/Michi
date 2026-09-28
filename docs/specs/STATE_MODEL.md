# STATE_MODEL

Derived from `MICHI.md` §30–§33, §73, §94, §96.

The project brain is the durable state. A new agent session with no history must
be able to reconstruct where the project stands by reading these files (P5).

## The project brain

`.michi/` — *OQ-001, locked 2026-09-28.* The `.senior-engineer/` name in
`MICHI.md` §17 and §30 is legacy terminology and is never used.

```text
.michi/
├── config.yaml                 tool config: version, policies, adapter settings
│
├── project/
│   ├── identity.md             what this product is, in plain language
│   ├── constraints.md          budget, timeline, team, compliance, hard limits
│   └── preferences.md          stated user preferences that are not yet decisions
│
├── requirements/
│   ├── PRD.md                  product requirements, human-readable
│   ├── TRD.md                  technical requirements, human-readable
│   └── requirements.yaml       REQ-* records, machine-readable
│
├── architecture/
│   ├── SYSTEM.md               overall shape and why
│   ├── COMPONENTS.md           modules and their responsibilities
│   ├── DATA.md                 entities, relationships, constraints
│   └── diagrams/               mermaid or text
│
├── decisions/
│   ├── index.yaml              the decision registry — structured objects
│   └── ADR-*.md                the human-readable document for each
│
├── graph/
│   ├── nodes.json
│   └── edges.json
│
├── tasks/
│   ├── roadmap.yaml            milestones and the task DAG
│   ├── active/TASK-*.yaml
│   └── completed/TASK-*.yaml
│
├── context/
│   ├── packets/CTX-*.md        compiled context packets, kept for audit
│   └── summaries/              cached summaries keyed by hash
│
├── sessions/                   discovery and agent-run records
│
└── state/
    └── state.yaml              the single current-state file
```

Everything is text. Everything is diffable. Everything is committed to the
user's repository and travels with it.

## Project stages

```text
DISCOVERY → SPECIFICATION → ARCHITECTURE → DESIGN → PLANNING
→ IMPLEMENTATION → VALIDATION → REVIEW → RELEASE → OPERATIONS
```

A project has exactly one current stage. Stages move forward normally but may
move backward: a change request during `IMPLEMENTATION` that invalidates a
requirement returns the project to `SPECIFICATION` for that scope. Backward
movement is recorded with a reason — silent regression of stage hides
architectural drift.

| Stage | Entered when | Left when |
|---|---|---|
| `DISCOVERY` | `michi init` completes | intent is captured and confirmed by the user |
| `SPECIFICATION` | intent confirmed | requirements exist with acceptance criteria |
| `ARCHITECTURE` | requirements approved | the architecture-defining decisions are `LOCKED` |
| `DESIGN` | architecture locked | component and data design recorded |
| `PLANNING` | design recorded | task DAG exists with dependencies |
| `IMPLEMENTATION` | first task reaches `READY` | all tasks in the milestone are `DONE` |
| `VALIDATION` | implementation complete | tests and checks have run |
| `REVIEW` | validation complete | reviewer returns `PASS` |
| `RELEASE` | review passed | shipped |
| `OPERATIONS` | shipped | a new cycle begins |

## Task states

```text
PENDING → READY → RUNNING → CHANGES_DETECTED → TESTING → REVIEWING
→ VERIFIED → DONE
```

Off-path: `FAILED` · `BLOCKED` · `STALLED` · `NEEDS_HUMAN`

| State | Meaning |
|---|---|
| `PENDING` | exists; dependencies not satisfied |
| `READY` | dependencies satisfied; context can be resolved; may be handed to an agent |
| `RUNNING` | handed to a coding agent; awaiting its report |
| `CHANGES_DETECTED` | the agent reported changes; not yet tested |
| `TESTING` | tests running or reported |
| `REVIEWING` | with the reviewer |
| `VERIFIED` | evidence satisfies the acceptance criteria — **the only path to `DONE`** |
| `DONE` | closed, moved to `tasks/completed/` |
| `FAILED` | attempted and did not succeed; retryable |
| `BLOCKED` | cannot proceed — missing decision, credential, or dependency |
| `STALLED` | no progress across repeated attempts; needs a different approach |
| `NEEDS_HUMAN` | a stop condition fired; requires a person |

### Transition rules

- `PENDING → READY` only when every dependency task is `DONE`.
- `VERIFIED` requires a verification record with at least one piece of evidence
  (P3). No evidence, no `VERIFIED`, no exceptions.
- `DONE` is reachable only from `VERIFIED`.
- `REVIEWING → CHANGES_DETECTED` when the reviewer returns `CHANGES_REQUIRED`.
- Any state may go to `BLOCKED` or `NEEDS_HUMAN`; both record why.
- `FAILED → READY` on retry, incrementing `attempt`.
- After three failed attempts a task becomes `STALLED` rather than looping.

## `state/state.yaml`

The single authoritative snapshot. One file so that "where are we?" is one read.

```yaml
schema_version: 1
project_id: kebab-case-slug
stage: IMPLEMENTATION
stage_entered_at: 2026-09-28T10:14:00Z

current_milestone: inventory-mvp

architecture_status: LOCKED        # UNSET | PROPOSED | LOCKED

counts:
  requirements: 24
  decisions_locked: 9
  decisions_open: 2
  tasks_total: 18
  tasks_done: 17
  tasks_blocked: 1
  tasks_verified: 14

active_task: TASK-034

last_scan:
  at: 2026-09-28T09:02:00Z
  project_map_hash: sha256:…

updated_at: 2026-09-28T10:14:00Z
```

Counts are derived, not authoritative — they are a cache so `michi status` is
one file read. `michi status --recompute` rebuilds them from the records and
reports any drift as a bug.

## Task record

`tasks/active/TASK-034.yaml`:

```yaml
schema_version: 1
task_id: TASK-034
title: Merchant stock adjustment endpoint
description: >
  Allow an authorized merchant to increase or decrease the stock of a product
  they own, and see the resulting balance.

requirements: [REQ-021, REQ-024]
decisions: [D003, D004, D007, D009]
dependencies: [TASK-031, TASK-032]

acceptance_criteria:
  - id: AC-001
    text: Authorized merchants can increase stock
  - id: AC-002
    text: Authorized merchants can decrease stock
  - id: AC-003
    text: Stock cannot become negative
  - id: AC-004
    text: Unauthorized users receive an authorization error

scope:
  in:  [stock adjustment API, validation, authorization, persistence, tests]
  out: [warehouse management, forecasting, accounting]

status: REVIEWING
attempt: 1

context:
  packet: CTX-104
  context_hash: sha256:…
  input_hash: sha256:…

runs: [RUN-0071]

files_touched:
  - src/modules/inventory/adjust.ts
  - src/modules/inventory/adjust.test.ts

verification:
  status: PENDING          # PENDING | PASSED | FAILED
  evidence: []

created_at: 2026-09-28T09:40:00Z
updated_at: 2026-09-28T10:14:00Z
```

`input_hash` covers the task definition plus every artifact it references.
`context_hash` covers the resolved context packet. Together they answer "has
anything relevant changed since we last did expensive work here?" — see
`CONTEXT_MODEL.md`.

## Agent run record

`sessions/RUN-0071.yaml`. Append-only; a run is never edited after it closes.

```yaml
schema_version: 1
run_id: RUN-0071
task_id: TASK-034
agent: claude-code            # free-form; the core does not branch on it
started_at: 2026-09-28T09:41:00Z
ended_at: 2026-09-28T10:02:00Z
attempt: 1

input_hash: sha256:…
context_hash: sha256:…

result: REPORTED              # REPORTED | ABORTED | STOPPED_BY_CONDITION

files_touched: [src/modules/inventory/adjust.ts, src/modules/inventory/adjust.test.ts]

tests:
  run: 14
  passed: 14
  failed: 0

verification_status: PENDING

new_decisions_requested:
  - Whether stock adjustments need an audit trail

notes: >
  Agent's own summary, verbatim. Treated as a claim, not as evidence.
```

The distinction in that last line is the whole of P3: the run record stores what
the agent *said*; the verification record stores what was *observed*.

## Verification record

Attached to the task, written only by the Verification Engine:

```yaml
verification:
  status: PASSED
  verified_at: 2026-09-28T10:20:00Z
  evidence:
    - kind: TESTS
      produced_by: AGENT          # AGENT | MICHI  (see OQ-006)
      command: pnpm vitest run src/modules/inventory
      exit_code: 0
      summary: 14 passed
    - kind: TYPECHECK
      produced_by: AGENT
      command: pnpm tsc --noEmit
      exit_code: 0
    - kind: REVIEW
      produced_by: AGENT
      verdict: PASS
      by: reviewer
  criteria:
    AC-001: SATISFIED
    AC-002: SATISFIED
    AC-003: SATISFIED
    AC-004: SATISFIED
```

Evidence kinds: `TESTS` · `BUILD` · `TYPECHECK` · `LINT` · `REVIEW` · `RUNTIME`
· `SECURITY` · `SCREENSHOT` · `REPRODUCTION`.

`produced_by` records whether MICHI observed the result itself or is repeating
what the agent reported. Under P3 that distinction is the difference between
evidence and a claim, and it must survive into the record whichever way OQ-006
is decided.

Every acceptance criterion must be `SATISFIED`, `UNSATISFIED` or
`NOT_APPLICABLE` with a reason. An unaddressed criterion blocks `VERIFIED`.

## Writing rules

1. Every write goes through the State Engine. Nothing else touches `.michi/`.
2. Every write is schema-validated before it lands; an invalid write fails
   loudly and changes nothing.
3. Writes are atomic — write to a temporary file, then rename.
4. `schema_version` appears on every structured file. Readers refuse a version
   they do not understand rather than guessing.
5. Records are append-mostly. Decisions are superseded, not overwritten (P10).
   Runs are immutable once closed.
6. Derived values (`counts`, the graph, summaries) are rebuildable from the
   records. If a rebuild disagrees with the cache, the records win.
