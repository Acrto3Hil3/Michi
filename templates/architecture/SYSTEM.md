# System Architecture

> Keep this short enough to read in one pass. A doc nobody reads is a doc nobody
> updates.

## What this system is

Three lines. What it does, for whom, and the one thing it must never get wrong.

## Stack

| Layer | Technology | Lives in |
|---|---|---|
| Frontend | | |
| API | | |
| Data | | |
| Shared | | |

## Layers and dependency direction

```
UI → API → Services → Database
```

Allowed: each layer depends only on the one below it.
**Not allowed:** UI reaching the database directly; UI as the authority on a
business rule; a service reaching into another service's tables.

## Module boundaries

Which modules exist, and what each one owns. A module owns its tables — other
modules ask it, they don't query around it.

## Transaction boundaries

Where multi-step writes must land atomically, and why.

## Known architecture exceptions

Places where the rules above are deliberately broken, and the reason. Being
honest here is more useful than pretending the diagram is reality.
