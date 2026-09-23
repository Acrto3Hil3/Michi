---
description: Check a phase's done-when criteria against reality and update PROGRESS.md
---

Phase: `$ARGUMENTS`

Read `docs/phases/<phase>.md`. Verify its **Verification** criteria against the
running system — not against the code, and not against what the Execution log
claims happened.

## Run it, don't read it

For each criterion, actually exercise it:

- **Build / typecheck** — and make sure the command you ran really checks what you
  think. A typecheck that silently checks nothing is worse than none.
- **API** — call the real endpoints, as more than one role. Confirm both the
  success path *and* the 403 for a role that shouldn't have access.
- **Browser** — click the real flow end to end, including the empty and error states.
- **Database** — query directly and confirm the rows are what you expect, with the
  values you expect.
- **Permissions** — verify at least one thing each role can and cannot do.
- **Migration** — confirm it applied, and that existing rows survived it intact.
- **Regression** — re-check the blast radius the plan named.

## Clean up after yourself

Any data you created while testing gets removed, and you confirm it's gone with a
follow-up query. Leaving test rows in a real database is a defect, not a detail.

## Then the engineering gate

Before marking the phase done, answer honestly:

| Lens | Question |
|---|---|
| Business | Does it do what was actually asked? |
| Architecture | Does it fit the existing shape? |
| Database | Is the model right, are invariants protected? |
| API | Is the contract documented? |
| Security | Is authorization enforced server-side? |
| Backend | Are transactions and rules correct? |
| Frontend | Consistent, permission-aware, all four states? |
| Performance | Any obviously unbounded query? |
| Docs | Phase file and PROGRESS.md updated? |
| Regression | What could this have broken — and did I check? |

If an important answer is no, the phase is not done. Say which one and why.

## Write it down

- Tick the Verification items that genuinely passed, with **what you actually did**
  next to each — not just a checkmark.
- Leave unticked anything you didn't verify, and say so plainly rather than
  implying coverage you don't have.
- Update `docs/PROGRESS.md`: phase status, what's verified vs. merely present,
  any new Known Follow-ups (with problem, severity, reason deferred, revisit
  trigger, affected modules).
- Set Status to `done` only if verification genuinely passed.
