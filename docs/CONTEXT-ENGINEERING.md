# Why this reduces token burn

The expensive thing in a long AI-assisted project isn't generating code. It's
**rediscovery** — every fresh session re-reading your codebase to reconstruct
facts that were already established last week.

phaseforge attacks that in three places.

---

## 1. Bounded reads

Every `/gsd-*` command tells the agent **what to read and what to skip**.

`/gsd-discuss` reads: the entry point, PROGRESS.md, the constitution, one phase
file, and only the source files that phase actually touches. Not the repo.

Without that instruction, an agent handed "add credit tracking" will grep
broadly, open twenty files, and spend a large share of its window orienting
before writing a line. With it, the same task starts with a map.

## 2. One step per execution

`/gsd-execute` does exactly one plan step, then stops.

This sounds like a limitation. It's the opposite: it means step 9 of a plan runs
in a **clean context window** rather than one already 70% full of steps 1–8. Long
phases stop degrading, because no single session carries the whole phase.

The phase file is the handoff. If it's written well, iteration 9 doesn't need to
have seen iterations 1–8 — which is also exactly what makes unattended loops work.

## 3. Durable memory instead of re-derivation

The rule in the architecture-memory skill:

> Any architectural fact that took more than one file-read to establish gets
> written down.

Cheap to re-derive → don't bother. Expensive to re-derive → write it in
`docs/architecture/`. Things like:

- which module owns which data
- what a derived value is derived *from*
- which constraint protects which business rule
- why an obvious-looking refactor is actually unsafe

The single highest-value page is `docs/architecture/DATA.md` — source of truth per
value. Most expensive bugs in AI-assisted codebases come from two places both
claiming to own the same fact, and one table prevents that whole category.

---

## What this does *not* do

It doesn't compress your prompts or shrink model context. It changes **what gets
read**, which is where the waste actually is.

And it costs something: writing phase files and architecture notes is real work.
The trade pays off on projects that run for weeks and sessions that run long. On
a weekend script, the ceremony isn't worth it — use the senior-engineer skill
alone and skip the phases.

---

## Keeping the docs cheap

Documentation that costs more context than it saves is a net loss. So:

- Each architecture file stays readable in **one pass**. If `DOMAIN.md` grows
  past comfortable, split by domain rather than letting it sprawl.
- `PROGRESS.md` is a status table, not a changelog. Git already has the changelog.
- Phase files get archived, not deleted — but old ones aren't read unless relevant.
- **Stale docs are worse than none**, because they get believed. Update in the
  same change that caused the drift, never as a separate cleanup pass later.

---

## Signals it's working

- Sessions stop opening files unrelated to the task
- The agent references a decision from weeks ago without you re-explaining it
- Long phases don't visibly degrade toward the end
- You stop repeating the same three corrections in every prompt

Signals it isn't:

- Phase files written but never read back
- PROGRESS.md that doesn't match reality
- Architecture docs nobody updates → delete them rather than keeping fiction
