# MICHI

**The path from idea to software.**

From rough ideas to clear engineering decisions, architecture, and precise
instructions for your AI coding agent.

---

## What this is

You have an idea for software and an AI coding agent that can write code. What
you probably don't have is someone to tell you when the agent is about to build
the wrong thing.

MICHI is that someone. It sits between you and your coding agent:

```text
You describe what you want, in ordinary words
        ↓
MICHI asks the questions a senior engineer would ask
        ↓
You make the decisions that matter, explained in plain language
        ↓
MICHI writes those decisions down, permanently
        ↓
MICHI hands your agent a precise brief instead of a vague wish
        ↓
Your agent builds it — and MICHI checks that it actually works
```

It is free, open-source, and runs entirely on your own machine. No account, no
cloud service, no AI subscription of its own. It works with whichever coding
agent you already use — Claude Code, Codex, Cursor, Gemini CLI, Windsurf,
Copilot, Cline, and others:

```bash
michi agents                      # what MICHI found, and what it can set up
michi install --agent cursor      # or claude-code, codex, windsurf, …
michi install                     # or none of them: AGENTS.md works everywhere
```

MICHI never overwrites a file you wrote. If your `AGENTS.md` differs from the
one MICHI would write, it shows you the difference and leaves yours alone.

MICHI doesn't write your code. Your agent does that. MICHI makes sure your
agent is building the right thing.

## Status

**Phases 1 to 8 built.** MICHI can look at a project, hold a structured
discovery with you through your AI agent, record what you decided, work out
with you what actually ships first, settle how it gets built, plan the work,
hand your agent a precise brief for one piece of it, and then check whether the
work it reported actually happened. Nothing is published yet.

What exists right now is the specification:

- [`MICHI.md`](MICHI.md) — the master product document, and the source of truth
- [`docs/specs/`](docs/specs/) — eleven engineering contracts derived from it

The architecture is settled. MICHI has three layers: the **skills** that talk to
you, running inside the AI agent you already use; **MICHI Core**, which is
ordinary software with no AI in it at all; and `.michi/`, a folder of plain text
files holding everything your project has decided.

One question remains open — what the published package will be called. It is
listed [here](docs/specs/README.md#open).

Requirements accumulate rather than being overwritten: come back in six months
with a change and MICHI adds to what you already agreed, marking what the
change replaced instead of quietly losing it.

And the hard conversation — which four of your eighteen ideas are version one —
happens with the cut written down. "Later" is recorded as a promise, not lost
as a deletion, and MICHI will not decide it for you.

Then the technical choices, one at a time, in money and risk rather than
architecture diagrams — and MICHI will not let the project move on while
anything in the first version has no decided approach.

And when it comes to building, MICHI plans the work from what you agreed and
compiles a brief for one piece of it: the requirement in your words, the
decision you approved and the reason you approved it, the limits you set, and
how anyone will know it worked — instead of your whole project. When your agent
reports back, MICHI records that as what the agent *said*. "The agent says the
tests pass" and "the tests pass" stay different sentences.

Then it checks. You tell MICHI, once, which commands it is allowed to run on
your project — your tests, your linter, nothing else. MICHI runs those itself
and keeps what it saw apart from what it was told. Nothing is marked done on an
agent's account of its own work, however confident; and when it is marked done,
the verdict says plainly which parts rest on something MICHI watched and which
parts rest on somebody's word.

Change your mind in six months and that works too: MICHI records what changed,
why, and that you asked for it, then regenerates the document. Nothing is ever
deleted, and nothing changes without your name on it.

What works today: point MICHI at a project and it writes down what is actually
there, saying plainly which parts it could not establish rather than guessing.
Then describe what you want to build, and your AI agent — following MICHI's
`senior-engineer` skill — asks you the questions a senior engineer would, turns
your answers into written requirements, and puts real technical choices to you
in plain language with a recommendation.

Nothing becomes a requirement until you say so, and nothing becomes a decision
until you choose. MICHI refuses to record either on your behalf — that is
enforced in the code, not left to good intentions.

The roadmap, in order:

| Phase | What | State |
|---|---|---|
| 0 | Specification | **done** |
| 1 | `michi init` · `scan` · `status` | **done** |
| 2 | The `senior-engineer` skill · `michi discover` · `michi decide` | **done** |
| 3 | The `product-planner` skill · `michi plan` · the PRD | **done** |
| 4 | The `architecture` skill · `michi architecture` · SYSTEM and TRD | **done** |
| 5 | The context engine · `michi context` · `michi graph` | **done** |
| 6 | The `implementer` skill · the task DAG · the prompt compiler | **done** |
| 7 | Review, test, debug, verification | **done** |
| 8 | Agent adapters | **done** |
| 9 | Open-source release | not started |

## The idea in one line

> You decide **what** you want. MICHI works out **how** it should be built.
> Your coding agent **builds** it.

## License

MIT. See [LICENSE](LICENSE).
