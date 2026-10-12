# Changelog

## 0.2.0 — 2026-10-12

The first release.

### Added

- **Install it and start.** MICHI is bundled inside the extension and runs on
  the Node your editor already has. Nothing to install first, nothing to put
  on your PATH, no configuration. If you already run MICHI from a terminal,
  that copy wins — the extension will not quietly swap your version.
- **MICHI: Set up in this project** — creates `.michi/`, then offers to
  connect whichever coding agent is already there. It shows the exact file
  list before writing anything, and remembers "never for this project".
- **MICHI: Connect a coding agent** — detects what is in the project and lists
  every option. Detection proposes; you decide.
- **MICHI: Explain this decision or requirement** — what you agreed and why,
  in plain language, opened as a document. If the record does not contain the
  answer it says so rather than inventing one.
- **Status bar** — the project's stage and how many things need you. Click it
  for the list.
- Works with Claude Code, Cursor, Copilot, Codex, Cline, Continue, Windsurf,
  Gemini CLI, Antigravity, Zed, JetBrains Junie, AWS Kiro and Trae — and
  through `AGENTS.md`, with any agent at all.
- Tells you when a MICHI you installed yourself is older than the commands
  this extension calls. Once per version, not once per session.
