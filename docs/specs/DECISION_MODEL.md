# DECISION_MODEL

Derived from `MICHI.md` §14–§18, §46, §61, §75, §88, §97, §100, §122.

Decisions are the heart of the product. They are what turns a conversation into
project memory, and what stops a coding agent re-litigating settled questions.

## What a decision is

A decision is a question that mattered, the options that were considered, the
one that was chosen, the reason, and the human who approved it.

Two kinds, never conflated (§75):

| | Owner | Example |
|---|---|---|
| **Product decision** | the user | "Customers can cancel an order before it ships" |
| **Engineering decision** | MICHI recommends, the user approves | "Cancellation is a state transition, not a row delete" |

MICHI may propose either. It may lock neither on its own.

## Decision and ADR are two different things

*OQ-003, locked 2026-09-28.*

```text
D001                       the Decision — a structured object in project state
 └── ADR-001               the ADR — the human-readable document describing it
      └── decisions/ADR-001-database.md
```

A **Decision** is machine-readable project state: typed fields, validated
against a schema, queried by the graph, checked by the CLI, relied on by every
downstream engine. It lives in the decision registry.

An **ADR** is the document a person reads in eight months when they want to know
why the project is like this. It lives in its own Markdown file and is mostly
prose.

They are **not competing identifiers for one thing**, and neither is derived
from the other by string manipulation. `D004` is not "ADR-004 with the letters
changed" — it is a different object with a different job, and the registry is
what connects them.

Why keep both rather than collapsing them:

- Tooling needs fields it can trust — `status`, `category`, `superseded_by`.
  Parsing those out of prose is fragile.
- People need reasoning, alternatives and consequences in continuous English.
  Cramming that into YAML makes it unreadable and it stops being written.
- The two have different lifetimes. A decision's `status` changes when it is
  superseded; the ADR that documented it stays exactly as it was, because it is
  a record of what was decided *then*.

### Rules

- Each decision has **at most one** ADR. Each ADR documents **exactly one**
  decision.
- A decision may exist without an ADR while `PROPOSED`. It cannot reach
  `LOCKED` without one — an undocumented locked decision is how a project
  forgets why it is shaped the way it is.
- Decision ids (`D001`) and ADR ids (`ADR-001`) are allocated from separate
  counters and neither is reused, including for decisions that are later
  rejected or superseded.
- The numbers are kept aligned where possible, because `D004 → ADR-004` is
  easier for humans to hold. Alignment is a **convenience, not a guarantee**:
  nothing in the implementation may compute one id from the other. Always
  resolve through the registry.
- The registry is authoritative for the mapping. A file present in
  `decisions/` but absent from the registry is an error, not a decision.

## Lifecycle

```text
                 ┌──────────────┐
                 │   PROPOSED   │   MICHI recommends; nothing is binding
                 └──────┬───────┘
            user says no │ user says yes
          ┌──────────────┴──────────────┐
          ▼                             ▼
   ┌────────────┐              ┌─────────────────┐
   │  REJECTED  │              │ USER_CONFIRMED  │
   └────────────┘              └────────┬────────┘
                                        │  written to disk, propagated
                                        ▼
                                 ┌────────────┐
                                 │   LOCKED   │
                                 └──────┬─────┘
                                        │  a later decision replaces it
                                        ▼
                                 ┌──────────────┐
                                 │  SUPERSEDED  │
                                 └──────────────┘
```

Rules:

- `PROPOSED` is the only state MICHI may write unaided.
- `USER_CONFIRMED` requires a recorded `approved_by` and `approved_at`. A write
  to this state without them is a bug that must fail validation (P2).
- `LOCKED` means downstream work may rely on it. Agents must not reconsider a
  `LOCKED` decision; encountering a reason to, they stop and ask (P7).
- `SUPERSEDED` records are never deleted. The history is part of the value (P10).
- `REJECTED` is also kept — knowing what was turned down, and why, prevents
  proposing it again in three months.

## The interaction pattern

Always, in this order (§14):

```text
Recommend → Explain → Ask → Confirm → Lock → Execute
```

**Recommend.** One option, named. Not a menu with no opinion — a founder cannot
choose between four things they have never heard of.

**Explain.** In plain language first (P11): how each option works, what it costs,
what it makes easy, what it makes hard, and why this project points at one of
them. Cost and complexity are stated in terms the user actually feels — money,
time, how much can break.

**Ask.** A direct question with a real no available.

**Confirm.** Record who approved it and when.

**Lock.** Write the ADR, update the index, update the graph, update state.

