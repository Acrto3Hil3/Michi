# CLI_CONTRACT

Derived from `MICHI.md` §56–§64, §51, §69.

## What the CLI is

The only way into the project brain. Every read and every write goes through
it, so that validation, permission checks and atomic writes cannot be bypassed.

It is deliberately thin: parse arguments, call engines in MICHI Core, render the
result. No engineering logic lives here (see `ARCHITECTURE.md`).

The binary is written `michi` throughout this document. That name is not
confirmed (OQ-002) and is read from configuration rather than hard-coded.

## Two audiences

Every command has two callers, and this shapes the whole surface:

| Caller | Mode | Wants |
|---|---|---|
| A person at a terminal | default | short, plain-language, coloured, scannable |
| A skill running in a coding agent | `--json` | complete, stable, machine-parseable |

`--json` is not an afterthought on a few commands. It is the primary interface,
because the primary caller is an agent (see OQ-004).

## What the CLI does not do

*OQ-004, locked 2026-09-28.*

It does not converse. It has no model and makes no network calls (§69, P8). It
cannot interview a founder, judge a code change, or decide what a requirement
means. No command may be specified in a way that assumes otherwise.

So `michi discover` does not run an interview. It opens a discovery session,
reports what is still unknown, and accepts structured answers back. The
conversation happens in the agent, guided by the skill; the CLI is where the
answers land.

The same split applies to `plan`, `decide`, `review`, `test` and `debug`:
**the CLI orchestrates and records; the agent reasons.**

## Global flags

```text
--json              machine-readable output
--quiet             errors only
--no-color          disable ANSI
--project <path>    project root (default: nearest ancestor containing .michi/)
--dry-run           show what would change; write nothing
--yes               skip confirmations for ASK-class actions (see SECURITY_MODEL.md)
--version
--help
```

`--dry-run` is supported by every command that writes, without exception. A tool
that edits a stranger's repository owes them a way to look first.

## Exit codes

```text
0   success
1   generic failure
2   usage error — bad arguments
3   not a MICHI project — no .michi/ found
4   invalid state — a file on disk failed schema validation
5   blocked — a stop condition fired; human input required
6   permission denied — policy refused the action
7   conflict — the request conflicts with state that already exists
8   not found — the named id does not exist
```

Distinct codes because the agent branches on them. `5` means "ask the human",
`7` means "explain the conflict" — collapsing both into `1` forces the agent to
parse error text, and that is how brittle integrations start.

Exit codes are the coarse channel. The **error code** in the payload is the
precise one, and several error codes may share an exit code:

| Error code | Exit | Meaning |
|---|---|---|
| — (success) | 0 | |
| `INTERNAL_ERROR` | 1 | something unexpected; a bug |
| `EXECUTION_ERROR` | 1 | the command ran and failed |
| `USAGE_ERROR` | 2 | bad arguments, or not a directory |
| `NOT_INITIALIZED` | 3 | no `.michi/` here |
| `VALIDATION_ERROR` | 4 | a file on disk failed its schema |
| `BLOCKED` | 5 | a stop condition fired; a human is needed |
| `PERMISSION_DENIED` | 6 | policy refused the action |
| `CONFLICT` | 7 | conflicts with a locked decision |
| `ALREADY_INITIALIZED` | 7 | `.michi/` already exists; nothing was changed |
| `NOT_FOUND` | 8 | the named id does not exist |

Nothing may invent a second numbering. New conditions get a new error code
mapped onto one of these nine exit codes.

## Error shape

Every error, in `--json` mode:

```json
{
  "ok": false,
  "error": {
    "class": "BLOCKED",
    "code": "DECISION_REQUIRED",
    "message": "TASK-034 needs an approved decision for background job processing.",
    "detail": { "task": "TASK-034", "category": "infrastructure" },
    "next": "Run: michi decide propose --category infrastructure"
  }
}
```

Classes mirror §104: `UNKNOWN` · `AMBIGUOUS` · `INVALID` · `BLOCKED` ·
`UNSUPPORTED` · `FAILED`. The `next` field is what makes an agent recover
instead of stalling.

---

## Commands

### `michi init`

Initialize MICHI in an existing project.

```bash
michi init [--agent <name>] [--force]
```

Detects project type, package manager, framework, language, database, ORM, test
framework, deployment configuration, repository structure, and which coding
agents are installed. **Shows the findings, then asks permission** before
writing anything (§57).

Creates `.michi/`, the initial project map, initial state (`stage: DISCOVERY`),
and the agent integration files for the detected or named agent.

Never modifies application source code. Idempotent: a second run reports what
exists and writes nothing. `--force` re-scaffolds missing files only — it never
overwrites a file with content.

### `michi scan`

Rebuild the project map and the structural half of the graph.

```bash
michi scan [--json] [--deep]
```

Reads `package.json`, lockfiles, `tsconfig`, source directories, tests,
`Dockerfile`, compose files, README, environment examples, CI workflows and
database schema (§58). `--deep` runs the full Tree-sitter pass over sources;
the default does structure and configuration only.

