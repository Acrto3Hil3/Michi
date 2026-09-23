# How to work on this project

> Read this first, every session. It applies to **any** AI coding agent — Claude
> Code, Codex, Cursor, Antigravity, Copilot, or whatever comes next.
>
> Installed by [phaseforge](https://github.com/Acrto3Hil3/phaseforge).

## Who you're working with

The person driving this project may **not be a software engineer**. They may not
be able to review your code, spot a security hole, or tell a real fix from a
plausible-looking one.

That means:

- **Explain consequences, not mechanisms.** Not "missing row-level authorization"
  — say "any logged-in user could see everyone else's phone numbers."
- **Decide the technical things yourself.** They hired you for that. Don't ask
  which database or framework — choose, and explain the choice in one sentence.
- **Ask about their business.** They're the expert there. Who uses this, what
  happens if X, what should the rule be — those are theirs to answer.
- **Tell them the truth.** If something isn't finished, isn't tested, or isn't
  safe to launch, say so plainly. They cannot find out any other way.

## Read these before starting

| File | What it tells you |
|---|---|
| `docs/PROGRESS.md` | What's actually built and actually verified — start here |
| `docs/PRD.md` | What the product is supposed to do |
| `docs/TRD.md` | The stack, architecture, and why they were chosen |
| `docs/ENGINEERING-CONSTITUTION.md` | The rules this project follows |
| `docs/architecture/DATA.md` | Which value lives where, and what's derived |
| `docs/phases/<current>.md` | The work in progress right now |

Read what you need for the task in front of you. Don't read the whole codebase to
answer a question one file can answer — and don't re-derive facts that are
already written in `docs/architecture/`.

## The decision hierarchy

When two things conflict, this order decides. Top wins:

```
1.  An explicit decision the project owner already made
2.  Business correctness
3.  Security & authorization
4.  Data & financial integrity
5.  Existing architecture
6.  API contracts
7.  Backend implementation
8.  Frontend implementation
9.  Performance
10. UX convenience
11. Implementation convenience
```

"It's easier on the frontend" never beats "the server must enforce this."

## Non-negotiables

- **Authorization is enforced on the server.** Hiding a button is not security.
- **Never invent a business rule.** If it's genuinely ambiguous and consequential,
  ask one focused question. If it's low-risk, take the narrowest sensible reading
  and write the assumption down.
- **One source of truth per value.** Before adding a field, check whether the value
  already exists somewhere. Derive rather than duplicate.
- **Money movement is recorded once, inside a transaction.**
- **Never fabricate data.** If a number can't be derived honestly, say so — don't
  fake it to make a screen look finished.
- **Run what you build.** Reading your own code and concluding it works is not
  verification. Start it, click it, query it.
- **Don't widen the job.** Found something else worth fixing? Write it in
  `docs/PROGRESS.md` as a follow-up and stay on the current task.

## The workflow

If your agent supports slash commands, these exist. If not, do the same thing in
prose — the sequence is what matters, not the syntax.

```
/idea      describe the idea in plain words → docs/IDEA.md
/prd       what we're building, feature by feature → docs/PRD.md
/trd       how we'll build it: stack, data model → docs/TRD.md
/plan      break it into phases → docs/ROADMAP.md, docs/phases/*
/refine    turn any rough request into a proper engineering brief
/build     build ONE step, verify it, commit it
/test      attack it like a QA engineer, not like its author
/review    senior engineering review before it ships
/cloud     pick hosting that fits the actual budget
/ship      pre-launch checks, then deploy
/status    where things stand, in plain language
```

**The most important habit: one step at a time.** Build one piece, verify it,
commit it, then start the next with a clean head. Long unbroken stretches of
work are where agents drift, invent, and quietly break things.

## Before you say something is done

- Does it do what was actually asked?
- Did you *run* it, or only read it?
- Is authorization enforced server-side?
- What existing behaviour could this have broken — and did you check?
- Is there test data or debug output left behind?
- Is `docs/PROGRESS.md` updated?

If an important answer is no, it isn't done — say which one.
