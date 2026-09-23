---
description: Senior engineering review of the current diff — architecture, security, data integrity, regression
---

Review target: `$ARGUMENTS` (a diff, branch, phase name, or path — default to the
current uncommitted diff plus commits ahead of the main branch).

Apply the **senior-engineer** skill. This is a review, not a rewrite — report
findings, don't silently fix them unless the user asks.

## What to look for, in priority order

**1. Business correctness** — does it do the thing that was actually asked, or a
nearby thing that was easier?

**2. Security & authorization** — every new mutation gated server-side? Any route
where one user could reach another user's data without an ownership check? Input
validated at the boundary? Secrets or tokens anywhere they shouldn't be?

**3. Data integrity** — are invariants protected by the database, or only by
application code that will eventually be bypassed? Any value now stored in two
places? Any derived figure that got cached without an update path? Transactions
where multi-table writes must land together?

**4. Architecture** — right layer, right dependency direction. Business logic that
leaked into a controller or a component. A rule implemented twice.

**5. Contracts** — new or changed endpoints documented in the same change?
Response shape changes that will break an existing consumer?

**6. Regression surface** — what existing behaviour touches this code? Was it
checked, or assumed?

**7. Craft** — duplicated logic, dead code, leftover debug output, test data that
made it into the tree, mock values sitting in a real path, scope that crept
beyond what was asked.

## Report like a reviewer, not a linter

For each finding:

- **What's wrong**, in one sentence
- **Why it matters** — the concrete failure it causes, not "best practice"
- **Where** — file and line
- **Severity** — blocking / should-fix / nit

Lead with the blocking ones. If there are none, say so plainly rather than
padding the list with nits.

End with a single verdict: **safe to ship**, **fix first**, or **needs a decision
from the user** — and if it's the last one, say exactly what decision.
