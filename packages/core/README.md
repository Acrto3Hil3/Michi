# @subhashyadav98146/michi-core

MICHI's engines, schemas and project-state layer.

Ordinary software: deterministic, offline, and model-free. It makes no network
calls and asks no model anything. The same inputs produce the same bytes, so
two reads never disagree.

It is the layer underneath [`@subhashyadav98146/michi-senior-dev`](https://www.npmjs.com/package/@subhashyadav98146/michi-senior-dev).
Most people want that package, not this one.

```ts
import { init, status, resolveContext } from "@subhashyadav98146/michi-core";

const started = init({ root: process.cwd(), now: () => new Date().toISOString() });
if (!started.ok) console.error(started.error.message);
```

Every engine takes an explicit input, returns `Result<T>` with typed errors,
and takes its clock as a parameter — so nothing fabricates a timestamp.

The only thing Core executes in your project is a verification command you
listed yourself under `verification.allow`. It never edits source code, not
even to fix a failing check.

MIT licensed. See the [project README](https://github.com/Acrto3Hil3/Michi#readme).
