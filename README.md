# phaseforge

**Activates a senior engineer in your AI coding sessions.**

AI coding agents are excellent at writing code and bad at everything around it:
understanding what you actually asked for, remembering how your project is built,
knowing what they'll break, and admitting when something isn't verified.

phaseforge fixes that with three things: a **phase workflow** that keeps context
small, an **engineering constitution** your agent actually follows, and
**architecture memory** so each session doesn't rediscover your codebase from
scratch.

```bash
npx phaseforge init
```

---

## Why

If you've built anything substantial with an AI agent, you know the failure modes:

| What happens | What phaseforge does |
|---|---|
| Agent rewrites working code you didn't ask it to touch | Phase boundaries — one unit of work, follow-ups recorded not acted on |
| Burns 40% of the context window rediscovering your architecture | Architecture memory in durable files, read in one pass |
| Invents a business rule you never agreed to | Ambiguity gets asked about, not guessed — assumptions written down |
| Says "done" without running anything | Verification is a gate with named criteria, not a vibe |
| Adds a permission check on the frontend only | A decision hierarchy where security outranks convenience, always |
| Loses everything between sessions | Phase files + PROGRESS.md are the memory |

The core mechanism is boring and it works: **small, self-contained phase files**.
A fresh session reads one phase file instead of your whole repo, which is what
actually reduces token burn on a long project.

---

## Install

**Into one project** (recommended — commit it with your repo):

```bash
npx phaseforge init          # commands + skills into ./.claude
npx phaseforge init --docs   # also scaffold docs/ templates
```

**For every project on your machine:**

```bash
npx phaseforge init --global
```

**As a Claude Code plugin:**

```
/plugin marketplace add Acrto3Hil3/phaseforge
/plugin install phaseforge
```

Nothing is ever overwritten. Existing files are detected and left alone.

Then, inside Claude Code:

```
/gsd-init
```

which reads your actual project and fills the templates with real details.

---

## The workflow

```
/gsd-discuss <phase>   understand the requirement, surface real questions, write it down
        ↓
/gsd-plan <phase>      exact files, exact steps, each one committable
        ↓
/gsd-execute <phase>   ONE step per run, verified, committed, logged
        ↓
/gsd-verify <phase>    run it for real, then update PROGRESS.md honestly
```

Plus:

| Command | |
|---|---|
| `/gsd-init` | set up phaseforge against your real project |
| `/gsd-status` | where things stand, what's next, what's blocked |
| `/gsd-review` | senior engineering review of a diff — architecture, security, integrity, regression |

`/gsd-execute` deliberately does **one step then stops**. That's what makes a
fresh context window per step viable — and what makes unattended loops
(`docs/RALPH-LOOP.md`) safe to run.

---

## What gets installed

```
.claude/
├── commands/          the 7 /gsd-* commands
└── skills/
    ├── senior-engineer/       decision hierarchy, pre-code checklist, done-gate
    ├── requirement-analyst/   vague ask → buildable spec, decide vs. ask
    └── architecture-memory/   what to write down so sessions stop re-deriving it

docs/                  (with --docs, or via /gsd-init)
├── ENGINEERING-CONSTITUTION.md   your rules — edit them, they're yours
├── PROGRESS.md                   honest state: built vs. verified vs. not started
├── RALPH-LOOP.md                 unattended execution, and its guardrails
├── phases/TEMPLATE.md            the per-phase record
└── architecture/
    ├── SYSTEM.md                 layers, boundaries, dependency direction
    ├── DOMAIN.md                 per-domain ownership and rules
    ├── DATA.md                   source of truth per value — the highest-value page
    └── DECISIONS.md              locked decisions + what breaks if reversed
```

---

## The decision hierarchy

The single most useful thing phaseforge installs. When two concerns conflict,
this order decides — top wins:

```
1.  An explicit decision you already made
2.  Business correctness
3.  Security & authorization
4.  Data & financial integrity
5.  Existing locked architecture
6.  API contracts
7.  Backend implementation
8.  Frontend implementation
9.  Performance
10. UX convenience
11. Implementation convenience
```

"The frontend is easier if we skip the permission check" is rung 11 losing to
rung 3. It stops being a debate.

---

## Verification, not testing theatre

phaseforge does **not** require automated tests by default. Plenty of real
projects — especially solo and early-stage ones — deliberately defer them.

What it *does* require is honest verification: run the endpoint, click the screen,
query the database, check a second role gets a 403, clean up your test data, and
say what you actually did. "Typecheck passes" and "I clicked through it as two
different roles" are different claims, and phaseforge makes the agent make the
honest one.

If you want automated tests, add them to your constitution — it's your file.

---

## Companions

phaseforge works well alongside these. They're **separate projects by other
authors** — install them from their own sources, they are not bundled here:

- **[ponytail](https://github.com/DietrichGebert/ponytail)** by Dietrich Gebert
  (MIT) — forces the laziest solution that actually works. Pairs naturally with
  phaseforge: ponytail keeps the *code* small, phaseforge keeps the *process*
  disciplined.
- **Graphify** — turns a repo into a queryable knowledge graph. When a
  `graphify-out/` exists, phaseforge's architecture-memory skill treats
  architecture questions as graph queries first.

---

## Make it yours

The constitution that ships is a starting point, not scripture. Open
`docs/ENGINEERING-CONSTITUTION.md` and edit it — delete the financial rules if you
don't handle money, add your own non-negotiables, change the hierarchy if your
project genuinely orders things differently.

A constitution nobody agrees with gets ignored. One you wrote gets followed.

---

## License

MIT © Subhash Yadav
