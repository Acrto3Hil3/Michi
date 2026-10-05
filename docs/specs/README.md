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

Six of the seven questions raised so far are **LOCKED** by the owner and
applied throughout these contracts. One — the published npm name — remains
open and blocks nothing before release.

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

### OQ-007 — A second discovery session · **LOCKED: cumulative**

*Raised while building Phase 2; decided by the owner 2026-10-01.*

Discovery is **cumulative**. Requirements are project-level and persistent. A
later session adds to them, and anything no longer wanted is **superseded
explicitly, never deleted** — exactly as decisions already behave.

```text
SESSION-001 ──close──► REQ-001  REQ-002  REQ-003
SESSION-002 ──close──► REQ-001  REQ-002  REQ-003 (SUPERSEDED by REQ-005)
                       REQ-004  REQ-005
```

#### The ten answers

| # | Question | Answer |
|---|---|---|
| 1 | What does a second discovery session mean? | A continuation of the same specification, not a replacement for it. |
| 2 | Do confirmed requirements persist across sessions? | Yes. Closing a session never removes a requirement another session confirmed. |
| 3 | Append and refine, or produce a new set? | Append and refine. |
| 4 | How is a changed requirement represented? | As a new requirement that `supersedes` the old one. The old one is marked `SUPERSEDED` and kept. |
| 5 | Is supersession mandatory? | Yes. There is no delete. |
| 6 | Are requirement ids project-wide or session-scoped? | **Project-wide.** Allocated from the requirements registry, never from the session, and never reused — including for requirements that were only ever proposed and then rejected. |
| 7 | What happens to a previous session's open questions? | Nothing, because they cannot survive. See the note below. |
| 8 | What if a new proposal conflicts with a confirmed requirement? | **Refused.** The proposal must declare `supersedes` explicitly. A conflicting proposal never silently wins. |
| 9 | Does a closed session stay immutable? | Yes. A `COMPLETED` session is never written again, and remains the audit record of what was confirmed when. |
| 10 | What does `close` write when prior requirements exist? | The merged current set: everything already in the registry, plus this session's confirmed requirements, with supersessions applied. |

#### Two consequences worth naming

**Conflict needs a mechanical definition** (question 8). MICHI cannot judge
whether two requirements mean the same thing. The rule is therefore narrow and
honest: a proposal whose title matches an active requirement's title — compared
case- and punctuation-insensitively — is refused unless it declares
`supersedes`. That catches the common case (the founder restating something
already agreed) and will miss a genuine semantic duplicate worded differently.
It is a guard, not a judgement, and it is documented as such rather than
oversold.

**Question 7's answer is "nothing", and that is not an evasion.** A session can
only reach `COMPLETED` through `close`, `close` requires `CONFIRMED`, and
`CONFIRMED` is unreachable while any question is open. So open questions
structurally cannot survive a closed session. Carry-forward is therefore
**specified but deliberately not implemented** — writing it now would be dead
code for a path that does not exist. If an abandon path is ever added, this
rule is what it must obey, and there is a test asserting the invariant that a
completed session has no open questions.

#### What changed in the implementation

- Requirement ids come from `requirements/requirements.yaml`, which now holds
  `next_requirement_id` alongside the requirements themselves.
- `REQUIREMENT_STATES` gained `SUPERSEDED`; requirements gained `supersedes`
  and `superseded_by`.
- `discover close` merges rather than replaces.
- `discover start` is permitted on a project past `DISCOVERY`, because that is
  the normal case under this decision.

---

---

### OQ-008 — A published specification · **LOCKED: cumulative with revisions**

*Raised while building Phase 3; decided by the owner 2026-10-02.*

One evolving specification. A published specification **may** be changed, and a
change to an already-published one **must** create a durable revision record.

```text
PUBLISHED
    ↓  plan update + { revision: { reason, by } }
REV-001  ── what changed · why · who asked · when
    ↓
specification updated, sign-off dropped
    ↓  the user confirms again
    ↓  plan close — gates re-run
PUBLISHED AGAIN, publication recorded
```

The principle the owner stated, which the whole design now follows:

> Nothing important disappears. Nothing important changes silently. Human
> decisions remain attributable.

#### The seven decisions

