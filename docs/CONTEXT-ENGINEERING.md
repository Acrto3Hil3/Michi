# Why this makes your AI cheaper and more reliable

Every AI agent has a limited working memory. Fill it up and two things happen:
you pay more, and the answers get worse — it starts forgetting what it decided
an hour ago and contradicting itself.

The expensive thing in a long project isn't writing code. It's **rediscovery** —
every new session re-reading your whole project to work out facts that were
already settled last week.

phaseforge attacks that in three places.

---

## 1. It tells your agent what *not* to read

Every command says explicitly which files to open and which to skip.

`/plan` reads the idea document, the progress file, the rules, one phase file,
and only the parts of the code that phase actually touches. Not the whole
project.

Without that, an agent handed "add cancellation" will search broadly, open twenty
files, and spend a large share of its memory just orienting itself before writing
a single line. With it, the same task starts with a map.

## 2. It builds one step at a time

`/build` does exactly one step, then stops.

This sounds like a limitation. It's the opposite. It means step 9 of a plan runs
with a **clean, empty memory** instead of one already 70% full of steps 1–8. Long
stretches of work stop getting worse toward the end, because no single session
has to carry the whole thing.

The phase file is the handover note. If it's written properly, step 9 doesn't
need to have witnessed steps 1–8.

## 3. It writes things down instead of working them out again

The rule the architecture-memory skill follows:

> Any fact that took more than one file to establish gets written down.

Cheap to work out again → don't bother. Expensive → it goes in
`docs/architecture/`. Things like:

- which part of the system owns which data
- what a calculated number is calculated *from*
- which database rule protects which business rule
- why an obvious-looking cleanup is actually dangerous

The single most valuable page is `docs/architecture/DATA.md` — for every
meaningful value, where the truth lives. The most expensive recurring bug in
AI-built software is two places both claiming to own the same fact, and one table
prevents that entire category.

---

## What this does *not* do

It doesn't shrink your prompts or change your AI plan. It changes **what gets
read**, which is where the waste actually is.

And it costs something: writing the documents is real work. The trade pays off on
anything that runs for weeks. On a weekend script it isn't worth it — just use
the skills and skip the phases.

---

## Keeping the documents cheap

Documentation that costs more to read than it saves is a net loss. So:

- Each architecture file should be readable **in one sitting**. If one grows past
  comfortable, split it rather than letting it sprawl.
- `PROGRESS.md` is a status table, not a diary. Your version history already has
  the diary.
- Old phase files get archived, not deleted — and aren't read unless relevant.
- **Out-of-date documents are worse than none**, because they get believed.
  Update them in the same change that made them wrong, never as a cleanup "later."

---

## Signs it's working

- Your agent stops opening files unrelated to what you asked
- It refers back to a decision from weeks ago without you re-explaining it
- Long stretches of work don't visibly deteriorate toward the end
- You stop repeating the same three corrections in every message

Signs it isn't:

- Phase files being written but never read back
- A progress file that doesn't match what's actually built
- Architecture notes nobody updates — delete them rather than keeping fiction
