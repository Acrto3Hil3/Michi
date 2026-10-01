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
Copilot, Cline, and others.

MICHI doesn't write your code. Your agent does that. MICHI makes sure your
agent is building the right thing.

## Status

**Phases 1 to 3 built.** MICHI can look at a project, hold a structured
discovery with you through your AI agent, record what you decided, and work out
with you what actually ships first. Nothing is published yet.

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
| 4 | Architecture and decision records | not started |
| 5 | The context engine | not started |
| 6 | Task graph and prompt compiler | not started |
| 7 | Review, test, debug, verification | not started |
| 8 | Agent adapters | not started |
| 9 | Open-source release | not started |

## The idea in one line

> You decide **what** you want. MICHI works out **how** it should be built.
> Your coding agent **builds** it.

## License

MIT. See [LICENSE](LICENSE).
