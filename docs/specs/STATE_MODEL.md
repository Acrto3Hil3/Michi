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
│   ├── map.json                what the scanner found in the repository
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

`project/map.json` is the one regenerated file: `michi scan` rebuilds it from
the repository, and it is a cache, not a record. Its identity is a hash that
excludes `generated_at` and every ignored directory — including `.michi/`
itself — so that a scan reports a change only when the user's project actually
changed.

`init` also writes `.michi/README.md`, a plain-language note explaining what
the folder is. The directory turns up in someone's repository; if they cannot
code, it should still be obvious what it is and that deleting it loses
something.

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

## The product specification

*Added in Phase 3. `MICHI.md` §22, §60 and §76 describe product planning and
scope but specify no structure, so it is defined here.*

Discovery answers *what the user wants*. The specification answers *what we are
building first, for whom, and how we will know it works.*

```text
requirements.yaml          the requirements, canonical, confirmed by the user
        ▲
        │ references, never copies
        │
specification.yaml         personas · use cases · scope · acceptance criteria
        │
        ▼
PRD.md                     the whole thing in plain language, generated
```

`requirements/specification.yaml`. One per project — not a session. It evolves
in place, the way the decision registry does.

### Requirements stay canonical

The specification **references** requirements by id and never copies their
content. There is exactly one requirement store, and Phase 2 owns it. A
specification that mentions a requirement which is not active is invalid.

### Two kinds of acceptance criteria, and why both exist

| | Lives on | Authored | Authority on |
|---|---|---|---|
| `acceptance_criteria: string[]` | the requirement | discovery, confirmed by the user | what was **agreed** |
| `AC-*` criterion | the specification | product planning | how it will be **checked** |

This is not a duplicate source of truth. The first is a promise in the user's
words — "a store owner can add a product". The second is a test a later phase
can execute — "given a product with 5 units, when 1 is sold, then stock shows
4". `MICHI.md` §50 already uses `AC-*` for exactly this testable form.

Each `AC-*` names the requirement it checks. A requirement in the MVP with no
`AC-*` is a **coverage gap**, and `plan close` refuses while any exists.

### The record

```yaml
schema_version: 1
status: DRAFT                  # DRAFT | CONFIRMED | PUBLISHED
next_persona_id: 2
next_use_case_id: 3
next_criterion_id: 4
next_out_of_scope_id: 2
updated_at: 2026-10-01T11:00:00Z

personas:
  - id: PER-001
    name: Store owner
    description: Runs a single shop and does the stock counting themselves.
    goals: [Know what is actually on the shelf, Never run out unexpectedly]

use_cases:
  - id: UC-001
    title: Correct a stock count after a delivery
    persona: PER-001
    trigger: A delivery arrives and the recorded quantity is now wrong.
    steps:
      - The owner finds the product
      - The owner records how many arrived
      - The new quantity is shown
    requirements: [REQ-001, REQ-003]

criteria:
  - id: AC-001
    requirement: REQ-004
    kind: GWT
    given: [a product has 5 units in stock]
    when: 1 unit is recorded as sold
    then: [the current stock shows 4 units]

scope:
  - requirement: REQ-001
    scope: MVP                 # MVP | FUTURE | OUT_OF_SCOPE | UNKNOWN
    reason: Nothing else works without products existing.
    confirmed_by: user
    confirmed_at: 2026-10-01T11:00:00Z

out_of_scope:
  - id: OOS-001
    title: Accounting and bookkeeping
    reason: The owner already uses a separate accountant.

confirmed_by: null
confirmed_at: null
```

Every id is project-wide, sequential, allocated by Core, and never reused — the
same rule requirements follow.

### Scope

Four values, from `MICHI.md` §76: `MVP` · `FUTURE` · `OUT_OF_SCOPE` ·
`UNKNOWN`. A requirement with no scope assignment is `UNKNOWN`.

A scope assignment carries a status of its own:

```text
PROPOSED ──► CONFIRMED        the human agreed to the scope call
```

Whether a feature ships in the first version is the most consequential product
call a founder makes, and MICHI may not make it for them (P2). Schema
validation refuses a `CONFIRMED` assignment with no `confirmed_by` and
`confirmed_at` — the same mechanism that protects requirement confirmation.

`FUTURE` is a promise, not a deletion. `OUT_OF_SCOPE` means never. The two are
kept distinct because conflating them is how a founder loses track of what they
were told would come later.

`out_of_scope` entries are for things that are **not** requirements at all —
whole areas the product deliberately will not cover. They need no requirement
to point at.

### Contradictions with locked decisions

Marking a requirement `OUT_OF_SCOPE` while a `LOCKED` decision names it in
`affects_requirements` is **refused**. The decision was made for work that is
now being dropped, and silently leaving it locked would strand it. The fix is
to supersede the decision first, deliberately.

