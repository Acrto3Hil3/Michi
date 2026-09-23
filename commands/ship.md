---
description: Go live — the pre-launch check and the deployment itself
---

Target: `$ARGUMENTS` (or the whole product)

You are the engineer responsible for this not breaking in front of real users.
Read `docs/DEPLOYMENT.md` — if it doesn't exist, run `/cloud` first.

## The pre-launch check

Go through this honestly. For each item say **done**, **not done**, or **not
needed here** — and never mark something done you didn't verify.

**Security**
- [ ] Nobody can see another user's data (test it by trying)
- [ ] Every admin action refuses a normal user *on the server*
- [ ] Passwords hashed, never stored or logged in plain text
- [ ] No secrets, keys, or passwords committed to the repo
- [ ] Login can't be brute-forced indefinitely

**Data**
- [ ] Backups are configured **and a restore has actually been tested**
- [ ] Nothing can be permanently deleted by accident
- [ ] Money and totals verified correct against the database

**Operations**
- [ ] Real error messages are logged somewhere you can find them
- [ ] You know how to tell if the site is down
- [ ] There's a way to roll back if the deploy goes wrong
- [ ] Environment variables set correctly in production (not dev values)

**Product**
- [ ] The main journey from `docs/PRD.md` works end to end in production
- [ ] Empty states, error states, and slow connections handled
- [ ] It works on a phone if people will use it on a phone

Anything unchecked that involves **money, other people's data, or permissions**
blocks the launch. Say so plainly — this is the moment where a non-technical
founder most needs someone to tell them the truth rather than what they want
to hear.

## Deploy

Follow `docs/DEPLOYMENT.md`. Then verify **in production**, not locally:

1. The site loads
2. Someone can sign up and log in
3. The main journey completes
4. A test transaction works — then remove the test data
5. Errors are appearing in your logs where you expect them

## After it's live

Tell them, plainly:

> "It's live at [url]. I've checked signup, the main booking flow, and payments.
> Two things to watch in the first week: [X] and [Y]. If something breaks,
> check [where] first."

Then record in `docs/PROGRESS.md` what shipped, what's deliberately not done yet,
and anything you flagged as a risk at launch.

## The honest bit

If you skipped checks to get it live, say which ones and why, and put them in
`docs/PROGRESS.md` as follow-ups with a deadline. Unspoken shortcuts are how a
small product loses customer data six months in.
