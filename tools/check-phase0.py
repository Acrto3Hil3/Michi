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

# --- OQ-002  npm identity not treated as settled --------------------------
check("OQ-002  npm names appear only as unconfirmed",
      not (bad := unqualified(r"@michi/",
                              r"not settled|assume|not been checked|unverified|OQ-002")),
      "; ".join(bad))

# --- v1 non-goals ---------------------------------------------------------
check("non-goals  MICHI's own storage is text files, not a database",
      "No database" in arch and "no database" in arch.lower()
      and "Markdown for anything a human reads" in arch)
check("non-goals  no vector store or embeddings anywhere",
      not (bad := [str(f.relative_to(ROOT)) for f, t in text.items()
                   if re.search(r"\b(pinecone|weaviate|chroma|embeddings?)\b", t, re.I)
                   and not re.search(r"should not|not introduce|no vector|only be introduced", t, re.I)]),
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
