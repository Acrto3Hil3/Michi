<div align="center">

# phaseforge

**A senior software engineering team, installed into your project.**

For people who have a great idea and an AI coding agent — but no engineering
background, and nobody to tell them when the AI is about to build something wrong.

```bash
npx phaseforge init
```

Works with Claude Code, Codex, Cursor, Antigravity, Copilot, Windsurf, Gemini CLI —
any AI agent that reads instructions from your project.

</div>

---

## The problem this solves

AI agents will build whatever you ask for. That's the problem.

If you describe your idea in two sentences, the agent doesn't push back, doesn't
ask what happens when two people book the same slot, doesn't mention that the
database design you just approved will need to be rebuilt in a month. It just
starts writing code. Confidently. And you can't tell the difference between good
code and code that will quietly lose someone's money.

A real software company solves this with people: a product manager who asks the
annoying questions, an architect who picks a stack you won't regret, a senior
engineer who reviews the work, a tester who tries to break it, and someone who
knows what hosting actually costs.

**phaseforge installs those people into your project as instructions your AI agent
follows.** You still talk to your agent normally. It just behaves like it works at
a company that cares.

---

## Install

In your project folder:

```bash
npx phaseforge init
```

That's it. It creates:

- **`AGENTS.md`** — the process, in a file every modern AI agent reads
- **`.claude/`** — 12 commands and 8 engineering skills (Claude Code)
- **`docs/`** — where your product decisions get written down and remembered

Nothing you already have is overwritten. Run it again any time.

Targeting one agent only:

```bash
npx phaseforge init --agent=codex
```

(`codex`, `cursor`, `antigravity`, `copilot`, `windsurf`, `gemini`, `claude`)

**Claude Code users** can also install it as a plugin:

```
/plugin marketplace add Acrto3Hil3/phaseforge
/plugin install phaseforge
```

---

## How you actually use it

Type these to your agent. In plain words. You don't need to know what any of them
mean technically.

### 1. Start with the idea

```
/idea I want an app where people can book a barber near them and pay a deposit
```

Your agent now acts as a product manager. It asks the questions you haven't thought
about — who uses this, what happens when someone cancels, what does "done" mean —
and writes the answers to `docs/IDEA.md`. It asks *few* questions at a time, in
plain language, and it doesn't move on until the idea is actually buildable.

### 2. Get the documents a real team would write

```
/prd      →  what we're building, exactly, in plain language
/trd      →  how we'll build it — stack, database design, and WHY
/plan     →  the work split into phases you can finish one at a time
```

These aren't paperwork. They're the memory. Every future session — with any agent —
reads them instead of guessing, which is how you stop your AI from redesigning the
same thing three different ways.

### 3. Build

```
/build phase-1
```

One phase at a time. Each one gets built, checked, and committed before the next
starts. Small steps you can actually follow — not 4,000 lines you have to trust.

### 4. Check it like a professional would

```
/review    →  a senior engineer reviews what was just built
/test      →  a QA tester tries to break it: empty inputs, wrong permissions,
              double-clicks, someone else's data, payments that fail halfway
```

This is the step vibe coders skip and regret. The tester deliberately stops being
the author, and reports what it *actually* checked — not "all tests pass."

### 5. Go live

```
/cloud I can spend about $20/month, expecting maybe 200 users
/ship
```

You get one recommendation with a real monthly number — not a comparison table you
aren't qualified to judge. Then a pre-launch checklist, a deployment you can
repeat yourself, and a backup you've actually tested restoring.

### Any time

```
/status    →  where the project stands, in plain language
/refine    →  turn a rough request into a proper brief before handing it over
```

---

## `/refine` — the one to remember

This is the heart of it.

You write what you want the way you'd say it to a friend:

```
/refine make it so customers can cancel
```

And it comes back as the brief a senior engineer would have written: what
"cancel" means for money already paid, what happens to the barber's calendar, who
is allowed to do it, what the screen shows when it fails, what must be true
afterwards, and what is deliberately **not** in scope.

Then you hand *that* to your agent. Same idea, same you — a completely different
result, because the agent stopped having to guess.

---

## The team you're installing

Each skill activates automatically when its kind of work comes up.