| Question | Decision |
|---|---|
| Published specification changes | **Cumulative with revisions.** No document versioning, no `SPEC-*`, no per-version PRD files. |
| Revision identity | `REV-001`, project-wide, sequential, never reused |
| Second discovery after architecture | The project **moves back** to `SPECIFICATION`, because upstream requirements changed |
| Downstream artifacts after that | Marked **needing review**, never deleted |
| Removing a persona, use case or criterion | **Never hard-deleted.** An explicit, attributed tombstone with a reason. |
| Requirement removal | Unchanged — requirements accumulate and supersede (OQ-007). No second removal system. |
| PRD history | The current PRD regenerates; the revision history records what, why and who |

#### What Core derives rather than trusts

A revision's `reason` and `confirmed_by` come from the caller. Its `changes`
are **computed by Core** from what the update actually did — `REQ-003 scope MVP
→ FUTURE`, `AC-003 removed (…)`. An agent's summary of its own edit is a claim;
the diff is a fact, and the same distinction that governs verification evidence
applies here.

A revision that changes nothing is refused. Core requires the reason to be a
sentence rather than a word, and does not judge further: prose quality belongs
to the skill, which can read the room.

#### The stage is readiness, not progress

`DISCOVERY → … → ARCHITECTURE` is not a high-water mark. New confirmed
requirements move a project back to `SPECIFICATION` with a recorded reason,
because downstream engineering assumptions may no longer hold. Nothing
downstream is destroyed; it is listed in `needs_review` until the specification
is published again.

#### REMOVED is not a scope value

`MVP` / `FUTURE` / `OUT_OF_SCOPE` / `UNKNOWN` describe where a **requirement**
sits. `ACTIVE` / `REMOVED` is the lifecycle of a **product artifact**. "We want
this later" and "this was in the specification and the user took it out" are
different facts, and collapsing them loses the one that explains the history.

#### What this does not solve

An architecture decision or a task created against an earlier scope is not
invalidated by a revision; `needs_review` makes staleness *visible* at the
specification level and nothing more. The full question — how downstream
artifacts are invalidated when scope changes — is deferred, and the owner's
instruction was explicit: do not build a staleness engine in this phase. It
will need raising when Phase 4 produces the first real downstream artifact.

---

---

## Open

### OQ-009 — How is a stale downstream artifact invalidated? · **open, blocks nothing in Phase 5 yet**

**Deferred from OQ-008; raised now because Phase 4 has produced the first real
downstream artifact.** Not decided.

A republished specification marks the architecture `needs_review` — the minimal
marker OQ-008 asked for, and it works. What it says is *"the architecture as a
whole may no longer fit"*. What it cannot say is **which decision broke**.

```text
specification revised
        ↓
needs_review: [architecture]        ← what exists today
        ↓
??? which of D001..D009 is now wrong?
??? what happens to a task that was generated from one of them?
```

Today the skill re-reads every locked decision and judges. That is tolerable at
one decision and useless at thirty — and in Phase 6 a task will have been
generated from a decision, so the question stops being cosmetic.

**A — Keep the coarse marker.** One flag per artifact kind. The skill reviews
everything. Cheapest, and the review becomes performative once there are enough
decisions to skim.

**B — Per-decision review flags.** A decision whose `affects_requirements`
intersect what changed is marked `needs_review`; the rest are untouched. Core
can compute this: it already knows which requirements moved in a revision's
`changes`, and which decisions name them. Narrow, mechanical, and it makes the
review list short enough to actually be read.

**C — A dependency graph.** `GRAPH_MODEL.md` already specifies the edges
(`GOVERNS`, `CONSTRAINS`, `IMPLEMENTS`), and Phase 5 builds the graph engine.
Invalidation becomes a traversal. Most capable, and it ties this question to a
phase that has not been built.

**Recommendation: B**, with C arriving naturally once Phase 5 exists. B is
computable from state that is already canonical, needs no new infrastructure,
and turns "review the architecture" into "review these two decisions" — which
is the difference between a review happening and not.

**Current behaviour is A**, named here rather than left to be found. It satisfies
the OQ-008 rule and blocks nothing in Phase 5's early work. It becomes urgent
when tasks exist that were built on a decision that has since moved.

### OQ-002 — npm package and binary names · **open, does not block Phase 1**

`MICHI.md` §57 and §65 assume `@michi/cli`, `@michi/core`, `@michi/skills` and a
`michi` binary. Availability on npm has **not been checked**.

