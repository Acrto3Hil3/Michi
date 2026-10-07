# CONTEXT_MODEL

Derived from `MICHI.md` §36–§42, §47–§48, §63, §92–§93, §126.

> Context should be resolved, not dumped.

This is where MICHI earns its keep. Everything else is bookkeeping; this is the
part that makes the agent produce the right change instead of a plausible one.

## The question

For each task, exactly one question:

> What does the coding agent actually need to know to do this, and nothing else?

Too little context and the agent invents things that already exist. Too much and
it drifts, edits unrelated modules, and costs a fortune. Both failures look the
same from outside — the agent "did something weird" — which is why the selection
has to be inspectable (`michi context TASK-034`).

## Three layers

| Layer | Contents | Size | Changes |
|---|---|---|---|
| **Global** | project identity, current architecture, core constraints, locked decisions that bind everything, current milestone | small, capped | rarely |
| **Domain** | the subsystem this task belongs to — its components, data, APIs, decisions, conventions | medium | per subsystem |
| **Task** | this task's requirements, acceptance criteria, target files, tests, constraints, explicit exclusions | focused | every task |

Global context is capped deliberately. If it grows past its cap the fix is
usually a summarisation of the architecture document, not a bigger cap.

## Inclusion tiers

Every candidate is classified:

| Tier | Meaning | Budget behaviour |
|---|---|---|
| `MUST_INCLUDE` | the task is wrong or impossible without it | never dropped; if these alone exceed the budget, the task is too large and is split |
| `PREFERRED` | materially improves correctness | included by rank while budget remains |
| `OPTIONAL` | helpful if room remains | included last |
| `EXCLUDED` | deliberately withheld | listed by name with a reason |

`EXCLUDED` is not the absence of a decision — it is a recorded one. "The payment
module is excluded because this task must not touch payments" is itself useful
signal to the agent, and it is how a human auditing the packet spots a
misjudgement.

## What lands in each tier

**Always `MUST_INCLUDE`:** the task definition and acceptance criteria; the
requirements it implements; decisions whose category the task touches; the
architecture rule governing where this code belongs; the files the task will
modify; explicit "do not change" constraints.

**Usually `PREFERRED`:** sibling modules that establish the local convention;
the data model for entities touched; existing tests for the same module; API
contracts consumed or produced.

**Usually `OPTIONAL`:** adjacent subsystems that merely interact; historical
decisions in the same category that are no longer active; related but
unmodified tests.

**Always `EXCLUDED`:** unrelated subsystems; superseded decisions; the
conversation history; generated files, lockfiles and build output; anything a
`.gitignore` already hides.

## Ranking

Within `PREFERRED` and `OPTIONAL`, rank deterministically. Same inputs, same
order, every time (P8) — a non-deterministic context selection cannot be
debugged.

Signals, in descending weight:

1. **Direct graph adjacency** — the node is one edge from a task target
2. **Explicit reference** — a requirement, decision or acceptance criterion names it
3. **Import distance** — how many hops in the dependency graph from a target file
4. **Same domain** — shares the task's domain node
5. **Convention value** — a near-identical existing implementation to imitate
6. **Recency** — touched by a recent related task

Ties break on a stable key (path, then id) so ordering never depends on
filesystem iteration order.

## Budget

A budget is a token ceiling for the compiled instruction.

MICHI has no tokenizer and no model (`ARCHITECTURE.md`, the three layers), so
token counts are **estimates**, computed deterministically as `ceil(chars / 4)`.

*OQ-005, locked 2026-09-28:* an estimate is never presented in the shape of an
exact result. Every surface that reports a token count states the number as
approximate **and names the method**:

```text
Estimated context size: ~18.4k tokens
Estimation method:      chars/4
```

Not `18,420 tokens`. That number would be a division dressed up as a
measurement, and someone would eventually tune a budget against it (P9).

A tokenizer adapter may be added later — an optional interface returning an
exact count and reporting itself as the method — but a tokenizer is **not** a
dependency in v1, and nothing may require one to be present. Code reads the
estimate through one interface that returns both the number and the method, so
adding a real tokenizer changes what that interface returns and nothing else.

Algorithm:

