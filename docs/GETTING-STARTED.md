# Getting started

A full walkthrough, using a real example: adding credit/"udhaar" tracking to a
retail system.

## 1. Install

```bash
cd your-project
npx phaseforge init --docs
```

Then in Claude Code:

```
/gsd-init
```

It reads your actual repo — stack, layout, what's already built — and fills the
templates in with real details instead of placeholders. Review what it wrote,
especially `docs/PROGRESS.md`. **An inaccurate PROGRESS.md is worse than an empty
one**, because future sessions will trust it.

## 2. Edit your constitution

Open `docs/ENGINEERING-CONSTITUTION.md`. This is the one file worth ten minutes
of your time up front.

Delete what doesn't apply. Add your own rules. If your project has a rule like
"we never delete customer data, only deactivate it" — write it down now, and you
will never have to say it again in a prompt.

## 3. Start a phase

A "phase" is one coherent unit of work. Not a sprint, not a single function —
something like "add credit tracking" or "wire the payments screen to real data."

```
/gsd-discuss credit-tracking
```

The agent reads only what it needs, then comes back with something like:

> I've looked at the existing orders and payments modules. A few things need
> your call before I plan this:
>
> 1. When a customer owes money after delivery, should that create a credit
>    record automatically, or does someone create it manually? **My
>    recommendation:** automatic at delivery, since manual creation will be
>    forgotten and the balance is already known.
> 2. For old paper-ledger debts with no order in the system — do those need to
>    be tracked here too? If yes, they need a different record shape.
>
> I've assumed credits are Accounts-only to create; say if sales staff need it.

Answer in plain language. That conversation gets written into the phase file's
Discussion section, so it survives the session.

## 4. Plan

```
/gsd-plan credit-tracking
```

You get an exact file list, in dependency order, broken into committable steps —
plus the migration it needs and the blast radius it expects to touch. Read it.
This is the cheapest possible moment to catch a wrong assumption.

## 5. Execute, one step at a time

```
/gsd-execute credit-tracking
```

Each run does **one step**, verifies it, commits it, ticks the box, and stops.
Run it again for the next step. Between runs your context window is clean, which
is why step 9 works as well as step 1.

For long phases, loop it — see `docs/RALPH-LOOP.md`.

## 6. Verify

```
/gsd-verify credit-tracking
```

The agent actually runs things: hits endpoints as different roles, clicks the
real screens, queries the database, confirms a restricted role gets a 403, and
cleans up its test data. Then it updates `PROGRESS.md` with what's genuinely
verified versus merely built.

If something didn't pass, it says so rather than ticking the box.

## 7. Check in any time

```
/gsd-status
```

Ten-second summary: current phase, what's next, what's blocked, what debt is
tracked.

---

## A realistic first week

- **Day 1** — install, edit the constitution, `/gsd-init`, run `/gsd-status` to
  see it reflect reality.
- **Day 2** — do one small phase end to end. Deliberately pick something boring.
  The point is to see the loop work.
- **Day 3+** — real work. You'll notice the agent starts asking better questions
  and stops rewriting things you didn't ask about.

## When *not* to use a phase

Not everything needs the full loop. A typo fix, a copy change, a one-line bug
fix — just do it. Phases are for work with a blast radius: new features, schema
changes, anything touching money, permissions, or existing working code.

The senior-engineer skill still applies to the small stuff. The ceremony doesn't.
