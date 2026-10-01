# SKILL_CONTRACT

Derived from `MICHI.md` §20–§27, §55, §72, §78–§79.

## What a skill is

A skill is a document that tells a coding agent how to do one part of the
engineering process: what its job is, what it must establish before acting, what
it must never do, and which `michi` commands to call to read and write state.

A skill is **instructions**, not a program. The deterministic work — selection,
validation, hashing, persistence — lives in MICHI Core behind the CLI. If a
`SKILL.md` starts to contain an algorithm, that algorithm is in the wrong place
(§55).

```text
AI Agent  →  MICHI Skill  →  MICHI CLI  →  MICHI Core  →  Project State
└──────── Experience Layer ────────┘     └─ MICHI Core ─┘     └─ .michi/ ─┘
```

The skills **are** the Experience Layer (`ARCHITECTURE.md`, the three layers).
They are the only part of MICHI that a model ever reads, and the only part that
is allowed to need one. Everything deterministic belongs below them.

## Seven skills

Seven, not thirty (§71). Each corresponds to a role a software company would
staff, represented as a workflow rather than a permanent autonomous agent (§72).

| Skill | Role | Phase |
|---|---|---|
| `senior-engineer` | engineering lead and orchestrator | 2 |
| `product-planner` | product manager and business analyst | 3 |
| `architecture` | software architect | 4 |
| `implementer` | tech lead writing the brief | 6 |
| `reviewer` | code reviewer | 7 |
| `tester` | QA engineer | 7 |
| `debugger` | the person who actually finds the bug | 7 |

## File shape

```text
skills/<name>/
├── SKILL.md            the instructions — the only required file
├── references/         longer material loaded only when needed
└── templates/          output shapes the skill fills in
```

`SKILL.md` frontmatter:

```yaml
---
name: senior-engineer
description: >
  Use when the user describes what they want to build, asks what to do next, or
  when any engineering decision needs to be made. The default entry point for
  work on a MICHI project.
---
```

The description is a routing signal, not documentation. It must say *when to
use this*, in the words a user would actually use, because that is the text an
agent matches against. A description that describes the skill's internals
instead of its trigger is the most common reason a skill never fires.

Keep `SKILL.md` short enough to be read every time it is loaded. Long reference
material goes in `references/` and is pulled in on demand.

## Universal rules

Every skill obeys these. They are repeated in each `SKILL.md` because an agent
only reads the one it loaded.

1. **Read state before acting.** Start with `michi status --json`. Never assume
   the state from the conversation (P5).
2. **Persist through the CLI.** Never write into `.michi/` directly. The State
   Engine validates; hand-edited files bypass it.
3. **Never lock a decision alone.** Only a human confirmation moves a decision
   past `PROPOSED` (P2).
4. **Respect locked decisions.** Do not reconsider one. Encountering a reason
   to, stop and say so (P7).
5. **Plain language first.** The reader may not be an engineer. Define jargon on
   first use. "Explain this simply" always works (P11).
6. **Mark certainty.** Distinguish `FACT` / `USER DECISION` / `RECOMMENDATION` /
   `ASSUMPTION` / `UNKNOWN` (P9).
7. **Stop rather than invent** when a stop condition fires.
8. **No evidence, no completion** (P3).

## Stop conditions

Shared by every skill (§79). On any of these: stop, state which one fired, say
what is needed, wait.

```text
- a requirement is ambiguous in a way that changes the work
- an architectural decision the task needs does not exist
- a required credential or external resource is unavailable
- the next step is destructive and unapproved
- proceeding would violate a locked decision
- the scope would expand materially beyond what was approved
- tests reveal an architectural problem unrelated to this task
```

> **Ask, don't invent.**

---

## `senior-engineer`

The orchestrator and the default entry point.

**Responsibilities.** Understand intent · inspect the project · detect the
existing stack · read current state · identify ambiguity · ask the next useful
question · recommend approaches · request confirmation · record decisions ·
route to other skills · protect architectural consistency · ensure verification
happens.

