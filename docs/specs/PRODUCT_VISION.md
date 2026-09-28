# PRODUCT_VISION

Derived from `MICHI.md` §1–§14, §106, §117, §120, §128–§138.

## One sentence

MICHI is a free, open-source, local-first engineering layer that turns a
non-engineer's rough idea into the requirements, decisions, architecture, plan
and precisely-scoped instructions that the AI coding agent they already use
needs in order to build the right thing.

## The gap being closed

AI coding agents can write code. The person directing them usually cannot
specify software. Between "I want customers to buy things" and a correct
implementation sit several hundred engineering questions the user does not know
exist — authentication model, data model, API shape, authorization rules,
failure behaviour, test strategy, deployment target.

Today the user discovers those questions one regression at a time. MICHI asks
them up front, in language the user understands, records the answers as durable
project artifacts, and hands the agent a brief instead of a wish.

## Who it is for

**Primary.** A nontechnical or semi-technical founder with a real product idea,
an AI coding agent, and no engineer to tell them when the agent is about to
build the wrong thing.

**Secondary.** Junior developers learning professional process; experienced
developers offloading planning and context assembly; technical founders wanting
a control layer; teams wanting one standard workflow.

The primary user is the one who decides arguments. If a feature is excellent for
experienced developers and confusing for a founder, it is wrong.

## What the user experiences

1. They describe what they want, in ordinary words.
2. MICHI restates its understanding and asks only the questions it needs next.
3. When a real choice appears, MICHI explains the options in plain language,
   recommends one, gives the reason, and asks.
4. The user picks. The choice is written down permanently, with its reasoning.
5. MICHI produces a plan, resolves the context for one task, and compiles a
   precise instruction.
6. Their agent builds it. Tests run. Review runs. Evidence is recorded.
7. Months later they say "add multi-store support" and MICHI can tell them
   exactly what that breaks and why.

## North star

> A person should be able to describe the software they want in ordinary
> language, make understandable decisions when necessary, and rely on MICHI to
> transform that intent into disciplined engineering work for the AI coding
> agent they already use.

## The three-way split

This is the product, compressed:

```text
The human           decides WHAT
MICHI               determines HOW it should be engineered
The coding agent    executes the approved engineering work
```

Any feature that blurs one of these three into another is a design error.

## What MICHI is not

Not a coding agent. Not a replacement for Claude Code, Codex, Cursor or any
other agent. Not a SaaS, website, dashboard, hosted service, cloud platform,
online IDE, deployment platform or code host. Not a model provider and not a
consumer of a mandatory model API. Not a project-management tool.

MICHI never competes with the coding agent. It makes the coding agent easier to
direct correctly.

## V1 non-goals

Do not build, and challenge any feature that requires: a website · SaaS · a
dashboard · a hosted service · user accounts · billing · a cloud database · a
mandatory AI API · a custom model · a vector database · a hosted graph database
· an online IDE · a deployment platform.

## What we optimize for, in order

1. User intent accuracy
2. Engineering correctness
3. Architectural consistency
4. Minimal unnecessary complexity
5. Minimal unnecessary AI tokens
6. Project continuity
7. Traceability
8. Verification
9. User control
10. Portability

Explicitly **not** optimized for: number of agents, degree of automation, volume
of generated code, number of dependencies, number of features.

## Definition of done for v1

**User experience.** A nontechnical person can initialize MICHI, describe an
idea, understand MICHI's interpretation of it, answer its questions, accept or
reject its recommendations, understand the architecture that results, see
project progress, and request implementation — without learning engineering
vocabulary.

**Engineering.** MICHI can scan a repository, detect its stack, store
requirements and decisions, produce architecture artifacts, build a task graph,
resolve task-scoped context, compile an agent instruction, record agent runs,
and verify results.

**Persistence.** A brand-new agent session, with no conversation history,
understands the project from disk alone.

**Portability.** The same `.michi/` directory works with a different coding
agent tomorrow.

**Safety.** Destructive and architectural actions require explicit approval.

**Efficiency.** Measurably less context sent per task than dumping the
repository, and no re-litigation of decisions already locked.

## The test that matters

The product hypothesis is validated the first time this sequence works end to
end for someone who cannot code:

```text
rough idea → MICHI asks the right questions → structured requirement
→ proposed decision → user approves → stored ADR → generated task
→ compiled instruction → agent builds it → evidence proves it works
```

Everything in the roadmap before that point is setup. Everything after is scale.
