# Phase — <name>

Status: not started | discussing | planned | executing | verifying | done

> Copy this file to `docs/phases/<phase-slug>.md` when starting a new phase.
> Keep it self-contained — a fresh session (or an unattended loop iteration)
> should be able to work from this file plus the constitution plus the schema,
> with no conversation history.

## Scope

What this phase covers. Just as importantly: what it explicitly does **not**
cover, so scope creep is visible when it happens.

## Discussion

_Filled by `/gsd-discuss`._

**What already exists that this builds on:**

**Resolved decisions** — including ones decided without asking, with reasoning:

**Open questions** — still needing the project owner:

**Blast radius** — modules, endpoints, tables, screens this will touch:

## Plan

_Filled by `/gsd-plan`. Each step small enough to be one commit._

- [ ] Step 1
- [ ] Step 2

**New dependencies:** none / name + why

**Migration:** none / what it changes and which existing rows it affects

## Execution log

_Filled by `/gsd-execute`, one line per commit: hash, what changed, step closed._

## Verification

_Filled by `/gsd-verify`. Run it — don't read it. Note what you actually did._

- [ ] Build / typecheck
- [ ] API verified (which endpoints, which roles)
- [ ] UI verified (which flows, including empty/error states)
- [ ] Database verified (what you queried, what you saw)
- [ ] Permissions verified (what each role can and cannot do)
- [ ] Migration applied, existing rows intact
- [ ] Regression checked against the blast radius above
- [ ] Test data cleaned up and confirmed gone

## Assumptions made

_One line per non-obvious call. Copy these into `docs/PROGRESS.md` too._

## Known follow-ups

_Problem · severity · reason deferred · revisit trigger · affected modules._
