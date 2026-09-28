# CLI_CONTRACT

Derived from `MICHI.md` §56–§64, §51, §69.

## What the CLI is

The only way into the project brain. Every read and every write goes through
it, so that validation, permission checks and atomic writes cannot be bypassed.

It is deliberately thin: parse arguments, call engines in `@michi/core`, render
the result. No engineering logic lives here (see `ARCHITECTURE.md`).

## Two audiences

Every command has two callers, and this shapes the whole surface:

| Caller | Mode | Wants |
|---|---|---|
| A person at a terminal | default | short, plain-language, coloured, scannable |
| A skill running in a coding agent | `--json` | complete, stable, machine-parseable |

`--json` is not an afterthought on a few commands. It is the primary interface,
because the primary caller is an agent (see OQ-004).

## What the CLI does not do

It does not converse. It has no model and makes no network calls (§69, P8). It
cannot interview a founder, judge a code change, or decide what a requirement
means.

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
7   conflict — the requested change conflicts with a locked decision
8   not found — the named id does not exist
```

Distinct codes because the agent branches on them. `5` means "ask the human",
`7` means "explain the conflict" — collapsing both into `1` forces the agent to
parse error text, and that is how brittle integrations start.

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
michi discover [--json]
michi discover answer --key <k> --value <v>
michi discover close
```

Opens or resumes a discovery session. Prints what is known, what is assumed, and
the ranked list of what is still unknown — one question at a time in human
mode, the full structured list in `--json`.

The agent reads the unknowns, has the conversation, and persists each answer via
`discover answer`. `discover close` converts the session into an intent record
and moves the project to `SPECIFICATION`.

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
michi decide                                          list
michi decide show <id>
michi decide propose --category <c> --title <t> [--options <file>]
michi decide confirm <id> --choice <key> --by user
michi decide reject  <id> --reason <text>
michi decide supersede <id> --with <newId>
michi decide impact  <id>
```

```text
D001 Frontend     React          LOCKED
D002 Backend      Node.js        LOCKED
D003 Database     PostgreSQL     LOCKED
D004 Auth         Clerk          LOCKED
D008 Jobs         —              PROPOSED   ← waiting on you
```

`confirm` is the only path to `LOCKED`, it requires `--by`, and it records the
timestamp. There is no flag that locks a decision without a named approver
(P2) — this is enforced in the schema, not by convention.

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

Fails with `TASK_TOO_LARGE` rather than truncating mandatory context.

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
the agent. `review` with `CHANGES_REQUIRED` returns the task to
`CHANGES_DETECTED`. `debug` advances the disciplined process and refuses to
reach `FIX` before a reproduction is recorded — the process is the point, and a
CLI that lets you skip to the fix is not enforcing it.

### `michi verify`

```bash
michi verify <task-id> [--json]
```

Evaluates recorded evidence against the acceptance criteria and writes the
verification record. Every criterion must be `SATISFIED`, `UNSATISFIED` or
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
