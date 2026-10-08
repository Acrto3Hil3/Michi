# @michi/skills

MICHI's skills — the Experience Layer.

Seven Markdown files, each one instructions for *your* coding agent rather than
for MICHI: how to hold a discovery conversation, how to put a technical choice
to someone who does not read code, how to review, test, debug and verify.

| Skill | For |
|---|---|
| `senior-engineer` | discovery, and the questions a senior engineer would ask |
| `product-planner` | what actually ships first, and what "later" means |
| `architecture` | the technical choices, in money and risk |
| `implementer` | the brief for one piece of work |
| `reviewer` | judging an implementation against what was agreed |
| `tester` | proving it works, with evidence rather than assurances |
| `debugger` | reproduce, root cause, fix, verify — in that order |

They contain no application code and no model calls. The judgement happens in
your agent; MICHI's enforcement happens in `@michi/core`.

Installed into your project in your agent's own format by `michi install`.

MIT licensed. See the [project README](https://github.com/Acrto3Hil3/Michi#readme).
