# Data Ownership & Source of Truth

> The highest-value page in this folder. Most expensive bugs in an AI-assisted
> codebase come from two places both claiming to own the same fact.

## Source of truth, per value

| Value | Authoritative or derived? | Where / how |
|---|---|---|
| _example: order.total_ | authoritative | set at creation, never recalculated |
| _example: order.paid_ | cached | recomputed from SUM(payments) on every write, never incremented |
| _example: invoice.status_ | derived | computed at read time from paid vs total vs dueDate |

Rules:
- Anything **derived** must never be written to directly.
- Anything **cached** must document how and when it's recomputed.
- Two rows in this table must never describe the same fact.

## Invariants the database enforces

Which constraints protect which business rule — so nobody "simplifies" one away.

| Constraint | Protects |
|---|---|
| _example: check(exactly one of order_id / credit_id)_ | _a payment can never be attributed twice_ |

## Event history vs. mutable state

Which tables are append-only history (never updated or deleted) and which hold
current state. Mixing these up silently destroys audit trails.
