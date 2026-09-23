---
description: Build the next step — one piece at a time, verified before moving on
---

Phase: `$ARGUMENTS`

Read `docs/phases/<phase>.md`. If it has no plan yet, run `/plan <phase>` first.

Apply the **senior-engineer** skill throughout. You are writing code someone
non-technical will depend on and cannot review — that raises the bar, it doesn't
lower it.

## Do exactly one step

**1. Take the first unchecked step.** One. Not the whole plan.

**2. Look before you write.** Does something like this already exist in the
project? Reimplementing what's already there is the most common way AI-built
codebases rot.

**3. Build it**, following the project's own rules:
- Data model before the code that uses it
- Permissions enforced on the server, always — never only by hiding a button
- Any business rule implemented in exactly one place
- Money movement inside a transaction, recorded once
- Match the patterns already in the codebase rather than introducing new ones

**4. Actually run it.** Start the app, call the endpoint, click the screen, query
the data. Reading your own code and concluding it looks correct is not verifying
it — it's the single most common way an agent reports success on broken work.

**5. Commit** with a clear message describing this step.

**6. Update the phase file** — tick the step, log the commit, record any
assumption you had to make.

## Then stop

Do not continue to the next step. One step per run keeps each piece reviewable
and keeps the context window clean, which is why step nine works as well as step
one.

## If something's wrong with the plan

If the step turns out to be wrong, incomplete, or built on a bad assumption —
**stop and say so** rather than quietly working around it. A plan that's wrong
gets fixed in a minute. A workaround built on it costs days.

## Tell them what happened, in their language

Not "implemented the booking service with optimistic locking." Say:

> "Customers can now book a slot, and two people can't grab the same one — I
> tested that by trying it. Next step is the confirmation email."