**It does not do everything itself.** Its main skill is knowing which skill the
situation calls for, and when the answer is "ask the user one question first".

**Routing.**

| Situation | Route to |
|---|---|
| No requirements yet | `product-planner` |
| Requirements exist, architecture does not | `architecture` |
| Architecture locked, work to plan | plan tasks, then `implementer` |
| Code written, needs judging | `reviewer` |
| Needs proving | `tester` |
| Something is broken | `debugger` |
| A decision is needed | handle directly |

**Progressive discovery** (§19). Never open with fifty questions. Ask only what
is needed for the next meaningful decision:

```text
Understand → identify what is missing → ask only the relevant question
→ update understanding → determine the next decision → recommend → confirm
```

A founder who says "I want a pharmacy system" gets asked who will use it — not
whether they prefer Prisma or Drizzle.

---

## `product-planner`

Turns a rough business idea into structured product requirements.

**Responsibilities.** Target users · the business problem · use cases · goals ·
MVP boundary · future scope · functional and non-functional requirements ·
assumptions · constraints · acceptance criteria · PRD · TRD.

**Output.** `REQ-*` records with stable ids and acceptance criteria; `PRD.md`
and `TRD.md`; an explicit scope table — `IN SCOPE` / `OUT OF SCOPE` / `FUTURE` /
`UNKNOWN` (§76).

**The hardest part is the MVP boundary**, and it is the most valuable thing this
skill does. A founder will describe eighteen features. Cutting fourteen of them
to `FUTURE` is the difference between shipping and not. Do it explicitly, with
the reason, and make the cut visible so nothing is lost — `FUTURE` is a
promise, not a deletion.

**Never** invent a requirement the user did not ask for (P1). If something
obviously necessary is missing — what happens when a payment fails — surface it
as a question, not as a requirement.

---

## `architecture`

Frontend · backend · database · API · authentication · authorization · security
· scalability · caching · background jobs · queues · file storage ·
integrations · deployment · observability · technology selection · patterns.

**Method** (§44):

```text
Understand requirements → identify constraints → generate viable architectures
→ compare tradeoffs → recommend one → ask → lock
```

**Architecture is proportional to the problem.** A small app does not become a
distributed system. A genuinely high-scale platform does not get a naive
monolith because monoliths are fashionable this year. The requirements decide,
and the user approves.

**On existing projects** (§80, §81): detect what is there and preserve it by
default. A repository using MongoDB and JWT gets "here is what I found — keep it
or reconsider it?", never "I prefer PostgreSQL, so let's migrate."

**Output.** Options with honest tradeoffs, one recommendation with a reason,
and — after approval — ADRs via `michi decide`, plus `SYSTEM.md`,
`COMPONENTS.md`, `DATA.md`.

---

## `implementer`

**Does not write application code.** It converts approved engineering state
into a brief for the agent that will (§24, §70).

```text
In:   task · requirements · locked decisions · architecture · context packet
      · acceptance criteria
Out:  a compiled instruction
```

The instruction follows the fixed section order in `CONTEXT_MODEL.md` and is
produced by `michi context` and the Prompt Engine — the skill assembles the
inputs and checks the result, it does not hand-write prompts.

**Before handing off, verify:** every acceptance criterion is testable; scope
and out-of-scope are both explicit; every decision the task depends on is
`LOCKED`; stop conditions are stated; the report-back format is stated.

**The handoff contract** (§78). The agent must return: implementation summary ·
files changed · tests executed · results · verification evidence · remaining
issues · any new decision it needs approved. An agent that hits an unlocked
architectural decision stops and asks rather than inventing one.

---

## `reviewer`

Judges an implementation against: requirement compliance · architecture
compliance · security · maintainability · performance · error handling · code
quality · unnecessary complexity · duplication · new dependencies · test
coverage · regressions · consistency with locked decisions.

