---
name: debugger
description: >
  Use this when something is broken and nobody knows why. Use it when the user
  reports a bug, when tests fail for reasons nobody expected, when behaviour
  changed without an obvious cause, or when a task keeps failing.
---

# Debugger

```
REPRODUCE → OBSERVE → HYPOTHESIS → ROOT CAUSE → FIX → VERIFY
```

In that order. MICHI enforces the one boundary that matters: it refuses to
record a `FIX` before a `REPRODUCE`, because a fix without a reproduction is a
guess, and nobody can tell afterwards whether it was a good one.

## Reproduce first, always

```
michi debug <id> --stage REPRODUCE --note "what you did, and what you saw"
```

A bug you cannot reproduce cannot be confirmed fixed. If you genuinely cannot
reproduce it, say exactly that — "could not reproduce" is an honest result, and
far better than a speculative change that makes the symptom disappear for
reasons nobody understands.

**Reproduce as a failing test where you can.** That test is the proof of the
fix and the guard against it coming back. It is worth the extra few minutes
every time.

## Then observe before theorising

Read the actual error, the actual stack, the actual values. Most wrong
diagnoses are made by someone who pattern-matched the symptom to a bug they saw
before and stopped reading.

```
michi debug <id> --stage OBSERVE --note "the quantity is null here, not zero"
```

## Root cause, not symptom

A report names a symptom. Before you change anything, **find every caller** of
the code you are about to touch.

One guard in a shared function is both a smaller change and a more complete fix
than a guard in each caller — and patching only the path the report mentions
leaves every sibling caller broken, which is how the same bug gets reported
three more times.

```
michi debug <id> --stage ROOT_CAUSE --note "the name is never checked on the write path"
```

## Then fix, then verify

```
michi debug <id> --stage FIX --note "validate on the shared write path"
michi test <id> --run test
michi debug <id> --stage VERIFY --note "the reproduction now fails as expected"
```

The reproduction must go from failing to passing. If it does not, you have not
fixed it, whatever else improved.

## Keep the context in view

```
michi status --json            where the project stands
michi task show <id> --json    what this task was for
```

A bug is only a bug against what the work was supposed to do. Read that
first — `michi status` for the stage, `michi task show` for the criteria. Each
`michi debug` stage records a step; `michi test` records what actually ran.

## The rules that hold in every skill

- You may change code here — that is the point of a fix, so this is the one
  skill that touches the application. But **never write code beyond the fix**. A refactor smuggled into a bug fix hides which change
  mattered.
- **Only the user confirms anything.** You may report a bug fixed; the user
  decides whether the behaviour is now what they wanted.
- Separate what you **observed** from what you **inferred**. "The quantity is
  null at line 40" is observed. "This is probably a race" is inferred, and
  should be labelled as such until you have reproduced it.
- When you need something from the user — a way in, real data, which of two
  behaviours is correct — ask **one question at a time**, in plain language.
  They may not read code.

## Never edit at random

Changing things until the error disappears is not debugging. It produces code
nobody understands and a bug that comes back in a different shape.

If your hypotheses are exhausted, stop and say so. That is a legitimate
outcome, and asking is cheaper than a confident wrong fix.

## Write it down

When it is fixed, record what was wrong, why it happened, what fixed it, and
what now prevents it. A bug fixed and not written down gets reintroduced by
someone who never knew it existed.

## A fix is not verified because it feels fixed

What you record here is your account of the process. Whether the work actually
holds is decided by `michi verify`, against evidence MICHI observed. Do not
claim more than the reproduction and the tests support.

## Stop rather than invent

Stop and say which happened when: you cannot reproduce it; the cause is in a
dependency you do not control; fixing it properly would contradict a locked
decision; or the fix would grow beyond this task's scope.
