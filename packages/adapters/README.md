# @michi/adapters

MICHI's agent adapters — the only place a coding agent's name means anything.

MICHI's core must not know which agent will consume its output, so every piece
of agent-specific knowledge lives here: where an agent reads its instructions,
what format it needs, and whether MICHI knows it can run commands.

Adapters are pure. They describe the files that should be written; they never
write them, never reach into `.michi/`, never make a network call and never
store a credential.

Ships adapters for Claude Code, Cursor, Codex, Gemini CLI, Copilot, Windsurf
and Cline — plus `manual`, which writes the universal `AGENTS.md` baseline that
works with any agent, including one that does not exist yet.

Used through [`@michi/cli`](https://www.npmjs.com/package/@michi/cli)
(`michi agents`, `michi install`).

MIT licensed. See the [project README](https://github.com/Acrto3Hil3/Michi#readme).
