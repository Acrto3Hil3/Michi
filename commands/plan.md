---
description: Break the build into phases you can complete one at a time
---

Scope: `$ARGUMENTS` (a phase name, or the whole product for the first run)

Read `docs/PRD.md`, `docs/TRD.md`, and `docs/PROGRESS.md`. If the PRD or TRD
doesn't exist, run those first — planning without them means inventing
requirements as you go.

## Two levels of planning

**First run** — carve the whole product into phases and write `docs/ROADMAP.md`:

- Each phase is a coherent chunk that leaves the product **working**, not
  half-built. "Users can sign up and log in" is a phase. "Half the database" is not.
- Order them by dependency, not excitement. Data model before screens. Auth before
  anything user-specific.
- Aim for phases that take days, not weeks. Small phases fail cheaply.
- Say which phase makes it **usable by a real person** — that's the milestone that
  matters, and it's usually earlier than they expect.

**Per-phase run** — write the detailed plan into `docs/phases/<phase>.md`:

- Exact files to create or change, in dependency order
- Each step small enough to finish and verify in one sitting
- The data changes it needs, and what existing data it affects
- What could break elsewhere (the blast radius)
- How you'll know each step worked — concrete and checkable

## Before you call the plan done

Check it against these, because fixing a plan is far cheaper than fixing code:

- **Architecture** — right layer, right order, per the TRD
- **Data** — does anything here create a second source of truth?
- **Permissions** — is every new action gated to the right people?
- **Money** — if value moves, is it recorded once, in a transaction?
- **Regression** — what already works that this could break?

## Then say what's next

Show them the phase list in plain language with a rough sense of size:

> "Six phases. The first three get you something you can show people —
> roughly two weeks. Run `/build` to start on phase one."
