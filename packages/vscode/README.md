<div align="center">
  <img src="https://raw.githubusercontent.com/Acrto3Hil3/Michi/main/assets/michi-logo-512.png" alt="MICHI" width="180" />
</div>

# MICHI for VS Code

**Your coding agent writes the code. MICHI makes sure it's building the right thing.**

Install this, open a project, and MICHI offers to connect itself to whichever
AI coding agent you already use — Claude Code, Copilot, Cursor, Cline,
Continue, Codex, or any other. It writes that agent's own instruction files so
the agent knows how to work with the project's requirements and decisions.

It asks before writing anything, and shows you the exact file list first.

## What you get

- **A status bar item** — what stage the project is at, and how many things
  need you. Click it to see them.
- **MICHI: Set up in this project** — creates `.michi/`, then connects your agent.
- **MICHI: Connect a coding agent** — detects what's in your project, lists
  every option, and lets you choose. Detection proposes; you decide.
- **MICHI: Explain this decision or requirement** — what you agreed and why,
  in plain language, opened as a document.

## You need the CLI

This extension drives the `michi` command. Install it once:

```bash
npm install -g @subhashyadav98146/michi-cli
```

If it isn't on your PATH, set `michi.path` in settings.

## What it will not do

- **Write anything without asking.** Every file is behind an explicit yes, and
  "Never for this project" is remembered.
- **Decide for you.** A requirement isn't confirmed and a decision isn't locked
  until you say so by name — enforced in MICHI itself, not here.
- **Reimplement MICHI.** This is a thin client: it runs the CLI and shows what
  came back. Nothing about your project is interpreted twice.
- **Phone home.** No telemetry, no network calls, no account.

MIT licensed · [Source and full docs](https://github.com/Acrto3Hil3/Michi)
