---
description: Turn a rough request into a proper engineering brief you can hand to any AI agent
---

Their rough request: `$ARGUMENTS`

This is the translation layer. They said something like *"add a way for customers
to cancel bookings"* — which is a perfectly good business request and a
terrible prompt. An AI agent given that sentence will invent the refund policy,
the cancellation window, and whether the barber gets notified.

Your job: produce the brief a **senior engineer** would have written, so their AI
agent builds the right thing the first time.

## Step 1 — read the project first

Before writing anything, ground yourself in what exists:

- `docs/IDEA.md`, `docs/PRD.md`, `docs/TRD.md` if present
- `docs/architecture/` — especially `DATA.md` for what owns which data
- `docs/PROGRESS.md` — what's actually built already
- The specific code this touches

A brief written without reading the project is how you get an agent confidently
rebuilding something that already exists.

## Step 2 — fill the gaps they didn't know were gaps

Their sentence is missing things they'd have thought of if they were technical.
Find them:

- **Who's allowed to do this?** (the customer only? the owner too? within what window?)
- **What happens to money?** (refund, partial refund, credit, nothing?)
- **What else changes?** (does the slot free up? does anyone get notified?)
- **What's the edge case?** (cancelling twice, cancelling after it already started,
  cancelling something already paid out)
- **What must not break?** (existing bookings, the payment records)

**If a gap is genuinely a business decision, stop and ask them** — one or two
questions, with your recommendation. "I'd suggest free cancellation up to 2 hours
before, then no refund — that's standard for this kind of service. Sound right?"

**If a gap has an obvious safe default given the project, decide it** and say so
in the brief.

## Step 3 — write the brief

Output this, ready to paste into **any** AI coding agent:

```markdown
## Task
[One sentence: what to build.]

## Context
[What this project is, the relevant existing pieces, where the code lives.
Enough that an agent with zero prior knowledge can start.]

## Requirements
- [Specific, testable statements. Not "handle cancellations" but
   "a customer can cancel their own booking up to 2 hours before the start time"]

## Rules that must hold
- [Permissions: who can and cannot do this]
- [Money: exactly what happens to any payment]
- [Data: what gets updated, what must stay unchanged]

## Edge cases to handle
- [The ones you identified above]

## Out of scope
- [What NOT to build — this prevents the agent gold-plating]

## How to verify it works
- [Concrete checks: "cancel as the customer who booked it → succeeds",
   "cancel as a different customer → refused", "cancel 1 hour before → refused"]
```

## Step 4 — hand it over

Show them the brief and say plainly:

> "Copy this into your AI agent. It has everything needed to build this
> correctly — including the rules I'd expect a junior developer to get wrong."

If they're using Claude Code with this skill installed, they can just run
`/build` instead and it'll use the brief directly.

## What makes a brief good

- **Specific over complete.** Three testable requirements beat ten vague ones.
- **Says what NOT to do.** Scope creep is the most common AI failure mode.
- **Includes verification.** An agent that knows how it'll be checked builds
  differently.
- **Names the rules explicitly.** Anything left implicit will be invented.
