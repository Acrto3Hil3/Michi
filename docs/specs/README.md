# Phase 0 — Specification

These eleven documents are the engineering layer derived from [`MICHI.md`](../../MICHI.md).

`MICHI.md` is the **product** source of truth. These are the **contracts**. Where
they disagree, `MICHI.md` wins and the contract is a bug.

| Document | Answers |
|---|---|
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | What we are building, for whom, and when to say no |
| [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) | The rules every other document must obey |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Packages, engines, dependency direction, data flow |
| [STATE_MODEL.md](STATE_MODEL.md) | Project stages, task states, on-disk state schema |
| [DECISION_MODEL.md](DECISION_MODEL.md) | Decision lifecycle, ADR format, supersession, impact analysis |
| [CONTEXT_MODEL.md](CONTEXT_MODEL.md) | Context layers, packet schema, budgeting, hashing |
| [GRAPH_MODEL.md](GRAPH_MODEL.md) | Node and edge types, storage format, the queries it must answer |
| [SKILL_CONTRACT.md](SKILL_CONTRACT.md) | Shape of the seven skills and what they may not do |
| [CLI_CONTRACT.md](CLI_CONTRACT.md) | Every command: arguments, output, exit codes, side effects |
| [AGENT_ADAPTER_MODEL.md](AGENT_ADAPTER_MODEL.md) | How MICHI installs into any coding agent without leaking into the core |
| [SECURITY_MODEL.md](SECURITY_MODEL.md) | Risk classes, permission policy, enforcement points |

## Reading order

New to the project: `PRODUCT_VISION` → `DESIGN_PRINCIPLES` → `ARCHITECTURE`.

About to write code: `ARCHITECTURE` → the model for the engine you are touching →
`CLI_CONTRACT` → `SECURITY_MODEL`.

## Status

Phase 0. No implementation exists yet. Nothing below is locked until the five
open questions are answered.

## Open questions

These are places where `MICHI.md` is ambiguous or internally inconsistent. Per
§139 they are **not** being silently decided. Each has a provisional answer so
the specs stay coherent; each provisional answer is a `PROPOSED` decision, not a
`LOCKED` one.

### OQ-001 — What is the project brain directory called?

`MICHI.md` §17 and §30 name it `.senior-engineer/`. That reads as a holdover from
an earlier draft: the product is MICHI, the CLI is `michi`, and `senior-engineer`
is the name of one of the seven skills — so the directory would collide
conceptually with a skill.

**Provisional:** `.michi/`. Used throughout these specs.
**Needs:** a yes/no from the owner. It is a one-line change now and a migration later.

### OQ-002 — What are the npm names?

§57 shows `npx @michi/cli init`; §65 shows `@michi/core`, `@michi/cli`,
`@michi/skills`. Whether the `@michi` scope and the `michi` binary name are
available on npm has **not been checked**.

**Provisional:** specs say `@michi/*` and binary `michi`.
**Needs:** an npm availability check before Phase 1, and a fallback name if taken.

### OQ-003 — Are `D001` and `ADR-001` the same thing?

§16 and §61 identify decisions as `D001`. §17 and §97 store them as
`ADR-001-<slug>.md`. The document never says whether these are two identifiers
for one object or two different objects.

**Provisional:** one object. Canonical id `D001`; its record lives at
`decisions/ADR-001-<slug>.md`; the numbers are always equal;
`decisions/index.yaml` is the authoritative mapping. See `DECISION_MODEL.md`.

### OQ-004 — What does a conversational command do without an LLM?

This is the central architectural tension in the document. §69 forbids a
mandatory LLM in MICHI. But §59 (`discover`), §60 (`plan`), §61 (`decide`),
§114 (`review`, `test`, `debug`) describe work that requires reasoning and
natural-language conversation.

A deterministic CLI cannot interview a founder.

**Provisional resolution** — the split is:

```text
Conversation, judgement, prose   →  the skill, running inside the user's agent
Persistence, validation, state   →  the CLI
```

So `michi discover` does not interview anyone. It opens a discovery session,
prints the structured checklist of what is still unknown, and accepts captured
answers back as structured writes. The agent reads the checklist, has the
conversation with the human, and calls the CLI to persist each answer. Every
such command therefore needs two output modes: human-readable and `--json` for
the agent.

**Needs:** owner confirmation, because it determines what every command in
`CLI_CONTRACT.md` actually is.

### OQ-005 — How are tokens counted with no model available?

§39 and §63 require a token budget (`michi context` prints "Context budget:
18,000 tokens"). Exact token counts are tokenizer-specific and MICHI has no
model.

**Provisional:** a documented, deterministic estimate — `ceil(chars / 4)` for
prose and code — surfaced everywhere as an estimate (`≈18,000`), with the divisor
configurable per adapter. Never presented as exact.
**Needs:** confirmation that an approximation is acceptable for v1.
