# Ralph loop — unattended execution

Running `/gsd-execute` repeatedly across fresh context windows, so a long phase
gets built without one enormous session that degrades as it fills up.

## Why it works

Each `/gsd-execute` run does **exactly one plan step** and stops. That means each
iteration:

- starts with a clean context window
- reads only the phase file, the constitution, and the files that step touches
- leaves a clean, committed, bisectable repo state
- needs no memory of any previous iteration

The phase file is the shared memory. If it's well written, iteration 9 doesn't
need to have seen iterations 1–8.

## Running it

```bash
# one step at a time, reviewing between runs (recommended while you trust-build)
claude "/gsd-execute <phase>"

# or loop until the plan is complete
while claude "/gsd-execute <phase>"; do
  sleep 2
done
```

Adapt to your own runner. The important part isn't the shell loop — it's that
every iteration is bounded to one step.

## Rules the loop must not break

An unattended iteration has no human watching it, so these matter more, not less:

1. **One step per iteration.** Never cascade into the next step because it looks
   small.
2. **Never widen the phase.** A discovered improvement becomes a Known Follow-up
   in `docs/PROGRESS.md`. It does not become extra work in this run.
3. **Never skip verification** for the step. If it can't be verified, stop and
   say so rather than checking the box.
4. **Stop on genuine ambiguity.** If a step turns out to need a business decision
   nobody made, halt and surface it. Do not guess and keep going — an unattended
   guess compounds across iterations.
5. **Leave the repo clean.** Committed, building, no stray test data.

## When to stop the loop

- The plan's last box is checked → run `/gsd-verify <phase>`
- Two consecutive iterations make no progress → something's wrong, read the
  phase file yourself
- Any iteration reports a blocked decision → answer it before resuming
