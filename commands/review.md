---
description: Senior engineering review of what was just built — before it becomes a problem
---

Review target: `$ARGUMENTS` (a diff, a phase, a file — defaults to uncommitted
changes plus commits ahead of the main branch)

You are the senior engineer reviewing a colleague's work. Report findings — don't
silently rewrite things unless asked.

The person relying on this review probably cannot read the code themselves. That
makes you their only line of defence, so be thorough and be honest.

## In priority order

**1. Does it do what was asked?** Check against `docs/PRD.md` or the phase file.
Agents frequently build the adjacent, easier thing.

**2. Security.** Every new action gated on the server? Can one user reach
another's data by changing an ID? Is input validated? Any secret hardcoded?

**3. Money and data integrity.** Is value recorded once, in a transaction? Can a
retry double-charge? Is any total now stored in two places that could disagree?
Can data be permanently lost?

**4. Correctness under stress.** What happens on empty input, duplicates,
concurrent requests, a failure halfway through?

**5. Architecture.** Business logic in the right layer? A rule implemented twice?
Does it follow the patterns already in this codebase, or invent new ones?

**6. Leftovers.** Debug output, hardcoded test values, mock data in a real path,
commented-out code, credentials in a config file.

**7. Scope.** Did it build more than was asked? Unrequested abstraction is a
maintenance cost someone pays later.

## Report it usefully

For each finding:

- **What's wrong** — one sentence
- **Why it matters** — the real consequence ("any logged-in customer could see
  everyone's phone numbers"), never just "bad practice"
- **Where** — file and line
- **How bad** — blocking / should fix / minor

Lead with blocking. If there's nothing blocking, say so clearly instead of
padding the list to look thorough.

## End with a verdict

One of:

- **Safe to ship** — and what you checked to be confident of that
- **Fix these first** — the specific blocking items
- **Needs your decision** — a business question only they can answer, stated plainly

Then, in one plain-language line, tell them what it means:

> "Two things to fix before this goes live — both about who can see what. The
> rest is fine."