Treated as unresolved. Package and binary identity is read from configuration
rather than hard-coded across the architecture, so resolving this later is a
configuration change, not a refactor. Must be settled before the first public
release.

---

## Appendix — the OQ-007 analysis

Kept because the options not taken are part of the record (P10).

### The question as it stood before it was answered

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

---

## Appendix — the OQ-008 gate

### The OQ-008 gate as it stood before it was answered

_Kept because the options not taken are part of the record (P10)._

#### 1. The exact problem

`plan close` publishes the specification. After that, `plan update` is refused
outright and there is no path back. A founder returning with "low-stock alerts
shouldn't be in the first version any more — we want barcode scanning instead"
has no route through MICHI.

Worse, and verified on the built binary rather than reasoned about: **the
project can already be driven into a state it cannot leave.**

```text
discover close   →  REQ-001 confirmed, stage SPECIFICATION
plan close       →  specification PUBLISHED, stage ARCHITECTURE
discover start   →  permitted (OQ-007: discovery is cumulative)
discover close   →  REQ-002 confirmed, stage dragged back to SPECIFICATION
plan update      →  REFUSED. REQ-002 can never be placed in or out of scope.
```

`plan status` in that state contradicts itself: *"1 requirement not yet placed"*
under Outstanding, and *"The specification is published. Architecture comes
next"* under Next.

This corrects the Phase 3 report, which said OQ-008 blocked nothing. Phase 4's
implementation is unaffected — architecture reads the published specification
and does not change it — but the state above is reachable now, and no option
below can be chosen without also deciding it.

A second, smaller interaction surfaced alongside it: `discover close`
unconditionally sets the stage to `SPECIFICATION`, so a second discovery drags
an `ARCHITECTURE`-stage project backwards. Defensible (the requirements changed,
so re-specify) but nobody decided it.

#### 2. Current behaviour

`plan update` on a `PUBLISHED` specification raises `CONFLICT` (exit 7) with
"This specification has already been published. Nothing was changed." The
specification is frozen permanently. This is behaviour nobody chose; it is what
falls out of having no change path.

#### 3. The options

**A — Re-open.** An update on a published specification returns it to `DRAFT`.
`close` runs again and regenerates `PRD.md` over the top.

**B — Versioned.** Each `close` mints a specification version (`SPEC-001`,
`SPEC-002`). The previous version and its PRD are kept. Downstream artifacts can
cite the version they were decided against.

**C — Cumulative.** One specification that keeps evolving, the way the decision
registry does. `close` becomes re-runnable and appends a publication record
(when, confirmed by whom, the scope at that moment).

**D — Cumulative with revisions.** C, plus: changing a published specification
requires a reason, recorded as a revision (`REV-001`) naming what changed and
who asked for it.

#### 4. Effects

| | A — Re-open | B — Versioned | C — Cumulative | D — C + revisions |
|---|---|---|---|---|
| **Lifecycle** | `PUBLISHED → DRAFT → … → PUBLISHED`, cyclic, no trace | new version starts `DRAFT`, inherits content, closes | one document, `close` re-runnable | as C, each post-publication change recorded |
| **Requirements** | untouched — canonical, Phase 2's | untouched | untouched | untouched |
| **MVP / FUTURE / OUT_OF_SCOPE** | assignment replaced in place; prior call lost | scope is per version; "MVP as of SPEC-002" is answerable | replaced in place; publication records capture scope at each publish | as C, plus why it moved |
| **Acceptance criteria** | accumulate; no removal path exists | per version; a criterion can be dropped without losing the record | accumulate; no removal path | accumulate; removal would be a recorded revision |
| **PRD** | overwritten, previous content gone | one PRD per version, all kept | regenerated; prior state derivable from publication records | same as C |
| **TRD** | not written yet (Phase 4) | Phase 4 would likely cite a spec version | Phase 4 reads the current specification | same as C |
| **Architecture** | an ADR locked against the old MVP is silently stranded | an ADR can name the version it answered | coarse: an ADR can cite a publication date | as C, and the revision says what moved under it |
| **Traceability** | current state only | strongest — every artifact can name a version | current state + publication timeline | current state + timeline + reasons |
| **Future tasks** | a task built for a now-`FUTURE` requirement is undetectable | a task can record its authorising version; staleness becomes detectable | a task can cite a publication | same as C |
| **History / audit** | none beyond git | complete | publication-level | publication- and change-level |