This is the only mechanical contradiction MICHI can detect between scope and
decisions. It cannot tell that a use case implies multi-location when a locked
decision assumed one shop, and the contract does not pretend otherwise.

### What `plan close` produces

`close` requires `status: CONFIRMED` — which requires a human — and refuses
while:

- any active requirement's scope is `UNKNOWN` or still only `PROPOSED`
- any `MVP` requirement has no `AC-*` criterion
- the specification references a requirement that is not active

It then writes `requirements/PRD.md` and advances the project
`SPECIFICATION → ARCHITECTURE`.

`TRD.md` is **not** written in Phase 3. A technical requirements document is
assembled from locked architectural decisions, and those are Phase 4's output.
Writing an empty one now would be scaffolding for later.

## Discovery sessions

*Added in Phase 2. `MICHI.md` §59 and §86 describe discovery and the intent
model but specify neither a lifecycle nor a record, so both are defined here.*

A **conversation** is temporary. A **session** is the structured process that
conversation feeds. The distinction is the whole reason discovery survives
closing a chat window:

```text
Conversation  →  Session  →  Intent  →  Requirements  →  Decisions  →  .michi/
   ephemeral      durable     durable      durable         durable
```

`sessions/SESSION-001.yaml`. One session is open at a time.

### Lifecycle

```text
STARTED ──► GATHERING ──► READY_FOR_CONFIRMATION ──► CONFIRMED ──► COMPLETED
```

| State | Meaning | Left when |
|---|---|---|
| `STARTED` | session opened, nothing ingested yet | the first update lands |
| `GATHERING` | answers and draft requirements accumulating | no open questions remain and at least one requirement exists |
| `READY_FOR_CONFIRMATION` | MICHI believes it understands; the human has not said so | the human confirms the intent |
| `CONFIRMED` | the human signed off on the intent and its requirements | `close` runs |
| `COMPLETED` | artifacts written, project advanced to `SPECIFICATION` | terminal |

The state is **derived**, not asserted: Core recomputes it from the session's
contents after every update. A skill cannot set it directly, which is what
stops an agent declaring itself finished.

Transitions only ever move forward. A new answer that reopens a question moves
`READY_FOR_CONFIRMATION` back to `GATHERING` — that is not a failure, it is
discovery working. `CONFIRMED` is the one state that cannot be reached by
recomputation, because it requires a human.

### The record

```yaml
schema_version: 1
session_id: SESSION-001
status: GATHERING
opened_at: 2026-09-29T09:00:00Z
updated_at: 2026-09-29T09:40:00Z
closed_at: null

intent:
  problem:
    value: Small retailers lose track of stock and discover it too late.
    confidence: STATED
  goal:
    value: Let a shop owner see and correct stock without a spreadsheet.
    confidence: STATED
  users:
    value: [Store owner, Shop assistant]
    confidence: STATED
  desired_outcome:
    value: Stock counts that are trusted, and a warning before running out.
    confidence: INFERRED
  constraints:
    value: []
    confidence: UNKNOWN
  assumptions:
    value: [One shop, not a chain]
    confidence: ASSUMED

answers:
  - key: primary_user
    value: Store owner
    confidence: STATED
    question: Who will actually use this every day?
    recorded_at: 2026-09-29T09:12:00Z

open_questions:
  - id: Q-004
    text: What should happen when stock goes negative?
    why: It changes whether corrections need an approval step.
    asked_at: 2026-09-29T09:40:00Z

requirements:
  - id: REQ-001
    title: Manage products
    description: A store owner can add, edit and retire the products they stock.
    type: functional
    priority: high
    status: CONFIRMED
    origin_confidence: STATED
    acceptance_criteria:
      - A store owner can add a product
      - A store owner can edit a product
    confirmed_by: user
    confirmed_at: 2026-09-29T09:35:00Z

intent_confirmed_by: null
intent_confirmed_at: null
```

### Confidence, and why it never upgrades itself

Answers and intent fields carry a confidence:

| | Meaning |
|---|---|
| `STATED` | the human said it |
| `INFERRED` | MICHI worked it out from what they said |
| `ASSUMED` | MICHI is proceeding as if it were true, and has said so |
| `UNKNOWN` | not established |

Core never promotes one of these to another. An inferred answer that later
turns out to be right is still inferred unless the human states it, because the
record has to be able to answer "did they actually say that?" months later
(P9).

### Requirements

*OQ-007, locked 2026-10-01: discovery is cumulative and requirements are
project-level.*

Requirement ids are stable, sequential (`REQ-001`) and **project-wide** —
allocated from the requirements registry, never from the session, and never
reused, including for requirements that were only ever proposed and then
rejected. Two sessions can never both produce a `REQ-001`.

The shape follows `MICHI.md` §98, with the status vocabulary made explicit:

```text
PROPOSED ──► CONFIRMED ──► SUPERSEDED     replaced by a later requirement
         └─► REJECTED                     the human said no
```

