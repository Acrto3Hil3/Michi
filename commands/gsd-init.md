---
description: Set up phaseforge in this project — scaffolds the docs structure and project constitution
---

Bootstrap phaseforge for this project. Target: `$ARGUMENTS` (a short project
description, if given — otherwise infer it from the repo).

## 1. Look before you scaffold

Check what already exists. Do not overwrite anything.

- `CLAUDE.md` / `AGENTS.md` — is there already an agent entry point?
- `docs/` — does it exist, and what's in it?
- `README.md`, `package.json`, or equivalent — what *is* this project?
- The actual source layout — languages, frameworks, where code lives.

If a file below already exists, leave it alone and note it. Add to it only with
the user's agreement.

## 2. Create what's missing

```
docs/
├── PROGRESS.md                  ← from templates/PROGRESS.md
├── ENGINEERING-CONSTITUTION.md  ← from templates/ENGINEERING-CONSTITUTION.md
├── RALPH-LOOP.md                ← from templates/RALPH-LOOP.md
├── phases/
│   └── TEMPLATE.md              ← from templates/phases/TEMPLATE.md
└── architecture/
    ├── SYSTEM.md                ← from templates/architecture/
    ├── DOMAIN.md
    ├── DATA.md
    └── DECISIONS.md
```

Fill the templates with **this project's real details**, not placeholders. If you
don't know something, write `_Not yet established_` rather than inventing it.

## 3. Write or extend the agent entry point

If `CLAUDE.md` doesn't exist, create a short one (keep it short — it's read every
session):

- What this project is, in three lines
- The stack and where code lives
- A pointer to `docs/ENGINEERING-CONSTITUTION.md`
- A pointer to `docs/PROGRESS.md` for current state
- The `/gsd-*` workflow, listed

If it already exists, propose an addition rather than rewriting it.

## 4. Seed PROGRESS.md honestly

Record what's **actually** true today, not aspirational:

- Which parts of the project are built and verified
- Which are built but unverified
- Which are stubs, mocks, or not started
- Any known follow-ups or debt you can already see

If this is an existing codebase, spend a little time actually reading it before
filling this in. A wrong PROGRESS.md is worse than an empty one — it gets trusted.

## 5. Report

Tell the user what you created, what you left alone, and what you couldn't
determine and need from them. Then stop — don't start a phase in the same run.
