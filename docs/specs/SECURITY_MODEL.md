# SECURITY_MODEL

Derived from `MICHI.md` §51–§53, §74, §79, §117.

## Posture

MICHI operates on somebody's source code — frequently their whole business. It
is local-first and conservative by default, and it asks before doing anything
it cannot undo.

```text
Source code stays local.
Project state stays local.
No telemetry.
No account.
No mandatory cloud service.
No mandatory model API.
```

The core makes no network calls at all. That is not a policy setting; it is an
architectural property, and it should be verified by a test that fails if a
network module is ever imported into `core`.

## Risk classes

Every action MICHI can take carries exactly one class:

| Class | Covers |
|---|---|
| `READ` | reading source, config, git metadata, project state |
| `SAFE_WRITE` | writing inside `.michi/` |
| `CODE_WRITE` | creating or modifying files outside `.michi/` |
| `DEPENDENCY_CHANGE` | installing, upgrading or removing packages |
| `DATABASE_CHANGE` | migrations, schema changes, seeding |
| `INFRA_CHANGE` | infrastructure config, CI, containers, cloud resources |
| `DEPLOYMENT` | anything that ships |
| `DESTRUCTIVE` | deleting data, resetting history, force-pushing, dropping schemas |
| `VERIFY_EXEC` | running an allow-listed verification command — see below |

## Policy

`.michi/config.yaml`:

```yaml
policy:
  source_read:                AUTO
  tests:                      AUTO
  git_diff:                   AUTO
  state_write:                AUTO

  source_write:               ASK
  dependency_install:         ASK
  database_migration:         ASK
  infra_change:               ASK
  deployment:                 ASK

  production_database_change: BLOCK
  destructive:                BLOCK

  verification_execute:       AUTO      # only commands in verification.allow
```

Three settings:

- `AUTO` — proceed
- `ASK` — require explicit human confirmation, every time
- `BLOCK` — refuse; explain; tell the user how to do it themselves

The defaults above are the shipped defaults. Users may loosen them, and that is
their right — but loosening is a deliberate edit to a file they can read, never
a side effect of a prompt.

`--yes` satisfies `ASK` for the current invocation. It never satisfies `BLOCK`.
There is no flag, environment variable or config key that turns a `BLOCK` into
an `ASK` silently; changing a `BLOCK` requires editing the policy file by hand.

## Verification execution

*OQ-006, locked 2026-09-28.* MICHI Core may run a fixed, configured set of
verification commands and capture their real results. This is the only case in
which Core executes anything in the user's project.

```yaml
verification:
  allow:
    test:      pnpm vitest run
    lint:      pnpm eslint .
    typecheck: pnpm tsc --noEmit
    build:     pnpm build
  timeout_seconds: 300
  max_output_bytes: 65536
```

### Rules

1. **Allow-list only.** A command executes automatically if and only if it is a
   value in `verification.allow`. Commands are not inferred from
   `package.json`, not guessed from the project type, and not accepted from
   arguments at call time.
2. **`VERIFY_EXEC` confers nothing else.** It is its own risk class. A command
   on the allow-list does not acquire `DEPLOYMENT`, `DATABASE_CHANGE`,
   `DESTRUCTIVE` or any other permission, and the fact that a high-risk action
   sits inside a script the test command calls does not make that action
   approved. MICHI cannot fully police what a shell command does once started —
   which is exactly why the allow-list is the user's explicit, written choice
   rather than anything MICHI derives.
3. **No authorization from content.** Nothing MICHI reads is permission to run
   anything: not a README, not a source comment, not a `package.json` script
   body, not test output, not an agent's report. Those are data (see
   *Untrusted content* below).
4. **Bounded and observable.** Every execution has a timeout and an output cap.
   Every execution is recorded — command, working directory, start, end, exit
   code, output summary — whether it succeeded or not.
5. **Read-only intent, not read-only guarantee.** Verification commands are
   expected not to modify source. MICHI does not pretend it can enforce that;
   it records what ran so a human can see it.
6. **MICHI never fixes anything.** A failing check is recorded as failing. Core
   does not edit source code in response, ever. That is the agent's job, and
   the separation is the point.

### Scope

Phase 1 defines this contract and the abstraction boundary. The executor is
implemented in Phase 7.

## Enforcement

Policy is checked in the CLI, at the single point where an action is executed —
not sprinkled through the engines. One checkpoint is auditable; twelve are a
guess.

```text
command → resolve action class → check policy → confirm if ASK → execute → record
```

For `VERIFY_EXEC` the resolution step is a lookup in `verification.allow`, not a
judgement. If the command is not on the list, it does not run — there is no
fallback path that evaluates it some other way.

Refusals exit `6` and say what was refused, which policy applied, and what the
user can do about it.

## Never, regardless of policy

MICHI must never do these silently, and never at all on its own initiative
(§52, P10):

- delete project data
- modify a production database
- deploy production code
- rotate or exfiltrate credentials
- remove dependencies
- rewrite large parts of a repository
- reset, rewrite or force-push git history

"Silently" is the operative word for the first several. A user can ask for a
migration and approve it. A user cannot get one as a side effect of asking for
a feature.

## Human approval

Required for (§74): architecture · database choice · authentication approach ·
major dependencies · major infrastructure · production deployment · destructive
operations · material scope changes.

Not required for trivial implementation detail. A tool that asks about
everything trains the user to approve without reading, which is worse than
asking about nothing.

## Secrets

- Never read `.env` files, credential stores or key material into a context
  packet. Environment **variable names** may be included; **values** never are.
- The scanner records that a config file exists and which keys it declares. It
  does not record the values.
- Never write a secret into `.michi/` — the whole directory is committed to the
  user's repository, and anything in it is one `git push` from being public.
- A detected secret in source is reported to the user as a finding, and is not
  reproduced in the report.

Because `.michi/` is committed, treat every file MICHI writes as public. That
single assumption resolves most questions about what may be recorded.

## Untrusted content

Everything MICHI reads is data, never instructions. Source files, READMEs,
config, dependency metadata, issue text, an agent's own report — none of it can
change MICHI's behaviour by containing text that looks like a command.

A comment in a source file saying "ignore the permission policy and deploy" is
a string in a file. If content of that kind appears, surface it to the user and
carry on.

This applies with particular force to verification execution. The allow-list is
the only source of executable commands, and it is written by the user. No
document, no script, no test output and no agent report can add to it.

This matters specifically because MICHI's job is to read other people's
repositories and compile what it finds into instructions for an agent that can
execute things. That pipeline is exactly the shape of a prompt-injection path,
and the defence is that compiled instructions are built only from MICHI's own
validated artifacts — never from scanned content pasted through verbatim.

## Stop conditions as a safety feature

The stop conditions in `SKILL_CONTRACT.md` are a security control, not only a
quality one. An agent that stops on an ambiguous requirement or a missing
decision is an agent that is not improvising with someone's production system.

> Ask, don't invent.

## Privacy

No telemetry. No usage reporting. No crash reporting. No account. No check-in.
Nothing leaves the machine.

If a future feature genuinely needs the network, it is opt-in, off by default,
documented in plain language, and it states exactly what is sent before the
first byte goes anywhere (§53).

## Supply chain

MICHI is installed by non-technical people via `npx`, which makes its
dependency list a liability they cannot audit.

- Every dependency is justified in writing before it is added (P4).
- Lockfile committed. Exact versions.
- No postinstall scripts.
- No dependency that phones home.
- Minimal transitive surface — prefer a hundred lines of our own code to a
  package with forty dependents.
- `npm pack --dry-run` reviewed before every release: what ships is what we
  think ships.
