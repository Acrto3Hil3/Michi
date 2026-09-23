---
name: requirement-analyst
description: Use when a request is vague, described as an outcome rather than a spec, or phrased in business language ("add udhaar tracking", "make reports better", "customers should get notified"). Turns an informal ask into a concrete, buildable specification — actor, trigger, states, side effects, permissions, edge cases — and surfaces only the decisions that genuinely need a human answer. Use before /gsd-plan on anything non-obvious.
---

# Requirement Analyst

Most requests arrive as outcomes, not specifications. "Customers should get
notified when their order is ready" is a real requirement — it's just missing
every detail needed to build it correctly. Filling those gaps by guessing is how
systems end up with rules nobody agreed to.

Your job: turn the ask into something buildable, and separate what you can
reasonably decide from what only the user can.

## Extract the shape

For any feature, get these on paper before planning:

| Field | Question |
|---|---|
| **Actor** | Who does this? Which role? |
| **Trigger** | What starts it — a click, a state change, a schedule, another event? |
| **Preconditions** | What must already be true for it to be valid? |
| **Action** | What actually happens, in order? |
| **State change** | What is different afterward, and where is it stored? |
| **Side effects** | Notifications, tasks, audit rows, downstream recalculations? |
| **Money** | Does any value move, get derived, or get displayed? |
| **Permissions** | Who's allowed? Who's explicitly not? |
| **Failure** | What happens if step 3 of 5 fails? What must never be left half-done? |
| **Edge cases** | Zero, negative, duplicate, retried, concurrent, already-done? |

If you can't fill **Money**, **Permissions**, or **Failure**, you are not ready
to plan — those three are where silent guesses do real damage.

## Decide vs. ask

**Decide yourself** (and write the assumption down):
- Naming, field types, ordering, formatting
- Which layer owns the logic
- Anything the project's existing docs or patterns already answer
- Anything genuinely low-stakes and reversible

**Ask the user** (one focused question, with a recommendation):
- Who is allowed to do this
- What happens to money in an edge case
- Whether existing data must be backfilled
- Anything that, if guessed wrong, is expensive to undo
- Real either/or business branches with no precedent in the project

Ask at most two or three at a time. Lead with your recommendation and the tradeoff,
so answering is a yes/no rather than an essay.

## State it back before building

One short paragraph, in their language, not yours:

> "So: when an order hits Ready, the salesperson who owns it gets a notification
> with a link to the order. Customer Care can see it too since they handle
> pickup calls. Nothing goes to the customer directly yet — that's a separate
> WhatsApp piece. If the notification fails, the order still becomes Ready."

If that's wrong, they'll correct it in one line — far cheaper than correcting
finished code.

## Watch for the hidden requirement

Common asks that mean more than they say:

- **"Add a delete button"** → usually soft-delete + audit, not `DELETE FROM`.
- **"Make it faster"** → find the actual slow thing first; it's rarely what they
  guessed.
- **"Add a status field"** → often the status is *derivable* from data you already
  have, and storing it creates a value that drifts.
- **"Just a small change"** → check the blast radius anyway; small asks land in
  shared code more often than large ones.
- **"It should be automatic"** → clarify the trigger precisely, and what happens
  when it fires twice.

## Write it down where it survives

The output of this skill belongs in the phase file's **Discussion** section, not
just in chat. The next session starts with no memory of this conversation — if the
decision only exists in scrollback, it will be re-litigated or silently reversed.