Writes the project map, `FILE` and `SYMBOL` nodes, and `IMPORTS` / `CALLS`
edges. Never touches durable nodes.

### `michi status`

```bash
michi status [--json] [--recompute]
```

```text
MICHI PROJECT STATUS

Stage:              IMPLEMENTATION
Current milestone:  Inventory MVP
Architecture:       LOCKED
Open decisions:     2
Active task:        TASK-034
Completed:          17
Blocked:            1
Verification:       14/17 verified

Needs you:
  D008  Background job processing — proposed, awaiting your answer
  TASK-036  blocked: needs a payment provider account
```

The "Needs you" block is the point of the command. A status report that does
not say what is waiting on the human is a wall of numbers.

`--recompute` rebuilds the cached counts from records and reports any drift.

### `michi discover`

```bash
michi discover start   [--json]
michi discover status  [--json]
michi discover answer  --file <answers.json>
michi discover export  [--json]
michi discover close
```

Structured operations only. There is no bare `michi discover` that starts
talking to someone.

| | |
|---|---|
| `start` | opens a discovery session, or resumes the open one |
| `status` | what is known, what is assumed, what is still unknown — ranked |
| `answer` | persists a batch of structured answers from a file |
| `export` | emits the structured discovery result; read-only |
| `close` | converts the session into an intent record and moves the project to `SPECIFICATION` |

The division of labour:

```text
michi discover status --json     →  the skill reads the unknowns
                                    the skill asks the human, in their language
                                    "Do you mean one shop or several?"
                                    "What happens when someone cancels?"
                                    the skill interprets the replies
michi discover answer --file     ←  the structured result is persisted
```

`answer` takes a file rather than `--key`/`--value` pairs because the caller is
an agent persisting a batch of interpreted answers, not a person typing one
fact. Each answer records its `key`, `value`, `confidence`
(`STATED` | `INFERRED` | `ASSUMED`) and the question it came from — an inferred
answer must never later be reported as something the user said (P9).

`export` is read-only. `close` is the only one of the five that advances the
project stage.

### The update file

`answer --file` takes one **discovery update** — everything the skill learned
from a single turn of conversation. Every field is optional; Core validates,
allocates ids, and recomputes the session's state.

```json
{
  "intent": {
    "problem": { "value": "Retailers lose track of stock.", "confidence": "STATED" },
    "users":   { "value": ["Store owner"], "confidence": "STATED" }
  },
  "answers": [
    { "key": "shop_count", "value": "one", "confidence": "STATED",
      "question": "One shop, or several?" }
  ],
  "questions": [
    { "text": "What happens when stock goes negative?",
      "why": "It decides whether corrections need approval." }
  ],
  "requirements": [
    { "title": "Manage products", "description": "…", "type": "functional",
      "priority": "high", "origin_confidence": "INFERRED",
      "acceptance_criteria": ["A store owner can add a product"] }
  ],
  "resolve_questions": ["Q-002"],
  "confirm": { "requirements": ["REQ-001", "REQ-002"], "by": "user" },
  "reject":  { "requirements": ["REQ-003"], "by": "user", "reason": "Out of scope for now" },
  "confirm_intent": { "by": "user" }
}
```

Requirements arrive `PROPOSED`. They become `CONFIRMED` only through
`confirm`, and `confirm` **requires `by`** — there is no path to a confirmed
requirement that does not name the human who confirmed it. An update that tries
is rejected with `VALIDATION_ERROR`, not quietly accepted (P2).

`confirm_intent` is what moves a session to `CONFIRMED`, and it is the one
state Core cannot compute for itself.

One ingestion point rather than five subcommands: a conversational turn
produces answers, questions and draft requirements together, and splitting them
across separate calls would let a crash land half a turn.

### `michi plan`

```bash
michi plan [--json] [--milestone <name>]
michi plan tasks     --from-requirements
michi plan validate
```

Produces the planning artifacts and the task DAG from approved requirements and
locked architecture.

`plan validate` checks the plan before anyone builds against it: every task
reaches `READY` eventually, no dependency cycles, every requirement has at least
one task, every task has acceptance criteria. Cheap to run, and it catches the
plans that cannot be executed in any order.

Refuses to produce tasks while architecture-defining decisions are unlocked —
exit `5`, because planning on an unsettled foundation wastes the user's tokens
and their time.

### `michi decide`

```bash
michi decide                                          list the registry
michi decide show <id>                                the object and its ADR
michi decide propose --file <proposal.json>
michi decide confirm <id> --choice <key> --by user --adr <file>
michi decide reject  <id> --reason <text>
michi decide supersede <id> --with <new-id>
michi decide impact  <id>
```

```text
D001 Frontend     React          LOCKED
D002 Backend      Node.js        LOCKED
D003 Database     PostgreSQL     LOCKED
D004 Auth         Clerk          LOCKED
D008 Jobs         —              PROPOSED   ← waiting on you
```

