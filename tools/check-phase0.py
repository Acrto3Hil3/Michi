#!/usr/bin/env python3
"""Phase 0 consistency check.

Verifies that the contracts in docs/specs/ agree with each other and with the
decisions locked in docs/specs/README.md. Documentation only — it reads
Markdown and asserts invariants. No dependencies beyond the standard library.

    python3 tools/check-phase0.py

Exit 0 and "PHASE 0 CONTRACTS CONSISTENT" when everything holds.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "docs" / "specs"

files = sorted(SPECS.glob("*.md")) + [ROOT / "README.md", ROOT / "CLAUDE.md"]
text = {f: f.read_text() for f in files}
spec = lambda n: text[SPECS / n]
fails = []


def says(haystack, phrase):
    """Substring match that ignores how the prose happens to be wrapped.

    Markdown and shell comments reflow whenever a sentence is edited, so a
    literal phrase that spans a line break silently stops matching. Collapsing
    whitespace (and leading comment markers) on both sides makes these checks
    depend on what the text says rather than on where the lines happen to end.
    """
    flat = lambda t: " ".join(t.replace("\n#", " ").replace("\n", " ").split())
    return flat(phrase) in flat(haystack)


def check(name, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + name)
    if not ok:
        fails.append(name)
        if detail:
            print(f"          {detail}")


def near(t, match, window=2):
    """The lines around a match — qualifying clauses often wrap."""
    lines = t.splitlines()
    n = t[:match.start()].count("\n")
    return "\n".join(lines[max(0, n - window):n + window + 1])


def unqualified(pattern, qualifiers):
    """Occurrences of `pattern` with no qualifying word nearby."""
    out = []
    for f, t in text.items():
        for m in re.finditer(pattern, t):
            if not re.search(qualifiers, near(t, m), re.I):
                out.append(f"{f.relative_to(ROOT)}:{t[:m.start()].count(chr(10)) + 1}")
    return out


print("PHASE 0 CONSISTENCY CHECK\n")

# --- OQ-001  project-state directory is .michi/ ---------------------------
check("OQ-001  .senior-engineer/ appears only as forbidden legacy",
      not (bad := unqualified(r"\.senior-engineer",
                              r"legacy|must not|never used|forbidden")),
      "; ".join(bad))
check("OQ-001  .michi/ is the project-state directory everywhere",
      all(".michi/" in spec(n) for n in
          ["STATE_MODEL.md", "ARCHITECTURE.md", "SECURITY_MODEL.md",
           "AGENT_ADAPTER_MODEL.md"]))

# --- OQ-003  Decision object vs ADR document ------------------------------
dm = spec("DECISION_MODEL.md")
check("OQ-003  no contract claims D-ids and ADR-ids are one identifier",
      not (bad := [str(f.relative_to(ROOT)) for f, t in text.items()
                   if re.search(r"numbers are always equal|one canonical id", t)]),
      "; ".join(bad))
check("OQ-003  DECISION_MODEL separates the object from the document",
      "not competing identifiers" in dm and "decision registry" in dm.lower())
check("OQ-003  the registry carries the structured decision fields",
      all(k in dm for k in ["selected_option", "rationale", "supersedes",
                            "superseded_by", "adr_file", "created_at",
                            "approval"]))
check("OQ-003  an ADR cannot carry duplicated state",
      "not** repeated here" in dm or "not repeated here" in dm)

# --- OQ-004  the three layers ---------------------------------------------
arch = spec("ARCHITECTURE.md")
cli = spec("CLI_CONTRACT.md")
check("OQ-004  ARCHITECTURE documents the three layers",
      "## The three layers" in arch
      and all(k in arch for k in ["EXPERIENCE LAYER", "MICHI CORE", "PROJECT STATE"]))
check("OQ-004  the coding agent is declared external to MICHI",
      "not part of MICHI" in arch)
check("OQ-004  Core is stated to contain no model call",
      re.search(r"no model call", arch, re.I) is not None)
check("OQ-004  no bare conversational `michi discover` form",
      not re.search(r"^michi discover\s*(\[--json\])?\s*$", cli, re.M))
check("OQ-004  discover exposes structured subcommands",
      all(f"michi discover {c}" in cli
          for c in ["start", "status", "answer", "export", "close"]))
check("OQ-004  skills are identified as the Experience Layer",
      "Experience Layer" in spec("SKILL_CONTRACT.md"))

# --- OQ-005  token counts are labelled estimates --------------------------
cm = spec("CONTEXT_MODEL.md")
check("OQ-005  estimate and method are stated together",
      "Estimation method" in cm and "chars/4" in cm)
check("OQ-005  the packet records its estimation method",
      "estimation_method: chars/4" in cm)
check("OQ-005  a tokenizer is explicitly not a v1 dependency",
      re.search(r"not\*?\*? a\s+dependency in v1", cm) is not None)
check("OQ-005  no bare exact-looking token counts",
      not (bad := unqualified(r"(?<![~kK.])\b\d{1,3},\d{3} tokens\b",
                              r"Not `|estimate|budget")),
      "; ".join(bad))

# --- v1 non-goals ---------------------------------------------------------
check("non-goals  MICHI's own storage is text files, not a database",
      "No database" in arch and "no database" in arch.lower()
      and "Markdown for anything a human reads" in arch)
check("non-goals  no vector store or embeddings anywhere",
      not (bad := [str(f.relative_to(ROOT)) for f, t in text.items()
                   if re.search(r"\b(pinecone|weaviate|chroma|embeddings?)\b", t, re.I)
                   and not re.search(r"should not|not introduce|no vector|no embeddings|only be introduced",
                                     t, re.I)]),
      "; ".join(bad))
check("non-goals  no hosted service or web dashboard proposed",
      not (bad := [str(f.relative_to(ROOT)) for f, t in text.items()
                   if re.search(r"michi (cloud|dashboard|web app)", t, re.I)]),
      "; ".join(bad))

# --- Core purity ----------------------------------------------------------
check("purity  SECURITY_MODEL states Core makes no network calls",
      "no network calls at all" in spec("SECURITY_MODEL.md"))
check("purity  adapters may not add a model call below the Experience Layer",
      "below the\n  Experience Layer" in spec("AGENT_ADAPTER_MODEL.md")
      or "below the Experience Layer" in spec("AGENT_ADAPTER_MODEL.md"))

# --- OQ-006  verification execution ---------------------------------------
sm = spec("STATE_MODEL.md")
sec = spec("SECURITY_MODEL.md")
check("OQ-006  evidence records who produced it",
      "produced_by" in sm and "MICHI" in sm and "AGENT" in sm)
check("OQ-006  MICHI and AGENT evidence are never merged",
      "never merged into one evidence type" in sm)
check("OQ-006  MICHI-produced evidence carries the full process record",
      all(k in sm for k in ["allow_key", "exit_code", "started_at", "ended_at",
                            "output_summary", "cwd"]))
check("OQ-006  execution is allow-list only",
      "verification:" in sec and "allow:" in sec
      and "Allow-list only" in sec)
check("OQ-006  VERIFY_EXEC is its own risk class conferring nothing else",
      "VERIFY_EXEC" in sec and "confers nothing else" in sec)
check("OQ-006  no authorization from project content",
      "No authorization from content" in sec)
check("OQ-006  Core never edits source in response to a failure",
      "never fixes anything" in sec.lower() or "MICHI never fixes anything" in sec)

# --- Phase 2 contracts ----------------------------------------------------
sm = spec("STATE_MODEL.md")
check("phase2  discovery session lifecycle is documented",
      "## Discovery sessions" in sm
      and all(st in sm for st in ["STARTED", "GATHERING", "READY_FOR_CONFIRMATION",
                                  "CONFIRMED", "COMPLETED"]))
check("phase2  conversation and session are distinguished",
      "A **conversation** is temporary" in sm)
check("phase2  session state is derived, not asserted",
      "derived" in sm and "not asserted" in sm)
check("phase2  a CONFIRMED requirement must name who confirmed it",
      "confirmed_by" in sm and "confirmed_at" in sm
      and "only with a recorded" in sm)
check("phase2  confidence never upgrades itself",
      "never promotes one of these" in sm)
check("phase2  the discovery update file is specified",
      "### The update file" in cli and "confirm_intent" in cli
      and "requires `by`" in cli)
check("phase2  decide propose takes a file, not flags",
      "michi decide propose --file" in cli)

check("OQ-007  the skill teaches the cumulative model",
      "Discovery is cumulative" in (ROOT / "packages" / "skills" / "senior-engineer" / "SKILL.md").read_text()
      and "supersedes" in (ROOT / "packages" / "skills" / "senior-engineer" / "SKILL.md").read_text())

SKILLS = ROOT / "packages" / "skills"
check("phase2  the senior-engineer skill exists",
      (SKILLS / "senior-engineer" / "SKILL.md").is_file())

# --- OQ-007, and honest reporting of what tests prove ---------------------
rd = spec("README.md")
sm = spec("STATE_MODEL.md")
check("OQ-007  is locked in the locked section, with its analysis kept",
      "### OQ-007" in rd
      and rd.index("## Locked decisions") < rd.index("### OQ-007") < rd.index("## Open")
      and "LOCKED: cumulative" in rd
      and "Appendix — the OQ-007 analysis" in rd)
check("OQ-007  requirement ids are project-wide, not session-scoped",
      "**Project-wide.**" in rd and "project-wide" in sm.lower())
check("OQ-007  supersession is mandatory and there is no delete",
      "There is no delete" in rd or "There is no delete" in sm)
check("OQ-007  a conflicting proposal is refused, not silently accepted",
      "**Refused.**" in rd and "guard, not a judgement" in rd)
check("OQ-007  close merges rather than replaces",
      "Merges, not replaces" in sm)
check("OQ-007  carry-forward is named as unreachable rather than faked",
      "specified but deliberately not implemented" in rd
      or "**specified but deliberately not implemented**" in rd)
check("OQ-007  states all ten questions the decision must settle",
      all(q in rd for q in [
          "What does a second discovery session", "persist across sessions",
          "append to and refine", "changed* requirement",
          "supersession mandatory", "globally unique across the project",
          "open questions left behind", "conflicts with an already-confirmed",
          "immutable and auditable", "prior requirements already exist"]))
check("OQ-007  names what is deliberately not implemented",
      "What is deliberately not being done" in rd
      and "still replaces" in rd and "untested\nterritory" in rd.replace("\r", ""))
check("OQ-007  marks its recommendation as a recommendation, not a decision",
      "recommendation, not a decision" in rd)

sk = spec("SKILL_CONTRACT.md")
check("honesty  skill tests are documented as structural, not behavioural",
      "verified structurally, not behaviourally" in sk
      and "never present skill fixture tests as evidence" in sk.lower())

# --- Phase 3 contracts ----------------------------------------------------
check("phase3  the product specification is documented",
      "## The product specification" in sm
      and "specification.yaml" in sm)
check("phase3  requirements stay canonical, referenced not copied",
      "Requirements stay canonical" in sm
      and "references" in sm and "never copies" in sm)
check("phase3  the two kinds of acceptance criteria are distinguished",
      "Two kinds of acceptance criteria" in sm
      and "not a duplicate source of truth" in sm)
check("phase3  all four scope values are specified",
      all(v in sm for v in ["MVP", "FUTURE", "OUT_OF_SCOPE", "UNKNOWN"])
      and "FUTURE` is a promise, not a deletion" in sm)
check("phase3  a confirmed scope call must name the human",
      "refuses a `CONFIRMED` assignment with no `confirmed_by`" in sm)
check("phase3  dropping a requirement a locked decision needs is refused",
      "Contradictions with locked decisions" in sm and "is **refused**" in sm)
check("phase3  michi plan separates product from implementation planning",
      "michi plan status" in cli and "Product planning" in cli
      and "Implementation planning" in cli)
check("phase3  TRD is deferred to architecture rather than stubbed",
      "`TRD.md` is **not** written in Phase 3" in sm
      and "Not `TRD.md`" in spec("SKILL_CONTRACT.md"))
check("phase3  product-planner does not create requirements",
      "It does not create requirements" in spec("SKILL_CONTRACT.md"))
check("OQ-008  is locked in the locked section, with the gate kept",
      "### OQ-008" in rd
      and rd.index("## Locked decisions") < rd.index("### OQ-008") < rd.index("## Open")
      and "LOCKED: cumulative with revisions" in rd
      and "Appendix — the OQ-008 gate" in rd)
check("OQ-008  revisions are documented, with Core deriving the changes",
      "### Revising a published specification" in sm
      and "Core computes `changes`; it does not accept them" in sm
      and "A revision drops the sign-off" in sm)
check("OQ-008  revision ids are project-wide and never reused",
      "project-wide, sequential and never reused" in sm)
check("OQ-008  product artifacts are tombstoned, never deleted",
      "### Removing a product artifact" in sm
      and "never physically deleted" in sm
      and "requires `removed_by` and a reason" in sm)
check("OQ-008  REMOVED is kept distinct from FUTURE",
      "not** a\nscope value" in sm.replace("\r", "")
      and "REMOVED is not a scope value" in rd)
check("OQ-008  requirements keep their own lifecycle",
      "Requirements are **not** removed this way" in sm
      and "no third system" in sm)
check("OQ-008  the stage is readiness, not progress",
      "### The stage is readiness, not progress" in sm
      and "never how far it has ever got" in sm
      and "needs_review" in sm)
check("OQ-008  downstream artifacts are preserved, not deleted",
      "Nothing downstream is deleted" in sm
      and "not a staleness engine" in sm)
check("OQ-008  plan close is re-runnable and writes nothing on failure",
      "re-runnable**, and every publication re-runs the gates" in sm
      and "**nothing is written**" in sm)
check("OQ-008  one PRD, always current",
      "There is one `PRD.md`, always current" in sm
      and "No `PRD-v1.md`" in sm)
check("OQ-008  no document versioning was introduced",
      "no `SPEC-*`" in rd
      and not any("SPEC-001" in t for f, t in text.items() if f.name != "README.md"))
check("OQ-008  the deferred staleness question is named, not silently dropped",
      "What this does not solve" in rd
      and "do not build a staleness engine" in rd)
check("OQ-008  presents every option with its effects and what stays unchanged",
      all(o in rd for o in ["A — Re-open", "B — Versioned", "C — Cumulative",
                            "D — Cumulative with revisions"])
      and "Unchanged under every option" in rd
      and "Recommendation: **D**" in rd)
check("OQ-008  corrects the Phase 3 report rather than leaving it standing",
      "corrects the Phase 3 report" in rd)
check("phase3  the product-planner skill exists",
      (ROOT / "packages" / "skills" / "product-planner" / "SKILL.md").is_file())

# --- Phase 4 contracts ----------------------------------------------------
sk = spec("SKILL_CONTRACT.md")
check("phase4  the architecture gate is documented, and why that gate",
      "## Architecture" in sm
      and "The gate Core can actually enforce" in sm
      and "must be governed by at least one" in sm)
check("phase4  the gate is chosen over a skill-declared agenda, with the reason",
      "unverifiable" in sm and "self-reported-completeness" in sm)
check("phase4  architecture adds no state file",
      "no decision mechanics and no\nnew state file" in sm.replace("\r", "")
      and "there is no `architecture.yaml`" in sm
      and not (ROOT / "packages" / "core" / "src" / "schemas" / "architecture.ts").exists())
check("phase4  decisions must name requirements that exist",
      "### Decisions must name requirements that exist" in sm
      and "open discovery session" in sm)
check("phase4  architecture goes stale rather than being unlocked",
      "it does not get unlocked" in sm
      and "Nothing is unlocked and nothing is deleted" in sm)
check("phase4  COMPONENTS.md and DATA.md are deferred to DESIGN",
      "`COMPONENTS.md` and `DATA.md` are **not** written here" in sm
      and "Not `COMPONENTS.md` or `DATA.md`" in sk)
check("phase4  the fifteenth command is justified, not slipped in",
      "michi architecture status" in cli
      and "fifteenth command" in cli)
check("phase4  the architecture skill exists",
      (ROOT / "packages" / "skills" / "architecture" / "SKILL.md").is_file())
check("OQ-009  is locked in the locked section, with its options kept",
      "### OQ-009" in rd
      and rd.index("## Locked decisions") < rd.index("### OQ-009") < rd.index("## Open")
      and "LOCKED: per-decision review flags" in rd
      and "Appendix — the OQ-009 options" in rd)
check("OQ-009  corrects the record about what was implemented",
      "A correction to the record first" in rd
      and "It was neither" in rd)
check("OQ-009  flags decisions without unlocking them",
      "unchanged — nothing is unlocked" in rd
      and "needs_review" in spec("GRAPH_MODEL.md") + rd)
check("OQ-009  names what is still not built",
      "What is still not built" in rd and "Phase 6" in rd)

# --- Phase 5 contracts ----------------------------------------------------
gm = spec("GRAPH_MODEL.md")
check("phase6  no FILE -> REQUIREMENT edge is asserted anywhere",
      "There is no `FILE → REQUIREMENT` edge, deliberately" in gm
      and "does\nnot make it the implementation" in gm.replace("\r", "")
      and "derived through the\ntask" in gm.replace("\r", ""))
check("phase6  a reported file is marked reported, not verified",
      "reported*, not verified" in cm or "reported, not verified" in cm)
check("phase6  the stale 'tasks are a later phase' claims are gone",
      "tasks are\nPhase 6" not in cm.replace("\r", "")
      and "tasks arrive\n" not in (ROOT / "packages" / "core" / "src" / "graph" / "build.ts").read_text()
      and "does not yet know which files implement" not in
          (ROOT / "packages" / "core" / "src" / "prompt" / "compile.ts").read_text())

check("phase5  the graph states which node types it actually built",
      "## What Phase 5 built" in gm
      and "Not implemented:" in gm
      and "a claim the project cannot support" in gm)
check("phase5  PERSONA was added and GOVERNS redefined, both stated",
      "not in the list above" in gm
      and "Redefined to match canonical state" in gm)
check("phase5  the graph is deliberately not persisted, with the reason",
      "It is not persisted" in gm
      and "staleness bug waiting to happen" in gm)
check("phase5  dropped references are reported rather than hidden",
      "Dropped references are reported, not hidden" in gm)
check("phase5  the context request is structured, with a requirement focus",
      "## What Phase 5 built" in cm
      and "Structured, never prose" in cm
      and '"type": "requirement"' in cm)
check("phase5  tiering comes off the graph, with no model",
      "straight off the graph" in cm
      and "no embeddings" in cm
      and "nothing to tune" in cm)
check("phase5  ranking is deterministic and ties break on id",
      "never on traversal order" in cm)
check("phase5  a decision needing review is visible, not hidden or trusted",
      "neither\nhidden nor treated as valid" in cm.replace("\r", "")
      or "neither hidden nor treated as valid" in cm)
check("phase5  the packet id comes from content, not a counter",
      "not\na sequential number" in cm.replace("\r", "") or "not a sequential number" in cm)
check("phase5  an over-budget required set fails rather than truncating",
      "fails**\nrather than truncating" in cm.replace("\r", "")
      or "rather than truncating" in cm)
check("phase5  resolving context writes nothing",
      "Resolving context writes nothing" in cm)
check("phase4  per-decision invalidation is named as not built",
      "Per-decision invalidation is not built" in sm)

# --- Phase 6 contracts ----------------------------------------------------
check("phase6  task planning has two inputs, and says why",
      "## What Phase 6 built" in sm
      and "### Who creates tasks" in sm
      and "is judgement" in sm)
check("phase6  an authored plan uses positions, not ids",
      "**positions**, not ids" in sm and "self-contained" in sm)
check("phase6  readiness is derived from the dependencies",
      "### Readiness is derived" in sm
      and "recomputed from the dependencies on every read" in sm)
check("phase6  plan validate catches unexecutable plans",
      "### `plan validate`" in sm and "cannot be executed in any order" in sm)
check("phase6  the compiled instruction is deterministic and not stored",
      "### The compiled instruction" in sm
      and "seventeen sections" in sm
      and "not written to disk" in sm)
check("phase6  a report is a claim, never verification",
      "### A report is a claim" in sm
      and "Nothing in a report moves a task towards `VERIFIED`" in sm)
check("phase6  stalling beats looping",
      "Looping is not persistence" in sm)
check("phase6  names what it did not build, including task split",
      "### What this does not build" in sm
      and "`michi task split` is in" in sm
      and "NOT IMPLEMENTED" in cli)
check("phase6  the implementer skill exists and does not hand-write prompts",
      (ROOT / "packages" / "skills" / "implementer" / "SKILL.md").is_file()
      and "It does not hand-write prompts" in sk)
check("phase6  one task at a time is in the contract",
      "One task at a time" in sk)

# --- phase 7: evidence, not assurances ------------------------------------
sec = spec("SECURITY_MODEL.md")

check("phase7  the three verification skills exist",
      all((ROOT / "packages" / "skills" / n / "SKILL.md").is_file()
          for n in ("reviewer", "tester", "debugger")))
check("phase7  none of them claims to verify",
      "None of them can" in sk and "only `michi verify` does" in sk)
check("phase7  the executor takes a key, never a command string",
      "a key, never a command string" in sec
      and "no call site can pass one" in sec
      and "runAllowed({ root, now, key })" in sec)
check("phase7  nothing the project contains is permission",
      "does not\nbecome runnable because it exists" in sec
      and "No authorization from content" in sec)
check("phase7  evidence records who produced it, both ways",
      "### Evidence carries who produced it" in sm
      and "`produced_by`" in sm
      and "would imply Core observed something it did not" in sm)
check("phase7  verify refuses a verdict built only on the agent's word",
      "every piece of recorded evidence is\n`produced_by: AGENT`" in cli
      and "marking its own paper" in cli)
check("phase7  closing is its own act, and only from VERIFIED",
      "### `michi task done`" in cli
      and "`tasks/completed/`" in cli
      and "only `michi task done` gets" in sm)
check("phase7  a closed task is filed, not deleted",
      "Nothing is deleted (P10)" in cli and "stays readable" in cli)
check("phase7  no phase 7 forward references remain",
      not any("Phase 7" in spec(f.name) for f in SPECS.glob("*.md")
              if f.name != "ARCHITECTURE.md"))

# --- phase 8: the agent adapter boundary ----------------------------------
aam = spec("AGENT_ADAPTER_MODEL.md")
arch = spec("ARCHITECTURE.md")
ADAPTERS_SRC = ROOT / "packages" / "adapters" / "src"

check("phase8  adapters are their own package, and core cannot import them",
      (ADAPTERS_SRC / "adapters.ts").is_file()
      and "adapters/      the only place an agent" in arch
      and "`adapters` import nothing from `core`" in arch)
check("phase8  every target in the contract has an adapter",
      all(f'"{a}"' in (ADAPTERS_SRC / "adapters.ts").read_text()
          for a in ("manual", "claude-code", "cursor", "codex", "gemini-cli",
                    "copilot", "windsurf", "cline",
                    "antigravity", "zed", "junie", "kiro", "trae")))
check("phase8  an unverified convention is marked, not quietly implied",
      says(aam, "it is only in community tooling")
      and "could not confirm it against an official" in
          (ADAPTERS_SRC / "adapters.ts").read_text())
check("phase8  no agent's name appears outside packages/adapters/src",
      not [p for p in (ROOT / "packages").rglob("*.ts")
           if "node_modules" not in p.parts and "dist" not in p.parts
           and "test" not in p.parts and "adapters/src" not in p.as_posix()
           and re.search(r"\b(claude-code|cursor|codex|gemini|copilot|windsurf|cline)\b",
                         p.read_text(), re.I)])
check("phase8  the compiled instruction is not an adapter's business",
      "no method for packaging the compiled instruction" in aam
      and "renderSkill" not in aam)
check("phase8  the baseline is the guarantee, adapters the optimisation",
      "the baseline is the guarantee" in aam
      and "### `michi agents` · `michi install`" in cli
      and "sufficient on its own for any agent" in cli)
check("phase8  installing is idempotent and has no overwrite action",
      "`DELETE` or `OVERWRITE`, by construction" in aam
      and "idempotent and never overwrites" in cli)
check("phase8  unknown is not false when MICHI cannot tell",
      "runs_commands: boolean | null" in aam
      and "null = MICHI does not know" in aam)
check("phase8  an adapter may suggest a budget, never a counting method",
      "the counting method stays `chars/4`" in aam
      and "Core is never handed an agent's name" in aam)
check("phase8  adapters store no credential and never touch .michi",
      "Store a credential" in aam and "Read or write `.michi/`" in aam)
check("phase8  no phase 8 forward references remain",
      not any("Phase 8" in spec(f.name) for f in SPECS.glob("*.md")
              if f.name != "ARCHITECTURE.md"))

# --- phase 9: release readiness ------------------------------------------
import json as _json
MANIFESTS = {n: _json.loads((ROOT / "packages" / n / "package.json").read_text())
             for n in ("core", "adapters", "skills", "cli")}

check("phase9  all four packages are publishable and share one version",
      all(m.get("private") is False for m in MANIFESTS.values())
      and len({m["version"] for m in MANIFESTS.values()}) == 1)
check("phase9  the CLI's reported version matches the packages",
      f'version: "{MANIFESTS["cli"]["version"]}"'
      in (ROOT / "packages" / "core" / "src" / "identity.ts").read_text())
check("phase9  every package carries metadata a stranger needs",
      all(all(k in m for k in ("description", "license", "repository", "homepage",
                               "bugs", "keywords", "engines", "files"))
          for m in MANIFESTS.values()))
check("phase9  every package ships its own LICENSE and README",
      all((ROOT / "packages" / n / f).is_file()
          for n in MANIFESTS for f in ("LICENSE", "README.md")))
check("phase9  nothing ships sourcemaps, tests or tsconfig",
      all(not any(pat in f for f in m["files"]
                  for pat in (".map", "test", "tsconfig"))
          for m in MANIFESTS.values()))
check("phase9  only the CLI claims the binary, and it is michi",
      MANIFESTS["cli"].get("bin") == {"michi": "./dist/index.js"}
      and not any("bin" in m for n, m in MANIFESTS.items() if n != "cli"))
check("phase9  the release check proves the tarball rather than the repository",
      (ROOT / "tools" / "release-check.sh").is_file()
      and "publishes nothing" in (ROOT / "tools" / "release-check.sh").read_text().lower()
      and "release:check" in (ROOT / "package.json").read_text())
check("phase9  CI runs the release check, and installs no postinstall scripts",
      (ci := ROOT / ".github" / "workflows" / "ci.yml").is_file()
      and "--ignore-scripts" in ci.read_text()
      and "release:check" in ci.read_text())
# `npm publish` must not be *executed* here. It appears in the comments
# explaining why, and "pnpm publish" contains it as a substring, so the check
# is on the runnable lines only.
check("phase9  publishing goes through a script that cannot use npm publish",
      (pub := ROOT / "tools" / "publish.sh").is_file()
      and "pnpm publish" in (pubtext := pub.read_text())
      and not [l for l in pubtext.splitlines()
               if re.search(r"(?<!p)npm publish", l) and not l.lstrip().startswith("#")]
      and says((ROOT / "CONTRIBUTING.md").read_text(), "Never run `npm publish` here"))
check("phase9  it checks login before spending a minute on the gate",
      says(pubtext, "finding out afterwards that npm is logged out wastes it")
      and "npm whoami" in pubtext
      and says(pubtext, "the registry answers 404 rather than 401"))
check("phase9  a half-finished release resumes rather than halting",
      says(pubtext, "Resuming must skip those rather than halting on the first one")
      and "already published — skipping" in pubtext)
check("phase9  the post-publish install defeats npm's stale packument cache",
      "--prefer-online" in pubtext
      and says(pubtext, "The registry is right; the local cache is stale"))
check("phase9  a publish is verified from the registry, not from the upload",
      says(pubtext, "from the registry, into a clean directory")
      and "workspace:*) fail" in pubtext
      and says(pubtext, "a successful publish proves only that the upload worked"))
check("phase9  publishing is never a side effect of a green build",
      "npm publish" not in (ROOT / ".github" / "workflows" / "ci.yml").read_text()
      and "deliberate, separate act" in (ROOT / "CONTRIBUTING.md").read_text())
check("phase9  a changelog and contributing guide exist, and name the non-goals",
      (ROOT / "CHANGELOG.md").is_file()
      and "Deliberately not included" in (ROOT / "CHANGELOG.md").read_text()
      and "will get a change rejected" in (ROOT / "CONTRIBUTING.md").read_text())
check("phase9  the README tells a new user how to install and run it",
      "## Getting started" in (readme := (ROOT / "README.md").read_text())
      and "michi init" in readme and "michi status" in readme
      and "release:check" in readme)
check("phase9  the state format's compatibility promise is written down",
      "schema_version" in (ROOT / "CHANGELOG.md").read_text()
      and "may change between minor versions" in (ROOT / "CHANGELOG.md").read_text())

# --- OQ-002  npm identity, now settled -----------------------------------
check("OQ-002  the npm names are settled, with the check that settled them",
      "LOCKED: `@subhashyadav98146/*`" in spec("README.md")
      and "owned by an account that is not ours" in spec("README.md")
      and "Calibrating against the known cases" in spec("README.md"))
check("OQ-002  the command and the package name stay independent",
      "bin` names are not registered on npm" in spec("README.md")
      and all(j["name"].startswith("@subhashyadav98146/")
              for j in MANIFESTS.values()))
check("OQ-002  the unscoped michi package is flagged as somebody else's",
      "not** this project" in (ROOT / "README.md").read_text())
check("OQ-002  identity is still one constant, so the scope can change cheaply",
      "identity.ts" in spec("README.md")
      and (ROOT / "packages" / "core" / "src" / "identity.ts").is_file())

# --- explain and impact: the project in plain language ---------------------
# Long prose wraps, so these match on the bold terms rather than on a phrase
# whose line breaks move whenever the paragraph is reflowed.
check("explain  all four explainable kinds are specified",
      all(k in cli for k in ("**decision**", "**requirement**", "**task**", "**file**")))
check("explain  it answers from the record and never reconstructs",
      "A missing field becomes a sentence" in cli
      and "reconstruction (P9)" in cli)
check("explain  --simple drops the ids, not just the jargon",
      "It strips the ids too" in cli)
check("explain  an ADR id resolves to its decision",
      "An ADR id resolves to the decision it documents" in cli)
check("explain  a component is answered as not recorded, not invented",
      "Components cannot be explained" in cli and "deferred to `DESIGN`" in cli)
check("impact  the blast radius comes from the graph, not a guess",
      "### `michi decide impact`" in cli
      and "computed from the graph rather than guessed" in cli)
check("impact  the total counts each thing once",
      "counts each thing once" in cli and "annotated\nrather than listed a second time" in cli)
check("impact  reported files are labelled as a claim",
      "which is a claim" in cli and "not a measured cost" in cli)
check("explain  both commands are implemented, not just specified",
      (ROOT / "packages" / "core" / "src" / "commands" / "explain.ts").is_file()
      and 'command("explain <id>")' in (run := (ROOT / "packages" / "cli" / "src" / "run.ts").read_text())
      and 'command("impact <id>")' in run)

# --- the npm page: one read, no hopping between packages -------------------
CLI_README = (ROOT / "packages" / "cli" / "README.md").read_text()

check("npm  the CLI page stands on its own — install, start, and what to type",
      all(t in CLI_README for t in
          ("npm install -g @subhashyadav98146/michi-cli", "michi init", "michi status"))
      and says(CLI_README, "You need two things"))
check("npm  it says up front that an agent is required and code is not written",
      says(CLI_README, "not a replacement for one")
      and says(CLI_README, "It never writes your code"))
check("npm  it shows the claim-versus-evidence rule, which is the whole point",
      "michi verify" in CLI_README
      and says(CLI_README, "That is a claim about its own work, not evidence"))
check("npm  it is short enough to read in one sitting",
      len(CLI_README.splitlines()) < 220)
check("npm  the internal packages send people to the CLI rather than stranding them",
      all(says(readme, "You probably want") and len(readme.splitlines()) < 30
          for readme in ((ROOT / "packages" / n / "README.md").read_text()
                         for n in ("core", "adapters", "skills"))))

# --- example: the shape of a file, in one read not seven ------------------
check("example  every --file command has one, and the contract says why",
      "### `michi example`" in cli
      and says(cli, "needed **seven** to write one discovery update")
      and says(cli, "every example is fed to its own command in the tests"))
check("example  --raw exists so the output is a usable file",
      says(cli, "`--raw` prints only the JSON"))
check("example  a schema error points at it, a missing file does not",
      says(cli, "A missing file or a blocked command keeps its own")
      and "withExample" in (ROOT / "packages" / "cli" / "src" / "run.ts").read_text())
check("example  the examples live in one place, not scattered per command",
      (ROOT / "packages" / "core" / "src" / "commands" / "example.ts").is_file())

# --- cross-references -----------------------------------------------------
defined = set(re.findall(r"### (OQ-\d+)", spec("README.md")))
referenced = set()
for t in text.values():
    referenced |= set(re.findall(r"OQ-\d+", t))
check("cross-ref  every OQ referenced is defined in the index",
      not (missing := referenced - defined), str(missing))

broken = []
for f, t in text.items():
    for target in re.findall(r"\]\(([^)#]+\.md)(?:#[^)]*)?\)", t):
        if target.startswith("http"):
            continue
        if not (f.parent / target).resolve().exists():
            broken.append(f"{f.relative_to(ROOT)} -> {target}")
check("cross-ref  internal markdown links resolve", not broken, "; ".join(broken))

check("cross-ref  all eleven contracts are present and indexed",
      len(list(SPECS.glob("*.md"))) == 12
      and all(n in spec("README.md") for n in
              ["PRODUCT_VISION.md", "DESIGN_PRINCIPLES.md", "ARCHITECTURE.md",
               "STATE_MODEL.md", "DECISION_MODEL.md", "CONTEXT_MODEL.md",
               "GRAPH_MODEL.md", "SKILL_CONTRACT.md", "CLI_CONTRACT.md",
               "AGENT_ADAPTER_MODEL.md", "SECURITY_MODEL.md"]))

print()
if fails:
    print(f"{len(fails)} FAILURE(S)")
    sys.exit(1)
print("PHASE 0 CONTRACTS CONSISTENT")
