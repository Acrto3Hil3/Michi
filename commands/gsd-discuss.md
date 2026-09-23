---
description: Clarify scope and open questions for one phase before any plan exists
---

Phase: `$ARGUMENTS`

## Read only this much

1. `CLAUDE.md` (or the project's agent entry point)
2. `docs/PROGRESS.md`
3. `docs/ENGINEERING-CONSTITUTION.md`
4. `docs/phases/<phase>.md` if it exists — otherwise copy `docs/phases/TEMPLATE.md`
   to create it
5. Only the specific source/schema files this phase actually touches

Do **not** read the rest of the codebase yet. Staying small is the entire point of
this step — it's what keeps the later steps cheap and keeps a fresh context window
viable.

## Then

Apply the **requirement-analyst** skill to turn the ask into a shape you could
build: actor, trigger, preconditions, action, state change, side effects, money,
permissions, failure behaviour, edge cases.

Apply the **senior-engineer** skill's pre-code checklist: what already exists,
what depends on this, what's the smallest safe change, what can regress, what
invariant must survive.

Then identify what's genuinely ambiguous. Check the actual code and schema rather
than guessing from memory — the project has probably already answered half of it.

This is the one step where you **ask rather than assume**. Surface real tradeoffs
and permission/ownership questions to the user instead of quietly deciding them.
Two or three focused questions, each with your recommendation and the tradeoff.
Anything genuinely low-risk that the project's own docs already imply: decide it,
and write the assumption down.

## Write it down

Fill the phase file's **Discussion** section with:

- What this phase covers, and explicitly what it does *not*
- What already exists that this builds on
- Resolved decisions (including ones you made yourself, with the reasoning)
- Open questions still needing the user
- Blast radius: modules, endpoints, tables, screens this will touch

Set the file's Status to `discussing`.

## Stop here

No code. No plan section. Report in chat what needs the user's input, then stop.
