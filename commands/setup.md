---
description: Set up the engineering team in this project
---

Project context: `$ARGUMENTS` (a short description, if given)

## 1. Work out what this is

- Is there existing code, or is this empty?
- If code exists: what language, framework, and layout? What's already built?
- Is there a `README`, `package.json`, or equivalent that explains the intent?
- Does `CLAUDE.md` / `AGENTS.md` already exist?

Never overwrite anything that already exists. Add, or propose — don't replace.

## 2. Create what's missing

```
AGENTS.md                            ← works with any AI agent
CLAUDE.md                            ← if they use Claude Code
docs/
├── ENGINEERING-CONSTITUTION.md      ← the rules this project follows
├── PROGRESS.md                      ← honest state: built vs. verified
├── phases/TEMPLATE.md
└── architecture/{SYSTEM,DOMAIN,DATA,DECISIONS}.md
```

Fill them with **this project's real details**. Where you genuinely don't know
something, write `_Not yet established_` rather than inventing it — a confident
wrong answer in these files gets trusted by every later session.

## 3. Be honest in PROGRESS.md

If there's existing code, read enough of it to record what's genuinely built,
what's built but unverified, and what's a stub. An inaccurate PROGRESS.md is
worse than an empty one.

## 4. Point them at the right starting place

**Brand new idea, nothing built yet:**
> "You're set up. Start with `/idea` — just describe what you want to build in
> your own words, and I'll take it from there."

**Existing project:**
> "You're set up. I've recorded what's already built in `docs/PROGRESS.md` —
> have a look and correct me if I got anything wrong. Then `/refine` any change
> you want to make, and I'll turn it into a proper brief."

Then stop. Don't start a phase in the same run.