```text
1. Collect candidates from the graph, the project map and the task record
2. Classify each into a tier
3. Sum MUST_INCLUDE
     if that exceeds the budget → do not truncate. Fail with
     TASK_TOO_LARGE and recommend splitting the task.
4. Rank PREFERRED; add while budget remains
5. Rank OPTIONAL;  add while budget remains
6. Record everything not added, with the reason: EXCLUDED or BUDGET
```

Step 3 is the important one. Silently truncating required context produces an
agent run that fails for reasons nobody can see. A task whose mandatory context
does not fit is a planning error, and the honest response is to say so.

### Whole files or excerpts

Prefer a whole file when it is small. Above a threshold, include the structural
skeleton from Tree-sitter — signatures, exports, types — plus the specific
regions that matter. Never a mid-function truncation: half a function is worse
than a signature, because it looks complete.

## The context packet

`context/packets/CTX-104.md`. Written for the agent, readable by a human, kept
for audit.

```markdown
---
id: CTX-104
task_id: TASK-034
budget_tokens: 18000
estimated_tokens: 14200
estimation_method: chars/4
context_hash: sha256:…
generated_at: 2026-09-28T09:40:00Z
---

# CTX-104 — Merchant stock adjustment

## Task
Implement the endpoint that lets an authorized merchant increase or decrease
the stock of a product they own.

## User intent
Merchants keep running out of stock without noticing. They need to correct
stock counts themselves.

## Requirements
REQ-021 — Merchants can adjust stock for their own products
REQ-024 — Every stock change is attributable to a person

## Architecture
Modular monolith. The inventory module owns every stock mutation; no other
module writes stock.

## Decisions in force
D003 PostgreSQL · D004 Prisma · D007 REST API · D009 Role-based access control

## Files
MUST   src/modules/inventory/index.ts
MUST   src/modules/inventory/stock.ts
MUST   src/modules/auth/authorize.ts
PREF   src/modules/products/product.model.ts
PREF   src/modules/inventory/stock.test.ts

## Constraints
Do not change the authentication architecture.
Do not create a second inventory service.
Do not modify the payments module.

## Acceptance criteria
AC-001 Authorized merchants can increase stock
AC-002 Authorized merchants can decrease stock
AC-003 Stock cannot become negative
AC-004 Unauthorized users receive an authorization error

## Do not change
src/modules/payments/**
prisma/migrations/**

## Excluded from this packet
payments module            — out of scope for this task
marketing pages            — unrelated
D002 (superseded)          — no longer in force
12 further files           — budget
```

The final section is not decoration. It is the audit trail for P6, and the first
place to look when an agent produces something strange.

## Hashing

Three hashes, each over a canonical serialisation — sorted keys, normalised line
endings, no timestamps:

| Hash | Covers | Answers |
|---|---|---|
| `input_hash` | the task record plus every artifact it references | has the task's definition changed? |
| `state_hash` | the requirements, decisions and architecture the task depends on | has the ground moved under it? |
| `context_hash` | the resolved packet contents | would we build the same packet again? |

Uses:

- Skip regenerating a packet when all three match a cached one.
- Detect that a completed task's inputs changed after it was verified — the
  verification is now stale and must be flagged, not silently trusted.
- Correlate an agent run with the exact context it was given, forever.

Correctness rule: a hash may only cover content that genuinely affects the
output. Including a timestamp, an absolute path, or a map with unstable
iteration order turns the cache into a random number generator. Every hashed
structure is serialised through one canonicalisation function, and that function
is tested directly.

## Compiled instruction

The Prompt Engine turns the packet plus the task into the instruction the agent
receives (§41–§42). Sections, in order:

```text
ROLE · PROJECT · TASK · USER REQUIREMENT · ENGINEERING INTERPRETATION
APPROVED DECISIONS · ARCHITECTURE · SCOPE · OUT OF SCOPE · RELEVANT FILES
IMPLEMENTATION RULES · SECURITY REQUIREMENTS · ACCEPTANCE CRITERIA
TESTING · VERIFICATION · STOP CONDITIONS · REPORT BACK
```

The compiler is deterministic: same packet, same instruction, byte for byte.

**The prompt is a generated artifact, never a source of truth** (§41). Editing a
compiled prompt to fix a problem is always wrong — the fix belongs in the state
the prompt was compiled from, or in the compiler.

## What Phase 5 built

