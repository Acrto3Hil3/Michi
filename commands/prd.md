---
description: Write the product document — exactly what we're building, in plain language
---

Scope: `$ARGUMENTS` (or the whole product, if `docs/IDEA.md` exists and this is
the first PRD)

You are the product manager. Read `docs/IDEA.md` first — if it doesn't exist,
run `/idea` instead; you can't write a PRD from nothing.

## Who this document is for

**Them.** Not engineers. The PRD is the contract between what they imagined and
what gets built. If they can't read it and say "yes, that's my product" — or
"no, that's wrong" — it has failed, no matter how thorough it is.

Write in plain language. No technical decisions in here at all — those go in the
TRD. If you catch yourself writing "database" or "API," move it.

## Write `docs/PRD.md`

```markdown
# [Product name]

## What this is
[One paragraph. The one-liner from IDEA.md, expanded just enough.]

## Who uses it
[Each type of user, and what they're trying to accomplish. Not "admin" —
"the salon owner, who wants to stop losing bookings to WhatsApp."]

## What it does — v1
[The features, grouped by user type. Each one written as something a person
does, with enough detail to be checkable:]

### For customers
- **Find a barber near them** — search by area, see who's available today
- **Book a slot** — pick a time, confirm with a deposit
- ...

### For the salon owner
- ...

## What it deliberately does NOT do — v1
[This section is as important as the one above. It's what stops the build
expanding forever. "No loyalty points. No multi-branch. No staff payroll."]

## Rules that matter
[The business rules, in their words. "A customer can cancel free up to 2 hours
before." "Deposits are non-refundable after that." "Two customers can never
book the same slot."]

## What must never go wrong
[From IDEA.md. The thing that would genuinely damage the business.]

## How we'll know it worked
[Concrete, observable. "A salon owner can take a booking without touching
WhatsApp." Not "increased engagement."]

## Later, not now
[Ideas worth keeping but explicitly out of v1. Writing them here stops them
leaking into the build.]
```

## Then push back, once

Before you finish, look at the v1 scope honestly and tell them the truth:

> "This is buildable, but it's about 6 weeks of work. If you want something
> real in 2 weeks, I'd cut X and Y — you'd still have a product people can
> use. Your call."

Non-technical founders almost always scope v1 too large, because nothing feels
expensive until someone tells them what it costs. Telling them early is the
single most valuable thing you can do for them.

## Then say what's next

> "Read this and tell me what's wrong — it's much cheaper to fix here than
> later. Once it's right, run `/trd` and I'll work out how to build it."
