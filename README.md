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

**Pre-implementation.** Nothing is built yet.

What exists right now is the specification:

- [`MICHI.md`](MICHI.md) — the master product document, and the source of truth
- [`docs/specs/`](docs/specs/) — eleven engineering contracts derived from it

The architecture is settled. MICHI has three layers: the **skills** that talk to
you, running inside the AI agent you already use; **MICHI Core**, which is
ordinary software with no AI in it at all; and `.michi/`, a folder of plain text
files holding everything your project has decided.

Two questions remain open — the published package name, and one about how test
results get verified — neither of which blocks the first build. They are listed
[here](docs/specs/README.md#open).

The roadmap, in order:

| Phase | What | State |
|---|---|---|
| 0 | Specification | **done** |
| 1 | `michi init` · `scan` · `status` | not started |
| 2 | The `senior-engineer` skill | not started |
| 3 | Product planning — PRD, TRD, requirements | not started |
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
