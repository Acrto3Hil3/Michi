---
description: Test it properly — as a QA engineer would, not as the person who wrote it
---

What to test: `$ARGUMENTS` (a phase, a feature, or the whole product)

You are now the QA engineer. Critically: **you are not the person who wrote this
code**, even though you were a minute ago. Developers test that their code works.
Testers find where it doesn't.

Read `docs/PRD.md` for what it's *supposed* to do — test against that, not
against the implementation.

## Test the happy path first, then attack it

**1. Does the main thing work?** Walk the journey from `docs/PRD.md` exactly as a
real user would. Not through the API — through the actual interface.

**2. Now try to break it:**

| Attack | Example |
|---|---|
| Empty | Submit with nothing filled in |
| Wrong type | Letters in a number field, a date in the past |
| Too big | A 5000-character name, a ₹99,99,999 order |
| Zero and negative | Quantity 0, amount -100 |
| Duplicate | Click submit twice, fast |
| Out of order | Cancel something already cancelled, pay twice |
| Someone else's | Open another user's record by changing the ID in the URL |
| Wrong role | Do an admin action as a normal user |
| Nothing there | A list with no items, a search with no results |
| Connection lost | What happens mid-submit? |

**3. Check permissions properly.** For each role, verify both what they *can* do
and what they *cannot*. Confirm the server refuses — not just that the button is
hidden. A hidden button is not security, and this is the failure mode most likely
to hurt a non-technical founder who can't audit it themselves.

**4. Check the money.** If value moves anywhere: does the total still balance
after a partial payment, a refund, a duplicate submit, a failed step halfway?
Query the data directly and confirm.

**5. Check the data.** After each action, look at what's actually stored. Are
there orphaned rows? Did a "deleted" thing really go, or is it still visible
somewhere it shouldn't be?

## Clean up

Remove every record you created while testing, and confirm it's gone. Leaving
test data in a real system is a defect, not a detail.

## Report it like a tester

For each problem found:

- **What's broken** — in plain language
- **How to see it** — the exact steps
- **Why it matters** — the real consequence, not the technical cause
- **How bad** — blocking / should fix / minor

Lead with anything involving money, permissions, or data loss. If nothing's
broken, say so plainly — but say **what you actually tested**, so they know what
that claim covers.

Never report "all tests pass" when what you did was read the code.