This document was written in Phase 0 around a **task** focus. Tasks arrive in
Phase 6, so Phase 5 implements the same machinery with a **requirement** focus
and states the differences.

### The request

```json
{
  "focus": { "type": "requirement", "id": "REQ-003" },
  "budget_tokens": 18000,
  "include": ["D001"],
  "exclude": ["UC-002"]
}
```

Structured, never prose. The skill decides what the user is trying to do; Core
resolves which canonical artifacts answer it. `focus.type` is a discriminated
union with one member today and room for `task` later.

`include` pulls in something the graph would not reach, recorded as *"asked for
by the request"*. `exclude` withholds something it would, recorded as
*"withheld by the request"*. Neither is a silent override.

### Tiering, straight off the graph

Relevance is graph distance and edge type. No similarity, no embeddings, no
model — nothing to tune and nothing to explain away.

| Tier | What lands there |
|---|---|
| `MUST_INCLUDE` | the focus; `LOCKED` decisions that `GOVERNS` it; live criteria that `VERIFIES` it; the ADR of each of those decisions |
| `PREFERRED` | live use cases that `SERVES` it; the persona `PERFORMED_BY` each; anything the request asked for |
| `OPTIONAL` | other requirements sharing one of those use cases |
| `EXCLUDED` | everything else, each with its reason |

A `PROPOSED` decision governs nothing — it is waiting on the user, and the
packet says so rather than presenting it as settled. A `REMOVED` criterion or
use case is excluded with *"was removed from the specification"*.

### Ranking

`(tier, −rank, id)`. `rank` is an integer assigned per relationship kind, so
closer things sort first and ties break on id — never on traversal order. The
same state and request give the same ordering, always.

### The packet

Every item carries `id`, `type`, `tier`, `reason`, `rank`, `estimated_tokens`
and `content`. A decision item also carries `needs_review` and `review_reason`
(OQ-009), so a decision the specification has moved under is **visible, neither
hidden nor treated as valid**.

`revisions` carries only the revisions whose `changes` name the focus — the
relevant history, not all of it.

`packet_id` is `CTX-` plus the first eight characters of the content hash, not
a sequential number. Reproducibility is the point: the same state and request
must give the same packet, and a counter would not. It also means resolving
context writes nothing.

### Budget

`MUST_INCLUDE` is summed first. If it exceeds the budget the request **fails**
rather than truncating — reported as `BLOCKED` (exit 5), since what it needs is
a human decision: raise the budget or split the work. `TASK_TOO_LARGE` above is
that condition; it surfaces through the existing error vocabulary rather than a
new exit code.

Otherwise `PREFERRED` then `OPTIONAL` are added by rank while budget remains,
and everything dropped appears in `dropped_for_budget` and in `excluded` with
the reason `budget`. The reduction is never silent.

### Resolving context writes nothing

`michi context` is read-only and deterministic: no packet file, no counter, no
timestamp in the hash. `context/packets/` stays empty until there is an agent
run to correlate a stored packet with, which is Phase 6.

### Files

Files reach a packet through the task that reported them, never directly:

```text
REQ-001 ◄──IMPLEMENTS── TASK-001 ──TOUCHED──► src/stock.ts
        hop 1                     hop 2
```

They arrive `PREFERRED`, with a reason that names the task and says plainly
*"reported, not verified"* — because that is all a task report establishes.
Nothing in context selection upgrades a claim into evidence; that is
verification's job.

A requirement nothing has worked on yet carries no files, and the compiled
instruction says so rather than implying MICHI knows where the code lives.

The detected stack and the project's stated constraints still travel as
**project-level** context on every packet, which is where they belong.

## Six ways to spend fewer tokens

1. **Prompt compression** — a precise instruction instead of a vague one that
   triggers exploration.
2. **Context compression** — this document.
3. **Conversation compression** — durable artifacts instead of replaying
   history (P5).
4. **Decision pre-resolution** — never make the agent debate what the user
   already settled.
5. **Hashing** — never redo unchanged expensive work.
6. **Fresh context** — each specialised task gets a focused packet rather than
   an accumulated session.

The objective is not the smallest prompt. It is **maximum useful engineering
work per token** — and an instruction 500 tokens larger that prevents one wrong
rewrite has paid for itself many times over.
