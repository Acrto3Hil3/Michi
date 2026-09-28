# DESIGN_PRINCIPLES

Derived from `MICHI.md` §13–§15, §43–§54, §102–§105, §121–§127, §136, §139–§140.

These are the rules every other specification must obey. Each one states what it
means in practice and what violating it looks like, because a principle you
cannot fail is not a principle.

---

## P1 — The user decides WHAT; MICHI decides HOW; the agent executes

*§121. The most important rule.*

**In practice.** Product decisions ("customers can cancel orders") belong to the
user. Engineering decisions ("cancellation is a state transition, not a delete")
are MICHI's to recommend and the user's to approve. Writing code belongs to the
coding agent.

**Violation.** MICHI decides the product should also do refunds. Or MICHI writes
application code itself. Or the agent invents an authentication scheme.

---

## P2 — Never silently turn a recommendation into a decision

*§14, §15, §122.*

**In practice.** The lifecycle is `Recommend → Explain → Ask → Confirm → Lock →
Execute`, always in that order. A decision record cannot reach `LOCKED` without
a recorded human confirmation. The decision hierarchy, when sources conflict:

```text
1. Explicit user decision
2. Project constraints
3. Security / safety requirements
4. Existing locked architecture
5. Engineering recommendation
6. Default
```

**Violation.** Any code path that writes `status: LOCKED` without an
`approved_by` value. A recommendation rendered in the same visual form as a
locked decision.

---

## P3 — No completion without evidence

*§49, §95, §123.*

**In practice.** "The agent says it is done" is not evidence. A task reaches
`VERIFIED` only when a verification record exists naming what was run and what
it produced: tests, build, typecheck, lint, review verdict, runtime output,
reproduction of the original bug.

**Violation.** A task marked `DONE` whose verification block is empty. A summary
that reports success by restating the instruction.

---

## P4 — Do not add complexity unless the problem requires it

*§43, §124, §71.*

**In practice.** Before adding anything, in order: Is it necessary? Does it
already exist here? Can the project handle it? Can the platform? Can the
standard library? Is there a simpler shape? Does this dependency earn its keep?

Stop at the first answer that holds. This applies to MICHI's own codebase and to
the architecture MICHI recommends to users.

The goal is not less code at all costs. The goal is the **minimum engineering
complexity that satisfies the approved requirements reliably.**

**Violation.** An interface with one implementation. A factory for one product.
A new dependency for twenty lines. Recommending microservices to a founder with
no users. Thirty agents where seven skills would do.

---

## P5 — Project artifacts, not conversation, are the source of truth

*§17, §31, §125.*

**In practice.** Everything durable lives on disk in `.michi/`, as Markdown,
YAML or JSON, readable without MICHI, diffable in git, and travelling with the
repository. A new agent session with zero history must be able to reconstruct
the project's engineering state from those files alone.

Compiled prompts are **generated artifacts**, never sources of truth.

**Violation.** State that exists only in a chat transcript. A decision explained
in conversation but never written down. A binary or database-backed store that
cannot be read with `cat`.

---

## P6 — Context is resolved, not dumped

*§36–§40, §47–§48, §126.*

**In practice.** Every handoff to an agent carries the smallest set of
requirements, decisions, architecture and files that the task genuinely needs,
classified `MUST_INCLUDE` / `PREFERRED` / `OPTIONAL` / `EXCLUDED`, and the
selection is inspectable via `michi context`.

**Violation.** Passing the whole repository. Passing the whole conversation.
Passing every historical decision. Any context selection the user cannot audit.

---

## P7 — Ask when a real decision is unknown; never invent it

*§79, §127, §139.*

**In practice.** On hitting a genuine gap: identify the ambiguity, explain it,
propose options, ask. Stop conditions apply to MICHI and to the agent alike —
ambiguous requirement, missing architectural decision, missing credential,
destructive action, conflict with a locked decision, material scope expansion,
tests exposing unrelated architectural problems.

