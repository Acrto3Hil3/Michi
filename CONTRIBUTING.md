# Contributing to MICHI

## What MICHI is, so a change can be judged

MICHI is the engineering layer between a person with an idea and the AI coding
agent they already use. It has three layers, and the boundaries between them
are the architecture:

```text
Experience Layer   skills running inside the user's own agent — conversation
MICHI Core         ordinary software: deterministic, offline, model-free
Project State      .michi/, plain text, readable without MICHI
```

Before changing anything, read [`docs/specs/`](docs/specs/) — eleven contracts
derived from [`MICHI.md`](MICHI.md), which is the source of truth. If a change
contradicts a contract, the contract is the thing to argue with first.

## The rules that will get a change rejected

- **No LLM, no AI API, no network call, no model call in Core.** Not behind a
  flag, not optionally.
- **No database, no web service, no editor integration, no hosted anything.**
- **MICHI never writes application code**, and never edits code to make a check
  pass.
- **Nothing becomes confirmed, locked or verified on the user's behalf.** That
  is enforced in the schemas, and a bypass is not a feature.
- **No agent's name outside `packages/adapters/src`.** A test greps for this.
- **Nothing is deleted.** Superseded things are marked; `.michi/` keeps its
  history.
- **No fake certainty.** Unknown stays unknown, estimates are labelled with
  their method, and a claim is never recorded as an observation.

## How to work

Test-first, in this order: a failing test that states the behaviour, then the
smallest change that passes it, then tidying. A behavioural change without a
test that would have caught its absence is not finished.

```bash
pnpm install
pnpm verify           # typecheck + 655 tests + spec consistency
pnpm release:check    # pack, inspect, install into a clean project, drive the
                      # whole loop from the installed binary. Publishes nothing.
```

`pnpm check:specs` runs `tools/check-phase0.py` — a stdlib-only checker holding
~120 invariants across the contracts and the code. When you settle something
the contracts leave open, add the invariant that stops it being quietly undone.

## Adding support for another coding agent

One entry in `packages/adapters/src/adapters.ts` and one row in
[`AGENT_ADAPTER_MODEL.md`](docs/specs/AGENT_ADAPTER_MODEL.md). That is the whole
surface. If it needs anything in `core` or `cli`, the boundary has leaked and
the fix belongs in `adapters`.

Declare `runs_commands: null` rather than guessing. Unknown is not false.

## Releasing

Everything moves together: four npm packages and the editor extension share
one version. The extension carries a copy of the CLI inside it — that is what
makes "install the extension and start" true — so a release that updates npm
alone leaves every extension user on the old MICHI with nothing telling them.

```bash
pnpm version:set 0.3.0     # five manifests and identity.ts, in one place
# then write the CHANGELOG entry
pnpm release               # npm, then both editor registries
```

`pnpm release` refuses before doing anything slow if the versions disagree, if
npm is not logged in, or if either extension token is missing. It publishes
npm first because that half can be resumed if 2FA times out, then the
extension, then asks every registry whether it is actually serving the new
version — a successful upload only proves the upload worked.

Users get it from there on their own: npm installs are explicit, and editors
update extensions themselves, with the CLI travelling inside.

> **An npm organisation is created on the website**, at
> <https://www.npmjs.com/org/create>. There is no `npm org create` — the CLI's
> `npm org` only manages members of an org that already exists.

> **Never run `npm publish` here**, or `vsce publish` by hand. These packages
> depend on each other with pnpm's `workspace:*` protocol, which is correct
> for development and meaningless to a registry: `pnpm publish` rewrites it to
> the real version, `npm publish` ships it verbatim and the published package
> then fails to install with `EUNSUPPORTEDPROTOCOL`. That is exactly how
> `michi-adapters@0.1.0` was broken, and published versions are immutable.
>
> The scripts exist because each hand-run has cost a real mistake: that
> dependency, a package name derived from a folder that had since been
> renamed, and a vsix with no CLI inside it.

Publishing is a deliberate, separate act, never a side effect of a green
build — CI runs the release check and has no publish step.

Until 1.0.0 the `.michi/` state format may change between minor versions. It
carries a `schema_version` and MICHI refuses state it does not understand
rather than guessing at it, so a format change needs a note in the changelog.

MIT licensed. By contributing you agree your work ships under that licence.
