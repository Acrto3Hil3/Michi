---
description: Turn a phase's discussion into a concrete, checkable file and migration plan
---

Phase: `$ARGUMENTS`

Read `docs/phases/<phase>.md`. Its **Discussion** section must already be filled
in — if it isn't, stop and run `/gsd-discuss <phase>` instead. Also read
`docs/ENGINEERING-CONSTITUTION.md` and the schema/source files this phase touches.

If open questions from the Discussion are still unanswered, stop and ask. Planning
on top of an unresolved business question just moves the guess further down the line.

## Produce a plan that

- **Lists exact files** to create or edit, grouped in the order they'll be done.
  Follow the dependency order that actually works: data model → migration →
  shared types → API contract → backend → frontend → docs.
- **Breaks the work into small steps**, each one independently committable. This
  matters most if an unattended loop will execute it — every step should leave the
  repo in a clean, working state.
- **Names any new dependency explicitly**, with one line on why the project's
  existing code can't do it.
- **Calls out the migration** this phase needs, and what existing rows it affects.
- **States the blast radius** — what existing behaviour could regress, so
  verification knows what to check.
- **Restates the "done when" criteria** as concrete, checkable verification items.
  "Works correctly" is not checkable. "Creating an order as a Salesperson produces
  a notification for the Sales Manager, confirmed via the API" is.

## Apply these lenses before you call the plan finished

- **Architecture** — right layer, right dependency direction, transaction boundaries
- **Database** — constraints that protect the invariant, not just columns
- **API** — contract documented in the same step as the endpoint
- **Security** — which permission gates each new mutation, server-side
- **Performance** — any unbounded query or N+1 this introduces
- **Regression** — what existing tests/flows to re-check

## Write it down

Fill the phase file's **Plan** section as a checklist. Set Status to `planned`.

## Stop here

Don't implement. Show the plan in chat for confirmation before `/gsd-execute`
runs it — unless the user has already said to proceed straight through.
