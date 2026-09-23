---
name: architecture-memory
description: Use at the start of work on an unfamiliar area of a project, when asked "how does X work" / "where does Y live" / "what depends on Z", when onboarding into a codebase mid-project, or after shipping something that changed the system's shape. Keeps a project's architecture knowledge in durable files instead of re-deriving it from scratch every session — which is what actually reduces token burn on long projects.
---

# Architecture Memory

A fresh session knows nothing. Left to itself it will re-read half the codebase to
answer a question it answered last week, and spend most of its context window
rediscovering facts instead of doing work.

The fix is not a bigger context window. It's writing down what was learned, in the
place the next session will actually look.

## The rule

**Any architectural fact that took more than one file-read to establish gets
written down.** Not in chat. In a file, in the repo, committed.

Cheap to re-derive (skip it): where a single component lives, what one function
returns.

Expensive to re-derive (write it down): which module owns a piece of data, why
two similar tables both exist, what a derived value is derived *from*, which
invariant a constraint protects, why an obvious-looking refactor is unsafe.

## Where it goes

```
docs/
├── PROGRESS.md              ← what's built, what's verified, what's next
├── architecture/
│   ├── SYSTEM.md            ← layers, boundaries, dependency direction
│   ├── DOMAIN.md            ← each domain: owner, entities, rules, dependencies
│   ├── DATA.md              ← source of truth per value; stored vs derived
│   └── DECISIONS.md         ← locked decisions + why + what breaks if reversed
└── phases/<phase>.md        ← per-unit-of-work record (see /gsd-* commands)
```

Keep each file small enough to read fully in one pass. A 3000-line architecture
doc costs more context than it saves and nobody updates it.

## The highest-value thing to record

**Source of truth, per business value.** Most expensive bugs in an AI-assisted
codebase come from two places both claiming to own the same fact.

For each meaningful value, one line:

```
order.value        → authoritative, set at booking
order.advancePaid  → cached, recomputed from SUM(payments) on every write — never incremented
credit.outstanding → derived at read time, never stored
task "overdue"     → derived: dueDate < today && status != Completed
```

That table alone prevents an entire category of drift.

## When to update it

- After shipping anything that adds a table, an endpoint, or a domain concept
- After discovering a non-obvious dependency the hard way
- After a decision gets made that a future session might unknowingly reverse
- **Not** as a separate documentation phase — in the same change that caused it.
  Documentation written later is documentation not written.

## Reading it back

At the start of work on an unfamiliar area:

1. `docs/PROGRESS.md` — what's actually real vs. aspirational
2. The relevant `docs/architecture/*.md` section
3. The specific phase file, if one exists
4. *Then* the code — with a map instead of blind

Trust it, but verify against the code when the stakes are high. A doc can be
stale; the code is what runs. If you find drift, fix the doc in that same change —
stale architecture docs are worse than none, because they get believed.

## Graph-based exploration (optional companion)

For large or unfamiliar codebases, a knowledge-graph tool can make the first pass
much cheaper than a linear read. [Graphify](https://github.com/) builds a queryable
graph of a repo (`graphify-out/`) and is worth installing separately if you work
across big codebases; when a `graphify-out/` directory exists, treat architecture
questions as graph queries first and full-file reads second.

That's a companion tool with its own authors and license — install it from source,
don't vendor it.
