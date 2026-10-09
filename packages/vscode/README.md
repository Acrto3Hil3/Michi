<div align="center">
  <img src="media/logo.png" alt="MICHI" width="180" />
</div>

# MICHI

**Your coding agent writes the code. MICHI makes sure it's building the right thing.**

You describe what you want in ordinary words. MICHI asks the questions a senior
engineer would ask, writes down what you decide and why, hands your agent a
precise brief instead of a vague wish — then checks the work actually happened
instead of taking the agent's word for it.

Everything stays on your machine. No account, no cloud, no AI subscription of
its own, and it never writes your code.

---

## Two things to install

```bash
npm install -g @dev-subhash/michi
```

Then this extension. It drives that command — it is not a copy of MICHI, so
there is only ever one version answering, and this extension tells you if the
CLI falls behind what it expects.

> Needs **Node 20+** and an AI coding agent you already use. MICHI is the
> engineering layer around your agent, not a replacement for one.

## Then open a project

The extension offers to set MICHI up and connect it to whatever agent is
already there. It **shows you the exact file list before writing anything**,
and if you say "never for this project" it remembers.

Works with **Claude Code · Cursor · Copilot · Codex · Cline · Continue ·
Windsurf · Gemini CLI · Antigravity · Zed · JetBrains Junie · AWS Kiro ·
Trae** — and through `AGENTS.md`, with any agent at all, including ones that
don't exist yet.

## What you get

| | |
|---|---|
| **Status bar** | what stage the project is at, and how many things need you. Click to see them. |
| **MICHI: Set up in this project** | creates `.michi/`, then connects your agent |
| **MICHI: Connect a coding agent** | detects what's here, lists every option, you choose |
| **MICHI: Explain this decision or requirement** | what you agreed and why, in plain language |

## Then mostly, you just talk

After setup you don't run MICHI commands much — **your agent does.** You say:

> *"I want an app where my shop staff can track stock and get warned before
> things run out."*

Your agent now carries MICHI's seven skills, so instead of guessing it asks one
question at a time, in plain language. Your answers become written
requirements, and **nothing becomes a requirement until you say so.**

Technical choices come to you in money and risk, not architecture diagrams:

> *"A proper database costs about £15 a month and handles two people editing at
> once. A single file is free, but if two people edit together, one loses their
> work. Which matters more right now?"*

## The part that makes it different

Your agent finishes and says *"done, all tests pass."* MICHI records that as **a
claim**:

```
TASK-001 is now CHANGES_DETECTED.
The agent says the tests pass. Nobody has checked that.
```

Nothing is finished until MICHI has run a check **itself** — from a list of
commands you allow-listed — and watched the result:

```
michi verify TASK-001
✗ Refused: every piece of evidence was reported by the agent.
  That is a claim about its own work, not evidence.
```

There is no override flag.

## Six months later

```bash
michi explain D001 --simple
```

> **How people log in**
>
> You chose: a login service. A specialist company handles passwords and we
> never store them.
>
> Why: the app handles medical records, so a mistake in how people log in
> would be serious. You approved this on 26 September.

No ids, no jargon. And if the record doesn't contain the answer, it says
**"that is not recorded"** rather than inventing something plausible.

## What it will not do

- **Write anything without asking.** Every file is behind an explicit yes.
- **Decide for you.** Enforced in MICHI's code, not left to good intentions.
- **Delete anything.** Change your mind and the old version is marked
  superseded, so you can always see what changed and why.
- **Phone home.** No telemetry, no network calls, no account.

## Settings

| | |
|---|---|
| `michi.path` | where the `michi` executable is, if it isn't on your PATH |
| `michi.offerSetup` | whether to offer setup in a project that doesn't have MICHI |

---

MIT licensed · [Source, docs and issues](https://github.com/Acrto3Hil3/Michi)