**Execute.** Only now may downstream work assume it.

### What this looks like

> **Deciding: how people log in**
>
> Your app needs to know who someone is. There are four normal ways to do that:
>
> **A. Email and password** — you store passwords yourself. Familiar to users,
> but you become responsible for password security, resets, and breaches.
>
> **B. A code sent by SMS or email** — no passwords to steal, but you pay per
> message and login is slower.
>
> **C. Sign in with Google or Apple** — fast, nothing to store, but you depend
> on those companies and some users don't have those accounts.
>
> **D. A login service** — a company handles all of it for you. Costs money
> once you have many users, and it's harder to move away from later.
>
> **My recommendation: D.** Your product handles pharmacy records, so a
> security mistake here is serious, and D removes most of the ways you could
> make one. It's free at your expected size.
>
> **Do you want to go with D?**

Note what is absent: JWT, OIDC, session middleware, bearer tokens. Those appear
in the ADR, not in the question.

## Decision hierarchy

When sources conflict (§15):

```text
1. Explicit user decision
2. Project constraints
3. Security / safety requirements
4. Existing locked architecture
5. Engineering recommendation
6. Default
```

A recommendation is not a decision. A proposed architecture is not an approved
architecture.

There is one deliberate tension in this ordering: a user decision outranks a
security requirement. That is correct — the user is in charge — but it is never
silent. If a user decision conflicts with item 3, MICHI states the risk plainly,
records the conflict in the ADR under `risks_accepted`, and proceeds. It does
not refuse, and it does not quietly override.

## ADR format

`decisions/ADR-004-authentication.md`:

```markdown
---
adr: ADR-004
decision: D004
title: Authentication provider
date: 2026-09-26
---

# ADR-004 — Authentication provider

## Decision

Use a managed authentication provider.

## In plain language

A separate company handles logging people in. We send users to them, they tell
us who the person is. We never store passwords.

## Why

The project handles medical records, so an authentication mistake is expensive.
A managed provider removes most of the ways we could make one, and it is free
at the expected number of users.

## Alternatives considered

| Option | Why not |
|---|---|
| Email + password we build ourselves | We become responsible for password storage, resets, and breach handling |
| Session-based auth | Same custody problem, plus server-side session storage |
| OAuth implemented directly | All of the dependency, none of the convenience |

## Consequences

- Less security-sensitive code to write and maintain
- A dependency on an external provider, including its outages and pricing
- Provider configuration becomes part of deployment
- Moving away later requires migrating user identities

## Risks accepted

None recorded.

## Approved by

User, 2026-09-26.
```

The frontmatter is deliberately thin: an ADR identifies itself and names the
decision it documents, and nothing more. Status, approval, supersession and
category are **not** repeated here.

That is the whole point of the split. Duplicating state into the document
guarantees the two copies disagree eventually — a decision gets superseded, the
registry is updated, and the ADR still says `status: LOCKED` forever. One
authoritative place for each fact: the registry for state, the document for
reasoning.

The body is prose because it is read by a person, and it is the only artifact
that survives everyone forgetting the conversation.

## The decision registry

`decisions/index.yaml` holds the Decision objects. It is the authoritative
record of what has been decided and where each decision is documented.

```yaml
schema_version: 1
next_decision_id: 10
next_adr_id: 10

decisions:
  - id: D001
    title: Frontend framework
    type: engineering              # product | engineering
    category: frontend
    status: LOCKED                 # PROPOSED | USER_CONFIRMED | LOCKED
                                   # | REJECTED | SUPERSEDED
    selected_option: react
    options:
      - key: react
        label: React
      - key: vue
        label: Vue
    rationale: >
      The team's agent has the most training data here, and the component
      ecosystem covers everything in the requirements.
    alternatives_rejected:
      - key: vue
        reason: No advantage for this project; smaller ecosystem for the
                specific components needed.
    consequences:
      - React's build tooling becomes part of the deployment story
    approval:
      by: user
      at: 2026-01-14T09:30:00Z
    adr: ADR-001
    adr_file: ADR-001-frontend.md
    affects_requirements: [REQ-002]
    affects_components: [web]
    supersedes: null
    superseded_by: null
    created_at: 2026-01-14T09:12:00Z
    updated_at: 2026-01-14T09:30:00Z

  - id: D004
    title: Authentication provider
    type: engineering
    category: authentication
    status: LOCKED
    selected_option: managed
    rationale: >
      The project handles medical records; a managed provider removes most of
      the ways we could get authentication wrong, and is free at this scale.
    approval:
      by: user
      at: 2026-09-26T14:22:00Z
    adr: ADR-004
    adr_file: ADR-004-authentication.md
    affects_requirements: [REQ-003, REQ-011]
    affects_components: [auth, api, web]
    supersedes: null
    superseded_by: null
    created_at: 2026-09-26T14:02:00Z
    updated_at: 2026-09-26T14:22:00Z

  - id: D008
    title: Background job processing
    type: engineering
    category: infrastructure
    status: PROPOSED
    selected_option: null
    options:
      - key: inline
        label: Run the work immediately, while the user waits
      - key: queue
        label: A job queue
      - key: cron
        label: A scheduled task
    approval: null
    adr: null                      # written when it is confirmed
    adr_file: null
    created_at: 2026-09-28T11:05:00Z
    updated_at: 2026-09-28T11:05:00Z
```

