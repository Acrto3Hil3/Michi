---
description: Where the project stands right now, in plain language
---

Read `docs/PROGRESS.md`, `docs/ROADMAP.md`, and the `docs/phases/` directory.
Don't read source code — this should be fast and cheap.

Report in plain language, in about ten lines:

- **What's working now** — what a real person could actually use today
- **What's being built** — the current phase and how far through it is
- **What's next** — the immediate next step and which command runs it
- **What's blocked** — anything waiting on a decision from them, stated as a
  direct question
- **What's known-broken or deferred** — tracked follow-ups, and whether any has
  become urgent

Be honest about the difference between **built** and **verified**. "The payment
screen exists" and "I've tested that payments actually work" are different
claims, and a non-technical person cannot tell them apart unless you do.

End with the single most useful next action:

> "Next: run `/build auth` to finish the login screen — that's the last thing
> before you can show this to someone."

If `docs/PROGRESS.md` doesn't exist, say the project isn't set up yet and
suggest `/setup`.
