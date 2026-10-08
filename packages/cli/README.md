# MICHI

**The path from idea to software.**

MICHI sits between you and your AI coding agent. You describe what you want in
ordinary words; MICHI asks the questions a senior engineer would, records what
you decided and why, and hands your agent a precise brief instead of a vague
wish — then checks that the work actually happened.

It runs entirely on your own machine. No account, no cloud service, no AI
subscription of its own, and it never writes your application code.

```bash
npm install -g @subhashyadav98146/michi-cli

cd your-project
michi init --agent claude-code     # or cursor, codex, windsurf, gemini-cli, …
michi status                       # always start here
```

Works with Claude Code, Codex, Cursor, Gemini CLI, Windsurf, Copilot, Cline —
or with no adapter at all, through the `AGENTS.md` that `michi install` writes.

See the [project README](https://github.com/Acrto3Hil3/Michi#readme) for the
full picture, and `michi --help` for every command.

## The two rules worth knowing

**Only you confirm anything.** A requirement is not confirmed, a decision is
not locked and the scope is not settled until you say so, by name. That is
enforced in the code, not left to good intentions.

**A report is not evidence.** When your agent says the tests pass, MICHI
records that as a claim. It marks work verified only against a check it ran
itself, from a list of commands you allow-listed — and the verdict says plainly
which parts rest on an observation and which on somebody's word.

MIT licensed.
