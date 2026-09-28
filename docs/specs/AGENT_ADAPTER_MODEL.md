# AGENT_ADAPTER_MODEL

Derived from `MICHI.md` §54–§55, §70, §78, §115, §117.

## The rule

> The core must not know which agent will consume its output.

Every piece of agent-specific knowledge lives in `adapters/`. Nothing outside
that directory may branch on the agent in use. A `grep` for an agent's name
outside `adapters/` should return nothing, and that is worth enforcing in CI —
vendor conditionals spread quietly and are miserable to remove later.

This is what makes the same `.michi/` directory work with Claude Code today and
something that does not exist yet next year (P8).

## What differs between agents

Very little, which is why this stays cheap:

1. **Where instruction files go.** `.claude/skills/`, `.cursor/rules/*.mdc`,
   `AGENTS.md`, `.github/copilot-instructions.md`, and so on.
2. **What format they need.** Cursor rules need frontmatter or they never
   apply. Some agents read a single file; some read a directory.
3. **How work is invoked.** A slash command, a plain instruction, a file the
   agent reads on startup.
4. **Token budget defaults.** Different context windows, different sensible
   packet sizes — and, later, an optional tokenizer. An adapter may supply a
   real tokenizer for its agent; none is required, and the `chars/4` estimate
   with its method label (OQ-005) remains the default.

That is the whole surface. Everything else — the process, the state, the
decisions, the context selection — is identical, because it is engineering, not
vendor behaviour.

## Adapter interface

```ts
interface AgentAdapter {
  readonly id: string;              // 'claude-code', 'cursor', 'codex', …
  readonly displayName: string;

  /** Is this agent present in the project or on the machine? */
  detect(projectRoot: string): Promise<DetectionResult>;

  /** Where MICHI's instruction files belong for this agent. */
  installPlan(projectRoot: string): InstallPlan;

  /** Render a skill into this agent's expected format. */
  renderSkill(skill: Skill): RenderedFile[];

  /** Optional per-agent context defaults. */
  readonly defaults?: {
    budgetTokens?: number;
    tokensPerChar?: number;
  };
}
```

Adapters are **pure**. They describe what should be written; they do not write
it. Installation is performed by the CLI under the permission policy, so that
every file an adapter wants to create passes the same checks as any other write
(`SECURITY_MODEL.md`).

`installPlan` returns a plan rather than performing an install for the same
reason `--dry-run` exists: the user is entitled to see what is about to be put
in their repository.

## The universal baseline

`AGENTS.md` at the project root is the cross-agent entry point — the one file
most modern agents read without configuration. It is written for **every**
project regardless of which adapter ran, and it must be sufficient on its own.

An agent with no adapter at all should still be able to work with a MICHI
project by reading `AGENTS.md` and calling the CLI. Adapter support is an
optimisation; the baseline is the guarantee. A feature that cannot be expressed
through `AGENTS.md` and the CLI is a feature that breaks agent-agnosticism, and
it needs a different design.

## Targets

| Agent | Writes | Notes |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | native skill format |
| Cursor | `.cursor/rules/michi.mdc` | frontmatter is mandatory or the rule never applies |
| Codex | `AGENTS.md` | baseline |
| Gemini CLI | `GEMINI.md` | |
| Copilot | `.github/copilot-instructions.md` | |
| Windsurf | `.windsurfrules` | |
| Cline / Roo | `.clinerules` | |
| Kimi, Qwen, OpenCode, local agents | `AGENTS.md` | baseline |

Adding an agent is one file in `adapters/` plus a row here. That is the measure
of whether this boundary is holding: if adding an agent requires touching
`core`, the boundary has already leaked.

## Install behaviour

```text
michi init                 detect installed agents → propose → ask → write
michi init --agent cursor  install for a named agent
```

Detection proposes; it does not decide. A repository containing both
`.claude/` and `.cursor/` gets asked, not guessed.

Installation is idempotent and never destructive (P10): existing files are
never overwritten. A conflict is reported, with a diff, and left for the user.
Somebody's hand-tuned `AGENTS.md` is not MICHI's to clobber.

## The handoff contract

Independent of agent (§78). Adapters change the packaging, never the contract.

**MICHI provides:** task id · requirements · locked decisions · architecture ·
relevant files · constraints · acceptance criteria · testing requirements ·
stop conditions.

**The agent returns:** implementation summary · files changed · tests executed
· passed and failed counts · verification evidence · remaining issues · any new
decision it needs approved.

An agent that encounters an unlocked architectural decision stops and asks. It
does not invent one (P7).

The report is recorded via `michi task report` and is treated as a **claim**.
Verification is separate, and it is what decides whether the work is done (P3).
This matters more with agents than with people: an agent reporting success is
producing text, not evidence.

## Degrading gracefully

Not every agent can do everything. An agent that cannot run commands cannot
produce test evidence — which does not make MICHI unusable with it, it makes
that task's verification a human step.

Adapters declare what they support. MICHI adjusts what it asks for, states
plainly what it could not verify, and never quietly downgrades its standard for
"done" (P9).

## What adapters may never do

- Change the engineering process — same seven skills, same workflow, everywhere.
- Change the on-disk state format. `.michi/` is agent-independent, and a project
  must be able to switch agents mid-build without migration.
- Send anything anywhere. Adapters write local files, nothing else (P8).
- Add a vendor SDK dependency to Core, or any model call anywhere below the
  Experience Layer.
- Assume a model, a context window, or a pricing model.