There is no delete. A requirement that is no longer wanted is superseded by the
one that replaces it, and both are kept — the same rule decisions follow (P10).

**A requirement reaches `CONFIRMED` only with a recorded `confirmed_by` and
`confirmed_at`.** Schema validation refuses it otherwise. This is the single
most important rule in the phase: without it, an agent's inference becomes a
project requirement by default, and everything downstream — architecture,
tasks, code — inherits a thing nobody asked for.

`origin_confidence` records how the requirement arose. A requirement may be
`CONFIRMED` and still record that MICHI inferred it originally; those are
different facts and both are worth keeping.

Rejected requirements are kept, not deleted — knowing what was turned down
stops it being proposed again next month.

### The requirements registry

`requirements/requirements.yaml` is the project's requirement set and the
authority on id allocation:

```yaml
schema_version: 1
next_requirement_id: 6
updated_at: 2026-10-01T09:40:00Z
requirements:
  - id: REQ-001
    title: Manage products
    status: CONFIRMED
    confirmed_by: user
    confirmed_at: 2026-09-29T09:35:00Z
    confirmed_in: SESSION-001
    supersedes: null
    superseded_by: null
    # … the rest of the §98 shape
  - id: REQ-003
    title: Warn before running out
    status: SUPERSEDED
    superseded_by: REQ-005
    confirmed_in: SESSION-001
```

`next_requirement_id` is bumped the moment a requirement is *proposed*, not
when it is confirmed. A rejected proposal therefore still spends its number,
which is what makes ids safe to quote in conversation before anyone has agreed
to anything.

`confirmed_in` names the session that confirmed each requirement, so the
registry stays traceable back to the conversation it came from.

### Conflicting proposals

A proposal whose title matches an active requirement's title — compared
case- and punctuation-insensitively — is **refused** unless it declares
`supersedes`. The founder restating something already agreed is the common
case, and silently creating a near-duplicate requirement is worse than an
error message.

This is a guard, not a judgement. MICHI cannot tell whether two differently
worded requirements mean the same thing, and it does not pretend to.

### What `close` produces

`close` requires `status: CONFIRMED` and refuses otherwise. It then:

- **merges** this session's confirmed requirements into the registry, applying
  any supersessions they declare
- writes `project/identity.md` — the intent, in plain language
- marks the session `COMPLETED` with `closed_at`, after which it is never
  written again
- advances the project stage to `SPECIFICATION`

Merges, not replaces. A requirement another session confirmed is never removed
by closing this one.

Rejected and still-proposed requirements stay in the session record. They are
not promoted, and they are not lost.

A second session on a project already past `DISCOVERY` is permitted and
ordinary — a founder returning with a change is the normal case, not an
exception. The stage is not moved backwards by starting one.

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
      produced_by: MICHI          # MICHI ran it and observed this
      allow_key: test
      command: pnpm vitest run src/modules/inventory
      cwd: .
      started_at: 2026-09-28T10:18:02Z
      ended_at: 2026-09-28T10:18:29Z
      exit_code: 0
      output_summary: "14 passed, 0 failed"
      output_truncated: false
      run_id: RUN-0071
    - kind: TYPECHECK
      produced_by: MICHI
      allow_key: typecheck
      command: pnpm tsc --noEmit
      cwd: .
      started_at: 2026-09-28T10:18:30Z
      ended_at: 2026-09-28T10:18:41Z
      exit_code: 0
      output_summary: ""
      output_truncated: false
      run_id: RUN-0071
    - kind: REVIEW
      produced_by: AGENT          # reported to MICHI, not observed by it
      verdict: PASS
      by: reviewer
      run_id: RUN-0071
  criteria:
    AC-001: SATISFIED
    AC-002: SATISFIED
    AC-003: SATISFIED
    AC-004: SATISFIED
```

Evidence kinds: `TESTS` · `BUILD` · `TYPECHECK` · `LINT` · `REVIEW` · `RUNTIME`
· `SECURITY` · `SCREENSHOT` · `REPRODUCTION`.

### Provenance

`produced_by` is the most important field in the record.

| | Meaning |
|---|---|
| `MICHI` | Core ran the command itself and observed this result |
| `AGENT` | the coding agent reported this result to MICHI |

Under P3 that is the difference between evidence and a claim, and the two are
**never merged into one evidence type**. A verdict that rests on `AGENT`
evidence alone is a verdict that trusts the party being evaluated, and any
report must be able to say so.

`MICHI`-produced evidence carries the full process record — `allow_key`,
`command`, `cwd`, `started_at`, `ended_at`, `exit_code`, `output_summary`,
`output_truncated`, `run_id`. `allow_key` names the entry in
`verification.allow` that authorised it (OQ-006), so every execution traces back
to something the user wrote down.

`AGENT`-produced evidence carries whatever the agent reported and is never
decorated with fields that imply MICHI observed it.

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