### Field rules

- `approval` is `null` until a human confirms. `status: LOCKED` with
  `approval: null` must fail schema validation — this is where P2 is enforced
  mechanically rather than by good intentions.
- `adr` and `adr_file` are `null` only while `PROPOSED`. Reaching `LOCKED`
  requires both.
- `selected_option` must be one of the `options` keys, when options are
  recorded.
- `rationale` is required at `LOCKED`. A decision nobody can explain is not a
  decision, it is a habit.
- `created_at` / `updated_at` on every decision.
- `supersedes` and `superseded_by` are decision ids, never ADR ids.

## Changing a decision

A locked decision may be changed. It may not be changed quietly (§18).

```text
1. RECOGNIZE   the user's request conflicts with a locked decision
2. ANALYZE     compute the blast radius
3. EXPLAIN     present it in plain language, with the real cost
4. ASK         confirm they still want it, knowing that
5. SUPERSEDE   a new decision with its own ADR; the old decision becomes
               SUPERSEDED and is never deleted. The old ADR is left exactly as
               written — it is an accurate record of what was decided then.
6. PROPAGATE   requirements, architecture, tasks and graph updated
7. REPLAN      affected completed work returns to the task queue
```

### Impact analysis

The blast radius is computed from the graph, not guessed. For a change to
decision `D`, report:

- **Requirements** whose satisfaction depends on `D`
- **Decisions** that were made assuming `D` — these may themselves need revising
- **Architecture** components and data structures affected
- **Tasks** completed under `D` that may need redoing, and pending tasks whose
  plans are now wrong
- **Code** files reachable from those components
- **Tests** that will need to change
- **Dependencies** added or removed
- **Deployment** implications
- **Data** migration required, and whether it is reversible

Presented as consequence, not as a table of node ids:

> Changing the database from PostgreSQL to MongoDB affects nine things.
>
> **What has to be rebuilt:** the way data is stored and queried — 14 files.
> Your orders, customers and stock all connect to each other, and that
> connection is something PostgreSQL enforces for you and MongoDB does not, so
> we'd write that checking ourselves.
>
> **What you'd lose:** the guarantee that an order can't exist without a
> customer. We can enforce it in code instead, but code can have bugs where the
> database could not.
>
> **What it costs:** roughly a day of rework, and three completed features get
> re-tested.
>
> **What it buys you:** [the honest answer, including "nothing, for your
> situation" if that is true.]
>
> Still want to switch?

If the honest answer to "what it buys you" is "nothing", say so. Agreeing
pleasantly with a change that helps nobody is a P12 violation.

## Honouring preferences

If MICHI recommends PostgreSQL and the user says "I want MongoDB" (§46):

1. Explain the tradeoffs — once, clearly, without repeating.
2. Identify architectural consequences.
3. Adapt the architecture so the choice works properly.
4. Ask for confirmation.
5. Lock it.

MICHI does not argue twice. Stating a concern once is diligence; stating it
three times is disrespect. After the user has heard the tradeoff and chosen,
their choice is the decision, and everything downstream is built to make that
choice succeed rather than to prove it wrong.

## Explaining a decision

`michi explain D004` answers from the artifact, never from memory or inference
(§100):

> **Why we use a login service**
>
> Your app handles medical records, so a mistake in how people log in would be
> serious. Using a login service means a specialist company handles passwords
> and we never store them.
>
> You approved this on 26 September. It's recorded as ADR-004.
>
> We also considered building it ourselves, which we ruled out because it would
> make us responsible for password security.

If the artifact does not contain the answer, the answer is "that is not
recorded" — never a reconstruction (P9).
