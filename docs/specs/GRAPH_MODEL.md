# GRAPH_MODEL

Derived from `MICHI.md` §34, §35, §62, §68, §91, §99.

## Why there is a graph

Three questions justify it, and nothing else does:

1. **Context selection.** Given a task, what is near it? (`CONTEXT_MODEL.md`)
2. **Impact analysis.** If we change this decision, what breaks?
   (`DECISION_MODEL.md`)
3. **Traceability.** Why does this code exist, and which requirement does it
   satisfy? (§99)

If a proposed graph feature does not serve one of those, it does not belong
(P4). The graph is infrastructure for three answers, not a product surface.

## Not a graph database

No Neo4j, no embedded graph engine, no vector index (§34, §68). Two JSON files
and an in-memory index built on load.

This is sufficient because the graphs are small — a large project might reach
tens of thousands of nodes, which loads in milliseconds and fits comfortably in
memory — and because the alternative costs a server, a schema migration path,
and a dependency that makes `.michi/` unreadable with `cat`.

## Node types

```text
REQUIREMENT   REQ-021        a thing the product must do
FEATURE       FEAT-inventory a user-visible capability
USE_CASE      UC-adjust      a concrete flow through a feature
DOMAIN        DOM-inventory  a bounded area of the product
DECISION      D004           an approved engineering or product choice
                             (the object; its ADR is documentation, not a node)
COMPONENT     CMP-inventory  a module in the architecture
ENTITY        ENT-product    a thing in the data model
API           API-stock-adj  an interface boundary
FILE          src/…/stock.ts a source file
SYMBOL        stock.ts#adjust a function, class or type
TEST          TEST-stock     a test file or case
TASK          TASK-034       a unit of planned work
MILESTONE     MS-inv-mvp     a group of tasks
ACCEPTANCE    AC-001         an acceptance criterion
```

`FILE` and `SYMBOL` nodes come from the scanner and are regenerated on every
scan. Everything else comes from MICHI's own artifacts and is durable.

## Edge types

Directed and typed. The type carries the meaning, so a traversal can ask for
"only the edges that imply a rebuild".

```text
IMPLEMENTS      FILE      → REQUIREMENT      this code exists because of that requirement
SATISFIES       TEST      → ACCEPTANCE       this test proves that criterion
GOVERNS         DECISION  → COMPONENT        that component is built this way because of this decision
CONSTRAINS      DECISION  → DECISION         a later choice was limited by an earlier one
BELONGS_TO      FILE      → COMPONENT        structural containment
OWNS            COMPONENT → ENTITY           only this component writes that data
EXPOSES         COMPONENT → API              this boundary is published here
CALLS           SYMBOL    → SYMBOL           static call relationship
IMPORTS         FILE      → FILE             module dependency
DEPENDS_ON      TASK      → TASK             ordering in the DAG
TARGETS         TASK      → FILE             this task is expected to change that file
DERIVES_FROM    REQUIREMENT → USE_CASE       provenance
PART_OF         USE_CASE  → FEATURE          composition
SUPERSEDES      DECISION  → DECISION         replacement history
```

An edge may carry `since` (the task or decision that created it) and
`confidence` — `CERTAIN` for edges derived from artifacts or the AST,
`INFERRED` for edges guessed from naming or proximity. Inferred edges are
usable for ranking and never for impact analysis: telling a user that changing
a decision breaks nine things, when three of them were guesses, is a P9
violation.

## What Phase 5 built

The node and edge types above were written in Phase 0, before Phases 3 and 4
existed. Phase 5 implements the subset that has a canonical source **today**,
and states the differences rather than quietly diverging.

### Nodes implemented

```text
REQUIREMENT  REQ-001   requirements/requirements.yaml
DECISION     D001      decisions/index.yaml
USE_CASE     UC-001    requirements/specification.yaml
ACCEPTANCE   AC-001    requirements/specification.yaml
PERSONA      PER-001   requirements/specification.yaml   ← not in the list above
FILE         path      project/map.json
```

`PERSONA` was missing because Phase 0 predates the product specification.

**Not implemented:** `COMPONENT`, `ENTITY`, `API`, `SYMBOL`, `TASK`,
`MILESTONE`, `FEATURE`, `DOMAIN`, `TEST`. Nothing in `.michi/` produces them
yet. A node type with no source is a claim the project cannot support, so they
wait for the phases that create them.

### Edges implemented

Each is backed by one field. An edge with no field behind it is an invention.

```text
GOVERNS       DECISION   → REQUIREMENT   decision.affects_requirements
VERIFIES      ACCEPTANCE → REQUIREMENT   criterion.requirement
SERVES        USE_CASE   → REQUIREMENT   use_case.requirements
PERFORMED_BY  USE_CASE   → PERSONA       use_case.persona
SUPERSEDES    DECISION   → DECISION      decision.supersedes
              REQUIREMENT → REQUIREMENT  requirement.supersedes
```

`GOVERNS` is listed above as `DECISION → COMPONENT`. Components do not exist;
the edge that does exist, and that the architecture gate already depends on, is
decision → requirement. Redefined to match canonical state.

`VERIFIES` and `SERVES` are new. `PERFORMED_BY` is new. `SATISFIES`
(`TEST → ACCEPTANCE`) is not built: there are no test nodes yet.

`ADR` is **not** a node, as the list above says. The packet draws ADR text from
the decision record instead, carrying it as an item with the reason
*"documents D003"*.

### It is not persisted

