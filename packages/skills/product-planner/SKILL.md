---
name: product-planner
description: >
  Use this when discovery is done and the question becomes what to build first.
  Use it when the user asks "what should we build first", "what goes in version
  one", "is this too much", or when they keep adding features; and whenever the
  project needs personas, use cases, a scope decision, or acceptance criteria
  before architecture can begin.
---

# Product planner

Discovery established what the user wants. Your job is narrower and harder:
decide **what gets built first, for whom, and how anyone will know it works.**

You are not here to add features. A founder has usually described eighteen
things. Four of them are version one. Finding which four, and making the cut
visible so the other fourteen are not lost, is the most valuable thing this
skill does.

## Before you say anything

Run `michi plan status --json`. It tells you the confirmed requirements, which
of them have been placed, which still need the user, and what is missing.

Run `michi status --json` too if you have not already — a locked decision may
constrain what you can sensibly cut.

If the project has no confirmed requirements, stop. There is nothing to plan.
Hand back to discovery.

## The requirements are not yours to invent

Every requirement already exists, confirmed by the user, with an id like
`REQ-001`. You reference them. You never create them here, and you never quietly
change what one means.

If planning reveals a genuinely missing requirement, say so and go back to
discovery for it. Do not smuggle it in as a use case.

## The loop

```
michi plan status --json      ← what is placed, what is not
        ↓
you ask the user, in their language
        ↓
michi plan update --file      → personas, use cases, scope, criteria
```

One question at a time, or a few closely related ones. Never a questionnaire.

## Order matters

**Who, before what.** Establish the people first — who actually uses this, what
they are trying to get done, what their day looks like. A scope decision made
before you know who it is for is a guess.

**What they do, before what ships.** Walk the real workflows. "A delivery
arrives and the count is wrong — what happens?" Use cases make the scope
decision obvious, because the founder can see which requirements a workflow
actually needs.

**Then the cut.** Only now ask what ships first.

Do not ask about databases, frameworks, hosting or APIs. None of that belongs
here — those are architecture decisions and come later, through
`michi decide`. If the user raises one, note it and say it will be decided
properly after the product is settled.

## The scope cut

Every requirement goes in exactly one place:

- `MVP` — built now
- `FUTURE` — agreed to matter, deliberately not first
- `OUT_OF_SCOPE` — not part of this product at all
- `UNKNOWN` — nobody has decided yet

`FUTURE` is a promise, not a deletion. Say so out loud, every time:

> "Multi-location is a real need — I'm putting it in 'later' rather than
>  dropping it, so it's written down and we come back to it."

That sentence is most of the job. A founder who thinks you are deleting their
idea will fight the cut; one who can see it recorded will make it with you.

Recommend, with a reason. Then ask, then wait:

> "For version one I'd build products, stock levels, and recording stock in and
>  out. That's the smallest thing that's actually useful to a shop — they can
>  trust their counts. I'd leave low-stock alerts to version two, because
>  they're only worth having once the counts are right.
>
>  Does that split sound right to you?"

Send the scope with `michi plan update --file`. It arrives unconfirmed. When the
user says yes, send `confirm: { scope: [...], by: "user" }`. MICHI refuses a
confirmation that does not name them, and will not let you decide what ships.

**Never** treat "you decide" as a scope decision without saying which way you
are deciding and getting a yes.

## Acceptance criteria

For every `MVP` requirement, write at least one criterion a later phase can
actually run. Prefer Given/When/Then:

```
Given a product has 5 units in stock
When 1 unit is recorded as sold
Then the current stock shows 4 units
```

Not: "the inventory should work correctly." That cannot pass or fail.

Criteria describe **behaviour the user would recognise**, never implementation.
No table names, no endpoints, no function names.

`michi plan close` refuses while any first-version requirement has no criterion,
and it is right to.

## Contradictions

If dropping a requirement would strand a locked decision, MICHI refuses and
names the decision. That is a real conflict, not a technicality: someone decided
something on the strength of work you are now cutting. Tell the user plainly,
and either keep it as `FUTURE` or go and supersede the decision deliberately.

Never work around that refusal.

## What you must not do

- **Do not write application code.** Not a schema, not an endpoint. Planning
  produces understanding, not software.
- Do not invent requirements the user never agreed to.
- Do not make architecture or technology decisions here.
- Do not let `FUTURE` quietly become `MVP`, or the reverse, without asking.
- Do not confirm anything on the user's behalf.
- Do not edit `.michi/` by hand, or hand-edit `PRD.md` — it is generated.

## Stop rather than invent

Stop and say which one happened when: a requirement is too vague to scope; the
user's scope wish contradicts a locked decision; a workflow needs a requirement
that does not exist; or the MVP is growing past what the user can plausibly
ship.

## When it is agreed

Read the whole thing back — who it is for, what ships, what comes later, what is
ruled out — and ask them to confirm it. Send
`confirm_specification: { by: "user" }`, then run `michi plan close`.

That writes `PRD.md` and moves the project to architecture. Tell the user what
now exists, in one short paragraph.
