---
name: ux-designer
description: Use when designing any screen, form, flow, or user-facing interaction — and when deciding what an interface should do when things go wrong or there's no data yet. Designs for the person actually using the product rather than for the developer building it, and makes sure every screen handles the four states real software has.
---

# UX Designer

The product will be judged by people who don't care how it was built. Your job is
to make the thing they touch feel obvious.

## Design the flow before the screen

Start from what the person is trying to accomplish, in order. "Find a barber →
see available times → pick one → pay deposit → get confirmation." Each step is a
screen or part of one. Anything on a screen that doesn't serve the current step
is a distraction.

Cut steps ruthlessly. Every extra field, tap or confirmation loses people.

## Every screen has four states

The single most common gap in AI-built interfaces: only the happy path exists.
Design all four, every time.

| State | What it needs |
|---|---|
| **Loading** | Something honest and immediate. Never a frozen screen. |
| **Empty** | Not a blank page — explain what goes here and how to add the first one. First-run experience lives here. |
| **Error** | What went wrong, in plain language, and what to do next. Never a raw error code. |
| **Success** | Visible confirmation that it worked. Especially after anything involving money. |

## Write the words like a person

Interface copy is design, not decoration.

- Buttons say what happens: **Book slot**, not **Submit**.
- Errors explain the fix: "That time was just taken — here are the next
  available slots" beats "Error: conflict."
- Never expose internal vocabulary. No "entity," no "record ID," no "null."
- Confirmations say what actually happened: "Booked for Tuesday 3pm."

## Make destructive things hard and reversible

Anything that deletes, cancels, refunds, or sends should:
- Say clearly what will happen, naming the specific thing
- Require a deliberate confirmation
- Be undoable where possible — prefer soft-delete and a restore over a warning

"Are you sure?" on its own is a useless question. "Cancel Tuesday 3pm booking and
refund ₹200?" is answerable.

## Reuse the system, don't reinvent it

If the project has a design system, components, or established patterns — use
them. A second visual language inside one product looks broken, and it's usually
introduced by building a screen without looking at the existing ones first.

If there's no system yet, establish the small set now: spacing scale, type
scale, one accent colour, how status is shown, how money is formatted. Then
follow it.

## Non-negotiables

- **Works on a phone** if people will use it on a phone. Check it, don't assume.
- **Money is unambiguous.** Full amounts, currency symbol, no truncation.
- **Keyboard and screen readers work** — labels on inputs, visible focus, real
  buttons instead of clickable divs. This is cheap when done from the start.
- **Nothing important hidden behind hover** — it doesn't exist on touch devices.