The counterpart, so this does not become paralysis: if an implementation detail
is ambiguous but does **not** materially affect the user or the architecture,
pick the simplest reasonable option, write down that you picked it, continue.

**Violation.** Inventing a product requirement. Choosing a database because
nobody asked. Also: stopping to ask which variable name to use.

---

## P8 — Local-first, agent-agnostic, no lock-in

*§31, §53, §54, §69, §82.*

**In practice.** Source code stays local. Project state stays local. No
telemetry, no account, no mandatory cloud service, no mandatory model API. The
core must not know which agent will consume its output; agent-specific knowledge
lives only in adapters.

**The three layers** (`ARCHITECTURE.md`) are how this is enforced structurally:
conversation and judgement live in the Experience Layer, inside the user's own
agent; everything deterministic lives in MICHI Core; everything durable lives in
`.michi/`. The coding agent is an external executor, not part of MICHI.

**Violation.** A network call in Core. A model call anywhere below the
Experience Layer. A feature that only works with one vendor.
`if (agent === 'claude')` anywhere outside `adapters/`.

---

## P9 — No fake certainty

*§104, §105.*

**In practice.** Always distinguish, visibly:

```text
FACT            what was observed in the repository or on disk
USER DECISION   what the human approved
RECOMMENDATION  what MICHI suggests and why
ASSUMPTION      what is being taken as true without confirmation
UNKNOWN         what has not been established
```

Errors likewise distinguish `UNKNOWN` · `AMBIGUOUS` · `INVALID` · `BLOCKED` ·
`UNSUPPORTED` · `FAILED`.

**Violation.** "The best database is PostgreSQL." Presenting an assumption as a
fact. Reporting a guess with no hedge.

---

## P10 — Never destroy anything silently

*§51, §52.*

**In practice.** MICHI never silently deletes project data, touches a production
database, deploys, rotates credentials, removes dependencies, rewrites large
parts of a repository, or resets git history. Actions carry a risk class and the
policy for each class is the user's to configure.

Superseded decisions are marked `SUPERSEDED`, never deleted — the architectural
history is part of the value.

**Violation.** Any unprompted `rm -rf`. Any migration run without approval. A
decision overwritten in place.

---

## P11 — Two layers of language

*§13, §101, §103.*

**In practice.** Every explanation has a plain-language version first and
technical detail second, where detail helps. Jargon gets defined the first time
it appears. "Explain this simply" always works. The user should learn
engineering as a side effect of building, never as a prerequisite.

**Violation.** "Would you prefer Prisma or Drizzle?" to someone who has not yet
said what their app does. Any user-facing string that assumes the reader knows
what an ORM is.

---

## P12 — Tone: calm, honest, structured, never in charge

*§102.*

MICHI reads as a senior engineer who has seen this before and is not impressed
or alarmed: calm, professional, clear, practical, honest, non-judgmental,
technically strong — and unmistakably working for the user.

Never: lecturing, bureaucratic, enterprise-PM-flavoured, reflexively agreeable,
or quietly taking control.

---

## P13 — MICHI is built the way MICHI teaches

*§118–§119, §140.*

Typed interfaces. Validated schemas. Explicit contracts. Deterministic state.
Clear errors. Tests for every behavioural change, written failing first
(`RED → GREEN → REFACTOR`). Tests assert behaviour, not implementation. Bugs get
a reproducing test before a fix.

> The tool that helps people build better software must itself be built like
> good software.

---

## Resolving conflicts between principles

They will conflict. P4 (minimal) against P13 (tested). P6 (small context)
against P3 (evidence). Order of precedence:

```text
1. P10  safety — never destroy silently
2. P2   user authority over decisions
3. P3   evidence before completion
4. P7   ask rather than invent
5. P5   artifacts over conversation
6. everything else, judged case by case
```

If a conflict is not resolvable by that order, it is an open question for the
owner, not a judgement call for the implementer.
