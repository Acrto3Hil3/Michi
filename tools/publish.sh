#!/usr/bin/env bash
#
# Publish MICHI. Use this, never `npm publish` directly.
#
# The reason is not style. These packages depend on each other with pnpm's
# `workspace:*` protocol, which is correct for development and meaningless to
# a registry. `pnpm publish` rewrites it to the real version on the way out.
# `npm publish` ships it verbatim, and the published package then fails to
# install with EUNSUPPORTEDPROTOCOL — which is exactly how 0.1.0 of
# @dev-subhash/michi-adapters was broken.
#
# Afterwards it installs what it just published, from the registry, into a
# clean directory — because a successful publish proves only that the upload
# worked.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKGS=(core skills adapters cli)
VERSION="$(node -p "require('$REPO/packages/cli/package.json').version")"
SCOPE="$(node -p "require('$REPO/packages/cli/package.json').name.split('/')[0]")"

# Read each package's real name from its own manifest. Deriving it from the
# folder worked until the CLI became @dev-subhash/michi rather than
# michi-cli — and then the script checked a name that does not exist, decided
# nothing was published, and reported the failure under the wrong package.
pkg_name() { node -p "require('$REPO/packages/$1/package.json').name"; }
encode()   { printf '%s' "${1//\//%2F}"; }

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; exit 1; }

# Check this first: the gate takes a minute, and finding out afterwards that
# npm is logged out wastes it. An expired session is also easy to misread —
# a write to a scoped package answers 404, not 401, because the registry will
# not confirm to an anonymous caller that the package exists.
say "Checking npm login"
WHO="$(npm whoami 2>/dev/null || true)"
if [ -z "$WHO" ]; then
  echo "  Not logged in to npm."
  echo "  Run: npm login"
  echo
  echo "  If you see a 404 while publishing or deprecating, this is usually why:"
  echo "  the registry answers 404 rather than 401 for a scoped package when"
  echo "  nobody is signed in."
  exit 1
fi
pass "logged in as $WHO"

# A scope is an organisation that has to exist before anything can go into it,
# and the registry's answer — "Scope not found" — arrives only at the publish,
# after the gate has run. Check it here instead.
say "Checking the $SCOPE scope exists"
SCOPE_NAME="${SCOPE#@}"
if npm org ls "$SCOPE_NAME" >/dev/null 2>&1; then
  pass "$SCOPE exists and this account can see it"
else
  echo "  The $SCOPE organisation does not exist on npm."
  echo
  echo "  Create it here — this cannot be done from the CLI, there is no"
  echo "  \`npm org create\`:"
  echo
  echo "      https://www.npmjs.com/org/create"
  echo
  echo "  Name it \"$SCOPE_NAME\" and pick the free plan. Then run this again."
  exit 1
fi

say "Gate"
(cd "$REPO" && pnpm verify >/dev/null && bash tools/release-check.sh >/dev/null) \
  || fail "the gate is not green — fix that before publishing anything"
pass "tests, invariants and the release check"

# A half-finished release leaves some of the four already at this version.
# Resuming must skip those rather than halting on the first one — halting is
# how the 0.1.0 release ended up with two packages published and two not.
say "Checking what is already at $VERSION"
TODO=()
for p in "${PKGS[@]}"; do
  name="$(pkg_name "$p")"
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/$(encode "$name")/$VERSION")"
  if [ "$code" = "200" ]; then
    pass "$name@$VERSION already published — skipping"
  else
    TODO+=("$p")
  fi
done

if [ ${#TODO[@]} -eq 0 ]; then
  say "Nothing to publish — all four are already at $VERSION"
else
  say "Publishing ${#TODO[@]} package(s)"
  echo "  2FA asks per package, each approved separately, so there is no"
  echo "  30-second window to race."
  echo
  for p in "${TODO[@]}"; do
    # pnpm, never npm: this is the line that rewrites workspace:*
    (cd "$REPO/packages/$p" && pnpm publish --no-git-checks "$@") \
      || fail "publishing $(pkg_name "$p") failed — rerun this script, it resumes"
  done
fi

say "Verifying what landed, from the registry"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" && npm init -y >/dev/null 2>&1

for p in "${PKGS[@]}"; do
  name="$(pkg_name "$p")"
  deps="$(curl -s "https://registry.npmjs.org/$(encode "$name")/$VERSION" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try { console.log(JSON.stringify(JSON.parse(s).dependencies||{})) } catch { console.log('ERROR') }})")"
  case "$deps" in
    *workspace:*) fail "$name@$VERSION published a workspace: dependency — it cannot be installed" ;;
    ERROR)        fail "$name@$VERSION is not on the registry" ;;
    *)            pass "$name@$VERSION dependencies are real versions" ;;
  esac
done

# The only check that matters: can a stranger install it and run it?
#
# --prefer-online is load-bearing. npm caches the packument — the list of
# versions — so a machine that fetched this package minutes ago still believes
# the old version is the newest one, and the install fails seconds after a
# perfectly good publish. The registry is right; the local cache is stale.
CLI_NAME="$(pkg_name cli)"
npm install --prefer-online --silent --no-audit --no-fund "$CLI_NAME@$VERSION" >/dev/null \
  || fail "installing $CLI_NAME@$VERSION failed — the registry can take a few minutes to list a brand new package, so try again before assuming it is broken"
./node_modules/.bin/michi --version >/dev/null \
  || fail "the published binary does not run"
pass "a clean install of $CLI_NAME@$VERSION works and the binary runs"

say "PUBLISHED AND VERIFIED — $VERSION"
