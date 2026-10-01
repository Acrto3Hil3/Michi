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

### OQ-007 — What does a second discovery session mean? · **open, blocks Phase 3**

**Found while building Phase 2. Accepted as a product-level lifecycle decision,
not an implementation detail. Not decided, and deliberately not implemented.**

#### The problem

`michi discover close` writes `requirements/requirements.yaml` from the
confirmed requirements of the session that just closed:

```text
SESSION-001 ──close──► requirements.yaml
                       REQ-001 REQ-002 REQ-003

SESSION-002 ──close──► requirements.yaml
                       REQ-001 REQ-002
                            ↑
                       REQ-003 is gone, and nobody was told
```

On a first run that is correct. On a second — the founder returns in March
wanting multi-store support — it silently drops requirements confirmed months
earlier. That contradicts the supersede-don't-delete rule the rest of MICHI
already follows (P10, `MICHI.md` §18, §77), and it decides by accident whether
MICHI's requirement system is **durable project memory** or merely a
**one-session specification generator**. Every later phase sits on top of that
answer.

#### The ten questions the decision must settle

Each needs an explicit answer. None should be guessed.

| # | Question |
|---|---|
| 1 | What does a second discovery session *mean*? |
| 2 | Do confirmed requirements persist across sessions? |
| 3 | Does a new session append to and refine the existing set, or produce a new one? |
| 4 | How is a *changed* requirement represented? |
| 5 | Is supersession mandatory, with deletion forbidden? |
| 6 | Are requirement ids globally unique across the project, or scoped to a session? |
| 7 | What happens to open questions left behind by a previous session? |
| 8 | What happens when a new session proposes a requirement that conflicts with an already-confirmed one? |
| 9 | Does a closed session stay immutable and auditable? |
| 10 | What does `discover close` write when prior requirements already exist? |

#### The three options

**A — Replace.** Each discovery produces the complete requirement set; closing
overwrites what was there.

**B — Cumulative.** Discovery is additive. Requirements are project-level and
persistent; a later session adds to them, and anything no longer wanted is
superseded explicitly rather than dropped.

**C — Once-only.** Discovery runs once. After `SPECIFICATION`, `discover start`
is refused and change goes through a separate mechanism built for it.

A fourth shape is worth naming because it sits between B and C: **B′ —
snapshotted replacement**, where each session produces a new specification
version and the previous one is archived rather than lost. It keeps history,
but it makes "the current requirements" a version lookup rather than a set, and
it needs a versioning mechanism that does not exist yet.

#### How each option answers the ten questions

| # | A — Replace | B — Cumulative | C — Once-only |
|---|---|---|---|
| 1 | a fresh specification | a continuation of the same specification | not permitted |
| 2 | no | yes | n/a — only one session ever |
| 3 | produces a new set | appends and refines | n/a |
| 4 | by disappearing and reappearing | a new requirement superseding the old | by whatever the later mechanism decides |
| 5 | no — deletion is the mechanism | yes, mandatory | deferred to the later mechanism |
| 6 | session-scoped is survivable | **must become project-global** | session-scoped is fine |
| 7 | discarded | carried forward, or closed with a reason | n/a |
| 8 | no conflict is possible, because nothing persists | must be detected and resolved explicitly | n/a |
| 9 | yes, but it no longer matches `requirements.yaml` | yes, and it stays consistent | yes |
| 10 | the new set only | the merged set, with supersession recorded | nothing — it cannot run |

Two rows carry most of the cost. **Row 6**: under B, requirement ids move from
per-session to project-global, which is the change that makes this more than a
patch. **Row 8**: B is the only option that has to detect a new proposal
conflicting with a confirmed requirement, and that needs its own rule — most
likely refuse, and require an explicit supersession instead.

#### Recommendation

**B — cumulative**, with:

- requirement ids allocated project-wide from the registry, not from the session
- a changed requirement represented as a new requirement that `supersedes` the
  old one, exactly as decisions already work
- deletion forbidden; superseded requirements kept and marked
- a conflicting proposal **refused** with a pointer to supersession, rather than
  silently winning
- previous open questions carried into the new session, so nothing is lost by
  starting a second one
- closed sessions immutable; `requirements.yaml` the merged current set, with
  each requirement naming the session that confirmed it

The reasoning: B is the only option consistent with how decisions already
behave, and a founder coming back with a change is the normal case, not the
exception. C is defensible but splits the discovery vocabulary in two before we
know what the second mechanism needs. A is the current behaviour and is the one
option I would argue against.

**This is a recommendation, not a decision.** Per P2 it needs an explicit
answer, and per the owner's instruction it should be recorded as a locked
decision with an ADR before Phase 3 begins.

#### What is deliberately not being done

Phase 2's implementation is unchanged and stays that way until this is
answered:

- `discover close` still replaces `requirements.yaml` (behaviour A)
- requirement ids are still allocated per session
- `discover start` still does not refuse on a `SPECIFICATION`-stage project

None of those are exercised by the Phase 2 tests, so the existing verification
remains valid. A second `discover start` after `close` is **untested
territory**, not supported behaviour.

### OQ-002 — npm package and binary names · **open, does not block Phase 1**

`MICHI.md` §57 and §65 assume `@michi/cli`, `@michi/core`, `@michi/skills` and a
`michi` binary. Availability on npm has **not been checked**.

Treated as unresolved. Package and binary identity is read from configuration
rather than hard-coded across the architecture, so resolving this later is a
configuration change, not a refactor. Must be settled before the first public
release.