`graph/nodes.json` and `graph/edges.json` are described below and are **not
written** in Phase 5. The graph is derived on every call.

That is deliberate. Persisting pays off when building the graph is expensive —
structural parsing of a large repository, which does not exist yet. Until then
a stored copy is a staleness bug waiting to happen, and rebuilding costs
nothing. The `graph/` directory stays empty, and the files arrive with the
scanner work that makes them worth having.

### Dropped references are reported, not hidden

An edge naming a node this project does not have is dropped and recorded in the
graph's `dropped` list with the field it came from. The graph never contains a
half-edge, and `michi graph` prints anything dropped.

## Storage

`graph/nodes.json`:

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-28T09:02:00Z",
  "nodes": [
    { "id": "REQ-021", "type": "REQUIREMENT", "label": "Merchant stock adjustment",
      "source": "requirements/requirements.yaml", "durable": true },
    { "id": "D004", "type": "DECISION", "label": "Authentication provider",
      "source": "decisions/index.yaml#D004", "durable": true,
      "attrs": { "status": "LOCKED", "category": "authentication" } },
    { "id": "src/modules/inventory/stock.ts", "type": "FILE",
      "label": "stock.ts", "source": "scan", "durable": false,
      "attrs": { "language": "typescript", "loc": 184 } }
  ]
}
```

`graph/edges.json`:

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-28T09:02:00Z",
  "edges": [
    { "from": "src/modules/inventory/stock.ts", "to": "REQ-021",
      "type": "IMPLEMENTS", "confidence": "CERTAIN", "since": "TASK-034" },
    { "from": "D004", "to": "CMP-auth",
      "type": "GOVERNS", "confidence": "CERTAIN" },
    { "from": "TEST-stock", "to": "AC-003",
      "type": "SATISFIES", "confidence": "CERTAIN", "since": "TASK-034" }
  ]
}
```

Both files are sorted — nodes by id, edges by `(from, type, to)` — so that a
regeneration produces a minimal, reviewable git diff rather than a reshuffle.

## Construction

Two sources, merged:

**Artifacts.** Requirements, decisions, architecture documents, tasks and
milestones produce durable nodes and `CERTAIN` edges, read directly from
`.michi/`.

**Scan.** Tree-sitter over the repository produces `FILE` and `SYMBOL` nodes and
`IMPORTS` / `CALLS` edges. Structural parsing, not regex (§35) — regex-derived
edges are wrong in ways that surface much later as a bad context selection.

The bridge between them — which file implements which requirement — cannot be
derived from either source alone. It is established when a task completes: the
task knows its requirements, the agent run reports its `files_touched`, and the
`IMPLEMENTS` edges are written then, marked `CERTAIN` and attributed to the
task. This is the only reliable way to know why a file exists, and it is why
run records matter beyond auditing.

## Rebuild semantics

```text
michi scan     rebuilds FILE and SYMBOL nodes and their edges; durable nodes untouched
michi graph    reads; never writes
state writes   incrementally update durable nodes and their edges
```

A full rebuild from artifacts plus a scan must reproduce the graph exactly,
apart from `IMPLEMENTS` edges, whose provenance lives in the run records. The
graph is therefore a cache with one authoritative input it cannot re-derive —
and that exception is documented here precisely because it is the kind of thing
that quietly rots otherwise.

## Queries the engine must support

Small, explicit, tested. Not a query language.

| Query | Used by |
|---|---|
| `neighbors(id, edgeTypes?, direction?)` | context ranking |
| `withinHops(id, n, edgeTypes?)` | context candidate collection |
| `pathsBetween(a, b, maxHops)` | traceability — "why does this code exist?" |
| `impactOf(decisionId)` | decision change analysis |
| `implementers(requirementId)` | coverage — "is this actually built?" |
| `coverage(acceptanceId)` | verification — "does a test prove this?" |
| `orphans(type)` | hygiene — requirements with no code, code with no requirement |
| `cycles(edgeType)` | catching circular task dependencies before planning ships them |

`impactOf` is the one with teeth. It walks `GOVERNS`, `CONSTRAINS`,
`BELONGS_TO`, `OWNS` and `IMPLEMENTS`, follows `CERTAIN` edges only, and returns
results grouped by node type so the change can be explained as consequences
rather than as a node dump.

## Output

Textual by default (§62):

```text
$ michi graph REQ-021

REQ-021  Merchant stock adjustment
├── implemented by
│   ├── src/modules/inventory/stock.ts
│   └── src/modules/inventory/adjust.ts
├── governed by
│   ├── D003  PostgreSQL
│   ├── D007  REST API
│   └── D009  Role-based access control
├── verified by
│   ├── TEST-stock  → AC-001, AC-002, AC-003
│   └── TEST-authz  → AC-004
└── built by
    └── TASK-034  (DONE, verified 2026-09-28)
```

`--format mermaid` emits a diagram. `--format json` emits the subgraph for
tooling. No graphical application is required, and none should be built for v1
(§117).

## Hygiene

The graph makes certain problems visible, and surfacing them is most of its
day-to-day value:

- a requirement with no implementing file — specified, never built
- an acceptance criterion with no satisfying test — claimed, never proved
- a file implementing nothing — scope creep, or a missing requirement
- a locked decision governing nothing — possibly obsolete
- a cycle in `DEPENDS_ON` — a plan that cannot be executed in any order

`michi status` reports counts of these. They are warnings, not errors: a young
project is legitimately full of them, and a tool that nags about that on day one
is a tool people stop reading.