| | Does what |
|---|---|
| **prompt-engineer** | Turns a rough sentence into a brief an agent can't misread |
| **product-manager** | Asks what you haven't thought about; writes the PRD |
| **solution-architect** | Picks boring, proven technology sized to your real budget; designs the data properly the first time |
| **ux-designer** | Designs the flow and the three screens AI always forgets: loading, empty, error |
| **senior-engineer** | Reviews the work with the standards of someone who's been paged at 3am |
| **qa-tester** | Tries to break it, and tells you honestly what was and wasn't checked |
| **cloud-advisor** | Names the actual service and the actual monthly cost; insists on a tested backup |
| **architecture-memory** | Keeps decisions written down so a fresh session doesn't undo them |

---

## Why this makes your AI cheaper and better

**Small context.** Work happens one phase at a time. Your agent reads the phase
file and the architecture notes — not your whole codebase. Less context means
fewer tokens, fewer mistakes, and no "the AI forgot what it built last week."

**Written-down decisions.** `docs/architecture/DECISIONS.md` records *why* things
were chosen. Without it, a new session reads your code, disagrees, and "improves"
away something load-bearing. With it, it doesn't.

**Rules it can't skip.** `AGENTS.md` states the non-negotiables — the database
design comes before the code, permissions are checked on the server, nothing
touching money ships unverified. Your agent reads these every session, whether or
not you remember to mention them.

---

## What gets created in your project

```
AGENTS.md                          the process, for any agent
CLAUDE.md                          pointer, for Claude Code
.claude/commands/                  the 12 commands
.claude/skills/                    the 8 engineering skills
docs/
  ENGINEERING-CONSTITUTION.md      the rules that don't bend
  PROGRESS.md                      what's built, what's verified, what's next
  phases/TEMPLATE.md               one file per phase of work
  architecture/
    SYSTEM.md                      how the pieces fit
    DOMAIN.md                      what things mean in your business
    DATA.md                        what's stored, what's calculated
    DECISIONS.md                   what was chosen, and why
```

These are **yours**. Edit them freely — they're your project's memory, in plain
English, readable without an engineer.

---

## Not using Claude Code?

The commands are Claude Code's format, but the thinking isn't locked to it.

`AGENTS.md` is read natively by Codex, Antigravity, and a growing number of
agents. For Cursor, Copilot, Windsurf and Gemini CLI, `init` writes a file in each
one's own location pointing at it.

For anything else: open `AGENTS.md` and paste the workflow section into your agent.
It works the same way — the process is the product.

---

## Commands

| Command | For |
|---|---|
| `/setup` | Point the team at an existing project |
| `/idea` | Start here — describe it in plain words |
| `/refine` | Turn a rough request into a proper brief |
| `/prd` | What we're building |
| `/trd` | How we're building it, and why |
| `/plan` | Split it into phases |
| `/build` | Build the next phase |
| `/review` | Senior engineering review |
| `/test` | Break it on purpose |
| `/cloud` | Where to host, for your budget |
| `/ship` | Pre-launch check and deploy |
| `/status` | Where things stand |

CLI:

```bash
npx phaseforge init          # set up in this project
npx phaseforge init --global # Claude Code, every project
npx phaseforge status        # what's installed
npx phaseforge uninstall     # remove commands and skills, keep your docs
```

---

## Works well with

phaseforge governs *process*. These are separate, excellent tools that solve
adjacent problems — install them alongside it if they fit:

- **[ponytail](https://github.com/DietrichGebert/ponytail)** by Dietrich Gebert (MIT) —
  keeps your agent from over-engineering. Pairs naturally with `/review`.
- **graphify** — turns a codebase into a knowledge graph your agent can navigate.

Neither is bundled or redistributed here. Install them from their own sources.

---

## FAQ

**I genuinely can't code. Is this for me?**
Yes — that's who it's built for. You describe what you want; the team handles the
engineering judgement. You'll learn some vocabulary along the way, because the
documents are written for you to read, not for a developer.

**Do I still need an AI agent?**
Yes. phaseforge isn't an AI — it's the instructions that make the AI you already
have behave like a senior team. Bring Claude Code, Codex, Cursor, or any other.

**Will it slow me down?**
The first hour, a little. After that, no — because you stop rebuilding things.
Most AI-built projects die at the point where the codebase becomes too tangled for
the agent to change safely. This is the thing that prevents that.

**Can I change the rules?**
Every file is plain markdown in your repo. Edit anything. `AGENTS.md` is yours
once it's installed.

---

MIT © Subhash Yadav
