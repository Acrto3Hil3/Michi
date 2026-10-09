# MICHI

**Your AI coding agent writes the code. MICHI makes sure it's building the right thing.**

You describe what you want in ordinary words. MICHI asks the questions a senior
engineer would ask, writes down what you decide and why, hands your agent a
precise brief instead of a vague wish — and then checks the work actually
happened instead of taking the agent's word for it.

Runs entirely on your machine. No account, no cloud, no AI subscription of its
own. It never writes your code.

```bash
npm install -g @subhashyadav98146/michi-cli
```

> **You need two things:** Node 20 or newer, and an AI coding agent or editor
> you already use — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Copilot,
> Cline, Antigravity, Zed, JetBrains Junie, Kiro or Trae. MICHI is the
> engineering layer around your agent, not a replacement for one.

---

## Start

```bash
cd your-project
michi init --agent claude-code     # or cursor, codex, zed, antigravity, junie, …
```

That creates `.michi/` — your project's memory, plain text files you can read —
and teaches your agent how to work with it.

Don't know which agent? Run `michi agents` and it tells you what it found. Or
run `michi install` with no agent at all: it writes an `AGENTS.md` that any
agent can read.

Then one command, which you'll use more than all the others:

```bash
michi status
```

It always answers the same question: **what's happening, and what needs me?**

---

## Then mostly, you just talk

Here's the part people miss. After `init`, you don't type `michi` commands
much. **Your AI agent runs them for you.** You talk to your agent the way you
always did:

> *"I want an app where my shop staff can track stock and get warned before
> things run out."*

Your agent now carries MICHI's skills, so instead of guessing, it asks:

> *"When stock gets low — who needs to know, and how? A notice when someone
> opens the app, or an email, or a message to a phone?"*

One question at a time, in plain language. Your answers become written
requirements — and **nothing becomes a requirement until you say so.**

When a real technical choice comes up, it's put to you in money and risk, not
architecture diagrams:

> *"Two options for where stock is stored. A proper database costs about £15 a
> month and handles two people editing at once. A single file is free, but if
> two people edit together, one of them loses their work. Which matters more
> right now?"*

You pick. MICHI writes down **what you chose and why**, permanently.

---

## The bit that makes it different

Your agent finishes and says *"done, all tests pass."*

MICHI records that as **a claim**, not as a fact:

```
TASK-001 is now CHANGES_DETECTED.
The agent says the tests pass. Nobody has checked that.
```

Nothing is marked finished until MICHI has run a check **itself** and watched
the result. You tell it once which commands it's allowed to run:

```yaml
# .michi/config.yaml
verification:
  allow:
    test: npm test
    lint: npm run lint
```

Now it can only run those. Not a script it found in your project, not something
an agent asked it to run.

```bash
michi verify TASK-001
# ✗ Refused: every piece of evidence was reported by the agent.
#   That is a claim about its own work, not evidence.

michi test TASK-001 --run test     # MICHI runs it and watches
michi verify TASK-001              # ✓ VERIFIED
```

---

## Six months later

You've forgotten everything. Ask:

```bash
michi explain D001 --simple
```

```
How people log in

You chose: a login service.
A specialist company handles passwords and we never store them.

Why: the app handles medical records, so a mistake in how people
log in would be serious.

You approved this on 26 September.

We also considered building it ourselves — ruled out because it
would make us responsible for password security.
```

No ids, no jargon. And if the record doesn't contain the answer, it says
**"that is not recorded"** rather than inventing something that sounds right.

```bash
michi decide impact D001     # what would change if I changed my mind?
```

---

## All the commands

Add `--json` to any of them. That's what your agent uses.

| | |
|---|---|
| `michi status` | where things stand, and what needs you |
| `michi init` · `scan` | set up, and see what's in the project |
| `michi agents` · `install` | connect your coding agent |
| `michi discover` | turn an idea into written requirements |
| `michi plan` | decide what ships first, and what waits |
| `michi decide` · `architecture` | the technical choices, and why |
| `michi context` · `graph` | what one piece of work actually needs |
| `michi task` | hand one piece to your agent |
| `michi test` · `review` · `debug` | gather evidence |
| `michi verify` | the only way anything gets marked done |
| `michi explain` | what is this, and why, in plain words |

---

## What it won't do

- **Write your code.** That's your agent's job.
- **Decide anything for you.** A requirement isn't confirmed, a decision isn't
  locked and scope isn't settled until you say so, by name. That's enforced in
  the code, not left to good intentions.
- **Delete anything.** Change your mind and the old version is marked
  superseded, not removed. You can always see what changed and why.
- **Phone home.** No network calls, no model calls, no telemetry.

---

MIT licensed · [Source and full docs](https://github.com/Acrto3Hil3/Michi)

Found a problem? [Open an issue](https://github.com/Acrto3Hil3/Michi/issues).
