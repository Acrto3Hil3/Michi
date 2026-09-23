# Getting started

A full walkthrough with a real example: a booking app for a barbershop, built by
someone who has never written code.

You need two things: an AI coding agent (Claude Code, Codex, Cursor, Antigravity,
anything) and a folder for your project.

---

## 1. Install

```bash
cd my-barber-app
npx phaseforge init
```

Open your agent in that folder. If it's Claude Code, the commands below work as
typed. If it's another agent, everything still works — you just describe the step
instead of typing a slash command, and the agent follows `AGENTS.md`.

---

## 2. Describe your idea, badly

Don't try to sound technical. Say it the way you'd say it out loud.

```
/idea an app where people find a barber near them, book a time slot,
and pay a small deposit so they don't no-show
```

Your agent becomes a product manager. It comes back with something like:

> Good — this is buildable. A few things I need from you before we design it.
> I'll ask three at a time.
>
> 1. When someone books and pays a deposit, then cancels an hour before — does
>    the barber keep the deposit, does the customer get it back, or does it
>    depend on how late the cancellation is? **My recommendation:** full refund
>    if cancelled more than 24 hours ahead, barber keeps it after that. It's the
>    common pattern and it's easy to explain to customers.
> 2. Who sets a barber's available hours — the barber themselves, or you?
> 3. Do you need to handle more than one city at launch, or is one enough?

Answer in plain words. "Barber keeps it if it's under 2 hours. Barbers set their
own hours. One city."

That's it. That conversation becomes `docs/IDEA.md` and it never has to happen
again — not in this session, not in a new one, not with a different AI.

**This is the most valuable step and it's the one people skip.** Ten minutes here
saves rebuilding the whole thing in three weeks.

---

## 3. Get the real documents

```
/prd
```

Writes `docs/PRD.md` — what the product does, who uses it, what each screen needs
to handle, and what is deliberately *not* in version one. In plain language. Read
it. If something is wrong, say so now — it costs nothing to change a document.

```
/trd
```

Writes `docs/TRD.md` — the technical decisions. Which technologies, how the data
is structured, and **why** each choice was made.

You won't understand every word. That's fine. What matters is the "why" — if the
reasoning sounds wrong for your situation ("it assumed I'd have thousands of
users, I'll have forty"), say so, and it gets redesigned before a single line of
code exists.

```
/plan
```

Splits the build into phases. Something like:

> - **phase-1-accounts** — people can sign up and log in
> - **phase-2-barbers** — barbers create a profile and set their hours
> - **phase-3-booking** — customers see available slots and book one
> - **phase-4-deposits** — payment, and the cancellation rules
> - **phase-5-polish** — empty states, errors, mobile layout

Each phase is a thing you can look at and use when it's done.

---

## 4. Build one phase

```
/build phase-1-accounts
```

It does one step, checks that it works, saves it, and stops. Run it again for the
next step. It never dumps 3,000 lines on you at once — you can follow along, and
if something goes wrong you only have to undo one small piece.

Between runs, your agent starts fresh and small. That's deliberate: it's why the
tenth step is as reliable as the first, and why this costs fewer tokens than
letting one giant session sprawl.

---

## 5. Have it checked

When a phase is done:

```
/review phase-1-accounts
```

A senior engineer reviews the work that was just done — looking for the things
that hurt later: security holes, data that can get out of sync, code that will be
painful to change.

```
/test phase-1-accounts
```

A QA tester stops being the author and tries to break it. Empty forms.
Double-clicking the submit button. Logging in as one person and trying to see
someone else's bookings. Paying twice. Closing the tab mid-payment.

It reports what it **actually** tested, not "everything works." If your app lets
one customer see another's phone number, this is where you find out — not your
customers.

---

## 6. Make a change later

Three weeks in, you want something new. Don't just ask for it:

```
/refine let customers reschedule instead of cancelling
```

You get back the brief a senior engineer would have written: what happens to the
deposit, what the barber sees, how many times someone may reschedule, what
happens if the new slot gets taken while they're choosing, and what's out of
scope.

Read it, correct anything wrong, then:

```
/plan reschedule
/build reschedule
```

---

## 7. Go live

```
/cloud I can spend about $20 a month. Maybe 200 customers in the first few months.
```

You get one recommendation with real service names and real monthly numbers —
not a comparison table. Plus what's free now, what makes it stop being free, and
what the bill becomes then.

```
/ship
```

Pre-launch check, then deployment, written into `docs/DEPLOYMENT.md` as steps you
can follow yourself. It will insist you restore a backup once, on purpose, while
nothing is wrong. Do it. That's the difference between an outage and losing the
business.

---

## Any time

```
/status
```

Ten seconds: what's built, what's verified, what's next, what's blocked.

---

## A realistic first week

- **Day 1** — install, run `/idea`, answer the questions honestly. Read the PRD.
- **Day 2** — `/trd` and `/plan`. Push back on anything that sounds oversized for
  what you're actually doing.
- **Day 3** — build phase 1 end to end, including `/review` and `/test`. It'll
  feel slow. It's the only day that does.
- **Day 4+** — the loop. Build, review, test, next.

---

## When *not* to use all this

A typo, a colour change, a wording fix — just ask your agent directly. The
ceremony is for work with consequences: new features, anything touching money,
anything touching who-can-see-what, and anything that changes how data is stored.

The engineering skills still apply to small changes. The process doesn't have to.

---

## If your agent isn't Claude Code

The slash commands are Claude Code's format. Everywhere else:

- Codex and Antigravity read `AGENTS.md` on their own — just say *"follow the
  phaseforge process in AGENTS.md"* once.
- Cursor, Copilot, Windsurf and Gemini CLI got a pointer file during install.
- Anything else: open `AGENTS.md`, paste the workflow section into the chat.

Then instead of `/prd`, say *"write the PRD for this, following AGENTS.md."*
Same result. The process is the product — the commands are just shortcuts.