#### 5. Recommendation: **D**

C's cost plus one required field and one id space, and it keeps the thing MICHI
exists to keep: **why**.

A is rejected outright. Overwriting a published PRD with no record is the
silent-loss failure this product is built to prevent, and it is the same mistake
OQ-007 corrected for requirements — choosing it here would make the two
inconsistent.

B is the strongest consistency story and the wrong amount of machinery today.
Nothing else in `.michi/` is versioned; building document versioning for one
user is the premature generality P4 forbids. It becomes right the moment someone
needs to read a PRD *as it was*, and nobody has asked for that.

C over B because the specification already behaves cumulatively — scope
assignments replace in place rather than accumulating — so C is what the data
model is already shaped for. D over C because a changelog of *what* without
*why* is the artifact everyone stops reading.

#### 6. Risks of the recommendation

- **The published PRD is still overwritten.** Only `git log` recovers the old
  document, and that is outside MICHI's model. If reading a past PRD verbatim
  ever matters, D does not provide it and B must be revisited.
- **Reasons can rot.** A required field invites "updated scope" as the reason.
  Mitigation is in the skill, not the schema, and the skill cannot be tested
  behaviourally — the limitation already recorded in `SKILL_CONTRACT.md`.
- **It does not fix downstream staleness.** An architecture decision or task
  made against the earlier scope is not invalidated by a revision. B would make
  that *detectable*; nothing here makes it *handled*. See §9.
- **Re-runnable `close` needs its own gate.** Re-publishing must re-check the
  same conditions (no unplaced requirement, every MVP requirement covered), or
  the second publication can be weaker than the first.

#### 7. What D requires

| | |
|---|---|
| New state | `publications[]` and `revisions[]` on the specification |
| New ids | `REV-*`, project-wide, sequential, never reused |
| Versioning | no |
| Supersession | no — scope assignments already replace in place |
| Revision history | yes, and that is the point |
| New CLI behaviour | `plan update` accepts a published specification when given a reason; `plan close` becomes re-runnable and re-checks its gates |
| New contracts | `STATE_MODEL.md` (the two arrays, the re-publication rules), `CLI_CONTRACT.md` (the reason requirement), `SKILL_CONTRACT.md` (telling the planner to carry the user's actual words into the reason) |

Also required under **any** option: a decision on the stage interaction in §1,
and a fix for `plan status`'s contradictory output in that state.

#### 8. Least complexity without future consistency problems

**C**, narrowly — it adds one array and no id space. But it buys that saving by
discarding the reason for every change, and the first time anyone asks "why
isn't barcode scanning in version one any more?" the answer is "nobody wrote it
down." **D** is the least complexity that does not create a *known* future
problem. A is cheaper still and creates several. B creates none and costs the
most.

#### 9. New questions each option creates

- **A, C, D** all leave downstream staleness unaddressed: an architecture
  decision or a task created under an earlier scope stays silently valid. **How
  downstream artifacts are invalidated when scope changes** needs its own
  question, raised once OQ-008 is settled — its wording depends on the answer,
  so no number is reserved for it here. B enables detection but still needs the
  policy, so it narrows that question rather than removing it.
- **All options**: there is no way to remove an `AC-*`, a use case or a persona
  once added. Smaller than an OQ, but it needs settling as part of whichever
  option is chosen, because "change the specification" will mean deleting a
  criterion eventually.
- **B only**: what reads "the current version", and what happens to a
  half-finished newer version — which is a second lifecycle on top of the one
  that already exists.

#### 10. Unchanged under every option

- Requirements stay canonical and belong to discovery. `requirements.yaml` is
  not touched by any option.
- A scope call still needs a named human; the specification still needs a human
  to sign it off. No option adds a bypass.
- Dropping a requirement a `LOCKED` decision depends on is still refused.
- `plan status` and `plan export` stay read-only and deterministic.
- The two kinds of acceptance criteria, and the division between them.
- `MVP` / `FUTURE` / `OUT_OF_SCOPE` / `UNKNOWN`, and `FUTURE` as a promise
  rather than a deletion.
- `PRD.md` stays generated and never hand-edited.
- Core stays deterministic: no LLM, no database, no network, no service.
