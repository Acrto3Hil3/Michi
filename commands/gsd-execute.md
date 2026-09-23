---
description: Implement a planned phase's next unchecked step, one small commit at a time
---

Phase: `$ARGUMENTS`

Read `docs/phases/<phase>.md`. If its **Plan** section is empty or has no unchecked
steps, stop and say so — writing a plan here is `/gsd-plan`'s job, not this one's.

## Do exactly one step

1. **Take the first unchecked step.** Not the whole plan. One. If you're running
   as an unattended loop iteration, this bounded scope is what makes a fresh
   context window per iteration workable.

2. **Implement it**, applying the **senior-engineer** skill throughout:
   - Data model before the code that uses it
   - Contract documented in the same change as the endpoint
   - Authorization server-side, always
   - One authoritative implementation per business rule
   - Reuse what exists before writing something new
   - Narrowest interpretation for anything still ambiguous — and log the assumption

3. **Run the thing that actually exercises the change.** Build, typecheck, hit the
   endpoint, click the screen, query the database. Reading the code you just wrote
   and concluding it looks right is not verification.

4. **Commit** with a message describing just this step. Follow the repo's existing
   commit conventions — check `git log` if unsure.

5. **Update the phase file**: check the box, append one line to the Execution log
   with the commit hash, and record any new assumption in both the phase file and
   `docs/PROGRESS.md`.

6. Set Status to `executing` — or, if that was the last unchecked step, say so
   explicitly and suggest `/gsd-verify <phase>` next.

## Stop after one step

Don't cascade into the next one in the same run. One step per run is what keeps
each iteration reviewable, bisectable, and cheap in context.

## If you discover something mid-step

A better approach, a bug in neighbouring code, a tempting refactor — **do not
widen the phase**. Record it as a Known Follow-up in `docs/PROGRESS.md` and
continue with the step you're on. Only deviate if the current step is genuinely
incorrect without it, and say so explicitly when you do.