**Verdict is `PASS` or `CHANGES_REQUIRED`.** Nothing else. Each finding names a
file and line, says what is wrong, says why it matters, and says what to do
instead.

> "Looks good" is not a review (§25).

Weight findings by consequence. A missing input validation on a trust boundary
and an inconsistent variable name are not the same finding, and a review that
presents them as equals teaches the reader to skim.

Review against the approved decisions, not against the reviewer's preferences.
"I would have used a different library" is not a finding when the library is
`LOCKED` in an ADR.

---

## `tester`

Levels: unit · integration · API · E2E · security · regression · performance.

**Strategy follows impact** (§26). Not every change needs every level:

| Change | Levels |
|---|---|
| Pure utility function | unit |
| API plus database | unit, integration, relevant API tests |
| Complete checkout flow | unit, integration, E2E |
| Authentication or authorization | unit, integration, security |
| Performance-sensitive path | plus a measurement, with a number |

Tests assert **behaviour, not implementation** (§119) — a test that breaks when
a function is renamed but nothing behaves differently is a liability.

Every acceptance criterion needs a test that proves it, and the resulting
`SATISFIES` edge is what makes coverage answerable later.

Failures are reported as failures, with output. Never as "mostly passing".

---

## `debugger`

```text
REPRODUCE → OBSERVE → FORM HYPOTHESES → TEST HYPOTHESES → IDENTIFY ROOT CAUSE
→ CREATE FIX PLAN → IMPLEMENT FIX → RUN TESTS → VERIFY → DOCUMENT
```

**Reproduction is evidence, and it comes first.** A bug that cannot be
reproduced cannot be confirmed fixed — the honest report is "could not
reproduce", not a speculative change.

Reproduce as a failing test where possible. That test is the proof of the fix
and the regression guard afterwards.

**Root cause, not symptom.** A report names a symptom. Before editing, find
every caller of the code about to change. One guard in a shared function is
both a smaller change and a more complete fix than a guard in each caller — and
patching only the path the report mentions leaves every sibling caller broken.

**Never** edit files at random until the error disappears (§27). If the
hypotheses are exhausted, say so and ask — that is a stop condition, not a
failure.

**Document** in the task record: what was wrong, why it happened, what fixed it,
what now prevents it. A bug fixed and not written down gets reintroduced.

---

## Known limitation: skills are verified structurally, not behaviourally

A skill's tests are fixture tests over a Markdown file. They can prove:

- the frontmatter is present and the description states a trigger
- every `michi …` command the skill tells an agent to run actually exists
- the universal rules and prohibitions are stated
- the file is short enough to be read in full each time it loads

They cannot prove any of the things that actually matter:

- that an agent following it conducts a good discovery session
- that it asks the right question next, rather than a reasonable-sounding one
- that it recognises ambiguity instead of smoothing over it
- that it resists confirming a requirement the user never agreed to
- that a person who cannot code understands what it said to them

This gap is structural, not an oversight. Behaviour depends on the model
reading the skill, and that model is not in this repository — which is the
point of the three layers. A green test suite says the skill is *well formed*.
It says nothing about whether it works.

**So a skill is not finished when its tests pass.** It is finished when it has
been run by a real agent, with a real non-technical person, on a real idea, and
the resulting `.michi/` contents are something an engineer would recognise as
correct. Until that has happened, say so rather than citing the test count.

The honest reporting rule: never present skill fixture tests as evidence of
agent behaviour.

## Writing a skill

- Address the agent directly: "Read the state before you answer."
- Concrete over abstract: show the command, show the output shape.
- Every instruction must be actionable — if it cannot be followed or failed, cut
  it (P4).
- Worked examples beat description.
- State the failure modes: what this skill gets wrong, and what to do instead.
- Keep it short. A skill nobody finishes reading is a skill nobody follows.
