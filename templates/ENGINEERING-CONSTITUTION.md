# Engineering Constitution

> Installed by [phaseforge](https://github.com/Acrto3Hil3/phaseforge). Edit it —
> this is *your* project's constitution, not a vendor's. Delete rules that don't
> apply, add ones that do. What matters is that it's written down and followed.

This document governs how this project is designed, built, reviewed, and
maintained. It applies to every non-trivial change, by anyone — human or agent.

---

## 1. The decision hierarchy

When two concerns conflict, this order decides. Top wins.

```
1.  An explicit decision the project owner already made
2.  Business correctness
3.  Security & authorization
4.  Data & financial integrity
5.  Existing locked architecture
6.  API contracts
7.  Backend implementation
8.  Frontend implementation
9.  Performance
10. UX convenience
11. Implementation convenience
```

Never invert this for convenience. "It's easier on the frontend" does not beat
"the backend rule is required."

---

## 2. Non-negotiables

**Schema is law.** The data model is the source of truth. Add to the schema
first, migrate, then write code against it. Never invent a column inline. Never
rewrite an applied migration.

**Authorization is server-side, always.** A hidden button is not a permission
boundary. Every mutating endpoint is gated on the server. Frontend permission
checks exist for UX only.

**Contract-first.** Document an endpoint in the same change that implements it.
No undocumented production endpoints.

**One source of truth per value.** Before adding a field, ask whether the value
already exists. If it does — reuse it, derive from it, or justify the copy
explicitly and document how it stays in sync.

**Prefer derived over stored.** `authoritative data → derived result` beats
`authoritative data → duplicated stored flag`, unless there's a measured reason.
If you denormalize, document the reason, the update path, and the recovery path.

**No fabricated data.** Never invent a figure, event, or record with nothing real
behind it. If a number can't be derived honestly, drop the feature and say why.

**No silent dependencies.** Name the package and the reason before adding it.

**Ambiguity → ask or narrow.** Genuinely consequential ambiguity gets a focused
question. Low-risk ambiguity gets the narrowest interpretation consistent with
this document — and the assumption gets written down.

---

## 3. Financial rules

_Delete this section if the project doesn't handle money._

- One ledger. Money movement is recorded in one place, never two.
- Balances are derived from real records, never hand-adjusted to make a screen
  look right.
- Multi-step financial writes happen in a transaction — all or nothing.
- Every financial write records who did it and when.
- Retried requests must not double-charge. Idempotency is required wherever a
  duplicate would cost real money.

---

## 4. State machines

Every lifecycle (orders, tickets, approvals, jobs) defines: states, allowed
transitions, who may perform each, preconditions, side effects, and what gets
recorded. No unrestricted mutation where a real transition is required.

---

## 5. Legacy and migration

If this system is replacing an existing manual or legacy process, legacy data is
a first-class concern, not an edge case.

- Preserve original references, identifiers, and amounts rather than forcing old
  records into a tidy new shape.
- Every import defines: matching key, duplicate behaviour, rejected-record
  handling, and whether re-running it is safe.
- Never fabricate a record to satisfy a foreign key.

---

## 6. Verification policy

_Adjust to your project. This is the default phaseforge ships with._

Automated tests are **not** required by default — but verification always is.
Every non-trivial change gets:

- Build and typecheck (confirm the command actually checks what you think)
- The real endpoint called, as more than one role
- The real screen clicked, including empty and error states
- The database queried directly to confirm the result
- A regression check against the blast radius
- Test data cleaned up, and confirmed gone

Document what you actually verified. Never claim automated tests exist when they
don't.

---

## 7. Deferred debt

Debt may be deferred. It may not be forgotten. Every deferred item records:

| Field | |
|---|---|
| Problem | what's wrong |
| Severity | low / medium / high |
| Reason deferred | why not now |
| Revisit trigger | the condition that means it's time |
| Affected modules | blast radius when it is addressed |

These live in `docs/PROGRESS.md`, not in someone's memory.

---

## 8. Phase boundaries

One unit of work at a time. A discovered improvement mid-phase becomes a Known
Follow-up, not a wider phase — unless the current work is genuinely incorrect
without it.

---

## 9. Production readiness

Never call a module production-ready based on functional completion alone.
Readiness has separate dimensions: correctness, data integrity, security,
verification, performance, observability, deployment, backup/recovery, and
operations. A project can be functionally complete while its infrastructure is
still development-only — say so plainly rather than implying otherwise.

---

## 10. Improve forward

This document is not a mandate to rewrite working code. Existing approved
behaviour stays authoritative until explicitly changed. Improve the next change;
don't relitigate the last one.

---

## Amendments

| Date | Change | Reason |
|---|---|---|
| _(init)_ | Adopted phaseforge default constitution | Project start |
