#!/usr/bin/env bash
#
# Prove the artifact that would be published, from the exact tarballs.
#
# A build that passes its own tests in its own repository has proved very
# little about what lands in someone else's node_modules. This packs, inspects
# and then drives the whole MICHI loop using only the installed binary.
#
# It publishes nothing.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/michi-release-$$"
PACK="$WORK/pack"
PROJECT="$WORK/project"
PKGS=(core skills adapters cli)
FAILURES=0

cleanup() { [ "${KEEP:-0}" = "1" ] || rm -rf "$WORK"; }
trap cleanup EXIT

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
check() { if [ "$1" = "0" ]; then pass "$2"; else fail "$2"; fi; }

mkdir -p "$PACK" "$PROJECT"

# --- build and pack --------------------------------------------------------
say "Building"
(cd "$REPO" && ./node_modules/.bin/tsc --build --force >/dev/null)
pass "tsc --build --force"

say "Packing"
for p in "${PKGS[@]}"; do
  (cd "$REPO/packages/$p" && pnpm pack --pack-destination "$PACK" >/dev/null)
done
ls "$PACK" | sed 's/^/  /'

# --- inspect what would ship -----------------------------------------------
say "Inspecting the tarballs"
for tgz in "$PACK"/*.tgz; do
  name="$(basename "$tgz")"
  contents="$(tar -tzf "$tgz")"

  # Nothing from development, and nothing from anybody's project state.
  leaked="$(printf '%s\n' "$contents" | grep -E '\.map$|/test/|tsconfig|\.michi/|node_modules|\.env|\.git/' || true)"
  if [ -z "$leaked" ]; then pass "$name ships no dev or state files"
  else fail "$name ships: $(printf '%s' "$leaked" | tr '\n' ' ')"; fi

  # The licence travels with the code.
  printf '%s\n' "$contents" | grep -q 'package/LICENSE' \
    && pass "$name carries LICENSE" || fail "$name has no LICENSE"
  printf '%s\n' "$contents" | grep -q 'package/README.md' \
    && pass "$name carries README.md" || fail "$name has no README.md"

  # A workspace protocol that reaches the registry is an install that cannot work.
  manifest="$(tar -xOzf "$tgz" package/package.json)"
  printf '%s' "$manifest" | grep -q 'workspace:' \
    && fail "$name still has a workspace: dependency" \
    || pass "$name dependencies are real versions"
  printf '%s' "$manifest" | grep -q '"private": *true' \
    && fail "$name is marked private" || pass "$name is publishable"

  # Secrets. Grep the whole tarball, not just the manifest.
  secrets="$(tar -xOzf "$tgz" 2>/dev/null \
    | grep -aEio 'sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----' \
    | sort -u || true)"
  [ -z "$secrets" ] && pass "$name contains no credential-shaped strings" \
    || fail "$name contains: $secrets"
done

# --- install into a clean project ------------------------------------------
say "Installing into a clean project"
cd "$PROJECT"
npm init -y >/dev/null 2>&1
# All four together: pre-publish, the inter-package deps resolve from the
# local tarballs rather than from a registry that has never seen them.
npm install --silent --no-audit --no-fund \
  "$PACK/michi-core-0.1.0.tgz" "$PACK/michi-skills-0.1.0.tgz" \
  "$PACK/michi-adapters-0.1.0.tgz" "$PACK/michi-cli-0.1.0.tgz" >/dev/null
MICHI="$PROJECT/node_modules/.bin/michi"
[ -x "$MICHI" ] && pass "the michi binary is installed and executable" \
  || { fail "no michi binary"; exit 1; }

"$MICHI" --version >/dev/null && pass "michi --version" || fail "michi --version"
"$MICHI" --help | grep -q 'path from idea to software' \
  && pass "michi --help" || fail "michi --help"

# --- drive the whole loop from the installed binary ------------------------
say "Driving the whole loop from the installed binary"
m() { "$MICHI" "$@" >/dev/null; }
w() { printf '%s' "$2" > "$PROJECT/$1"; }

m init
python3 - "$PROJECT/.michi/config.yaml" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
p.write_text(p.read_text().replace("allow: {}", "allow:\n    test: echo '4 passed'"))
PY
check $? "michi init, and the user allow-lists one command"

m discover start
w a.json '{"intent":{"problem":{"value":"Stock gets lost.","confidence":"STATED"},"goal":{"value":"Trust the counts.","confidence":"STATED"}},"requirements":[{"title":"Manage products","description":"Add and edit products.","type":"functional","priority":"high","origin_confidence":"STATED","acceptance_criteria":["a product can be added"]}]}'
m discover answer --file a.json
w b.json '{"confirm":{"requirements":["REQ-001"],"by":"user"},"confirm_intent":{"by":"user"}}'
m discover answer --file b.json
m discover close
check $? "michi discover — proposed, confirmed by the user, closed"

w c.json '{"personas":[{"name":"Owner","description":"Runs a shop.","goals":[]}],"scope":[{"requirement":"REQ-001","scope":"MVP","reason":"essential"}],"criteria":[{"requirement":"REQ-001","kind":"PLAIN","text":"A product can be added."}]}'
m plan update --file c.json
w d.json '{"confirm":{"scope":["REQ-001"],"by":"user"},"confirm_specification":{"by":"user"}}'
m plan update --file d.json
m plan close
check $? "michi plan — scope and criteria, confirmed and published"

w e.json '{"title":"Where stock is kept","type":"engineering","category":"database","options":[{"key":"a","label":"A database","explanation":"Tables.","tradeoffs":"One more thing."},{"key":"b","label":"A file","explanation":"One file.","tradeoffs":"Lost edits."}],"affects_requirements":["REQ-001"]}'
m decide propose --file e.json
w adr.md 'Concurrent edits would lose data.'
m decide confirm D001 --choice a --by user --rationale "Concurrent edits." --adr adr.md
m architecture close
check $? "michi decide and architecture — locked with a rationale and an ADR"

m context REQ-001
m graph
check $? "michi context and graph"

m plan tasks --from-requirements
m plan validate
# Keep the instruction: handing a task over happens once, and the second
# attempt is rightly refused.
INSTRUCTION="$("$MICHI" task start TASK-001 --agent claude-code)"
check $? "michi plan tasks and task start — the compiled instruction"

missing=""
for section in ROLE PROJECT TASK "USER REQUIREMENT" "APPROVED DECISIONS" \
               ARCHITECTURE SCOPE "ACCEPTANCE CRITERIA" VERIFICATION \
               "STOP CONDITIONS" "REPORT BACK"; do
  printf '%s' "$INSTRUCTION" | grep -q "## $section" || missing="$missing $section"
done
[ -z "$missing" ] && pass "the instruction carries every section the contract names" \
  || fail "the instruction is missing:$missing"

printf '%s' "$INSTRUCTION" | grep -q 'Concurrent edits' \
  && pass "and the reasoning behind the decision reached the agent" \
  || fail "the decision rationale never reached the instruction"

w r.json '{"result":"REPORTED","files_touched":["src/products.ts"],"tests":{"run":4,"passed":4,"failed":0}}'
m task report TASK-001 --from r.json
check $? "michi task report — recorded as a claim"

w v1.json '{"kind":"TESTS","summary":"I ran them, all green","passed":true}'
m test TASK-001 --record v1.json
w vd.json '{"criteria":[{"id":"AC-001","status":"SATISFIED","reason":"The suite covers it.","evidence":["TESTS"]}]}'
if "$MICHI" verify TASK-001 --from vd.json >/dev/null 2>&1; then
  fail "verify accepted a verdict built only on the agent's word"
else
  pass "michi verify refuses the agent's word alone (exit $?)"
fi

if "$MICHI" test TASK-001 --run deploy >/dev/null 2>&1; then
  fail "test ran a command that is not allow-listed"
else
  pass "michi test refuses a command nobody allow-listed"
fi

m test TASK-001 --run test
check $? "michi test --run — MICHI ran it and watched"

w fn.json '{"findings":[]}'
m review TASK-001 --verdict PASS --findings fn.json
m debug TASK-001 --stage REPRODUCE --note "Reproduced once."
check $? "michi review and debug"

m verify TASK-001 --from vd.json
m task done TASK-001
check $? "michi verify and task done"

[ -f "$PROJECT/.michi/tasks/completed/TASK-001.yaml" ] \
  && pass "the closed task is filed, not deleted" \
  || fail "the closed task was not filed"

m install --agent claude-code
[ -f "$PROJECT/AGENTS.md" ] && [ -f "$PROJECT/.claude/skills/tester/SKILL.md" ] \
  && pass "michi install — the baseline and the skills, from the packed artifact" \
  || fail "michi install did not write the skills"

say "What the install left in the project"
(cd "$PROJECT" && find .michi AGENTS.md .claude -type f 2>/dev/null | sort | sed 's/^/  /' | head -40)

# Nothing MICHI wrote should look like a credential, and no application code.
if (cd "$PROJECT" && grep -rlaEi 'sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|AKIA[A-Z0-9]{16}' .michi AGENTS.md .claude 2>/dev/null | head -1 | grep -q .); then
  fail "something MICHI wrote looks like a credential"
else
  pass "nothing MICHI wrote looks like a credential"
fi
[ -d "$PROJECT/src" ] && fail "MICHI wrote application code" \
  || pass "MICHI wrote no application code"

say "Determinism"
a="$("$MICHI" status --json | shasum)"
b="$("$MICHI" status --json | shasum)"
[ "$a" = "$b" ] && pass "two reads return the same bytes" || fail "status is not deterministic"

# --- verdict ---------------------------------------------------------------
if [ "$FAILURES" -eq 0 ]; then
  say "RELEASE ARTIFACT VERIFIED — nothing was published"
else
  say "$FAILURES CHECK(S) FAILED — do not publish"
  exit 1
fi