`propose` takes a file rather than flags: a proposal carries options, each with
its own plain-language explanation and tradeoffs, and that does not fit on a
command line. The caller is a skill writing a document, not a person typing.

All ids here are **decision** ids (`D004`), never ADR ids (OQ-003). The registry
resolves the mapping; nothing computes one from the other.

`confirm` is the only path to `LOCKED`. It requires `--by`, records the
timestamp, and requires `--adr <file>` — the prose the skill wrote, which
becomes `decisions/ADR-00N-<slug>.md`. There is no flag that locks a decision
without a named approver, and none that locks one with no ADR (P2). Both are
enforced by the schema, not by convention.

`impact` runs the blast-radius analysis from `DECISION_MODEL.md` before a change
is made, and renders it as consequences rather than node ids.

### `michi graph`

```bash
michi graph [<node-id>] [--format text|mermaid|json] [--depth <n>]
michi graph orphans
michi graph coverage
```

Read-only. `orphans` lists requirements with no implementation and code with no
requirement; `coverage` lists acceptance criteria with no test. Both are
warnings — a young project is legitimately full of them.

### `michi context`

```bash
michi context <task-id> [--json] [--budget <tokens>] [--explain]
```

Resolves and prints the context packet: what is included, at which tier, and —
importantly — what was excluded and why (§63). `--explain` adds the ranking
score for each candidate, which is how you debug a selection that looks wrong.

```text
Context for TASK-034

Estimated context size:  ~14.2k tokens
Budget:                  ~18.0k tokens
Estimation method:       chars/4

MUST INCLUDE   5 items
PREFERRED      4 items
EXCLUDED       3 items + 12 more over budget
```

Sizes are always reported as estimates with the method named (OQ-005). Fails
with `TASK_TOO_LARGE` rather than truncating mandatory context.

### `michi task`

```bash
michi task list [--status <s>]
michi task show <id>
michi task next                          the next READY task, respecting the DAG
michi task start <id>  --agent <name>    → RUNNING; opens a run record
michi task report <id> --from <file>     record the agent's report → CHANGES_DETECTED
michi task block <id>  --reason <text>
michi task split <id>                    when context does not fit
```

`task next` is what a skill calls to find work, so it must respect dependencies
and never return a task whose context cannot be resolved.

### `michi review` · `michi test` · `michi debug`

```bash
michi review <task-id> --verdict PASS|CHANGES_REQUIRED --findings <file>
michi test   <task-id> --record <file>
michi debug  <task-id> --stage REPRODUCE|OBSERVE|HYPOTHESIS|ROOT_CAUSE|FIX|VERIFY
```

These record structured results; the judgement that produced them happened in
the agent.

`michi test` has two forms (OQ-006, locked):

```bash
michi test <task-id> --record <file>      ingest what the agent reported
michi test <task-id> --run test           run the allow-listed command itself
```

`--run <key>` names an entry in `verification.allow`; it is not a command
string, and no command may be passed at the call site. Results captured this way
are recorded `produced_by: MICHI`; `--record` results are `produced_by: AGENT`.
The executor itself lands in Phase 7. `review` with `CHANGES_REQUIRED` returns the task to
`CHANGES_DETECTED`. `debug` advances the disciplined process and refuses to
reach `FIX` before a reproduction is recorded — the process is the point, and a
CLI that lets you skip to the fix is not enforcing it.

### `michi verify`

```bash
michi verify <task-id> [--json]
```

Evaluates recorded evidence against the acceptance criteria and writes the
verification record. Each piece of evidence carries who produced it — `MICHI`
where Core ran the command itself, `AGENT` where it was reported (OQ-006) — and
the verdict states which it rested on. Every criterion must be `SATISFIED`, `UNSATISFIED` or
`NOT_APPLICABLE` with a reason.

**Only this command can move a task to `VERIFIED`** (P3), and only `VERIFIED`
tasks can be `DONE`. There is no override flag. If that becomes annoying, the
acceptance criteria were written wrong, and that is the thing to fix.

### `michi explain`

```bash
michi explain <id>          a decision, requirement, task, file or component
michi explain --simple
```

Answers from artifacts only. If the artifacts do not contain the answer, the
answer is "that is not recorded" — never a reconstruction (§100, P9).

`--simple` forces the plain-language layer, and it is always available (P11).

---

## Output conventions

**Human mode.** Short. What is true now, then what needs the human. Colour to
group, never as the only signal. Ids shown so they can be pasted into the next
command.

**JSON mode.** Every response is `{ "ok": true, "data": … }` or
`{ "ok": false, "error": … }`. Shapes are schema-validated and versioned;
adding a field is a minor change, removing or renaming one is breaking.

**Never** print raw stack traces in human mode; log them and print the class,
the message and the next step.

## Adding a command

Against P4, the bar is deliberately high:

1. Does an existing command cover it with a flag?
2. Does it serve the path from idea to software (§136)?
3. Can a skill accomplish it by composing existing commands?
4. Is it needed for the current phase, or is it speculation?

Fourteen commands is already generous for a v1. The pressure should be
downward.
