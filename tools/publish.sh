#!/usr/bin/env bash
#
# Publish MICHI. Use this, never `npm publish` directly.
#
# The reason is not style. These packages depend on each other with pnpm's
# `workspace:*` protocol, which is correct for development and meaningless to
# a registry. `pnpm publish` rewrites it to the real version on the way out.
# `npm publish` ships it verbatim, and the published package then fails to
# install with EUNSUPPORTEDPROTOCOL — which is exactly how 0.1.0 of
# @subhashyadav98146/michi-adapters was broken.
#
# Afterwards it installs what it just published, from the registry, into a
# clean directory — because a successful publish proves only that the upload
# worked.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKGS=(core skills adapters cli)
VERSION="$(node -p "require('$REPO/packages/cli/package.json').version")"
SCOPE="$(node -p "require('$REPO/packages/cli/package.json').name.split('/')[0]")"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; exit 1; }

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
  name="$SCOPE/michi-$p"
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/${name//\//%2F}/$VERSION")"
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
      || fail "publishing $SCOPE/michi-$p failed — rerun this script, it resumes"
  done
fi

say "Verifying what landed, from the registry"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK" && npm init -y >/dev/null 2>&1

for p in "${PKGS[@]}"; do
  name="$SCOPE/michi-$p"
  deps="$(curl -s "https://registry.npmjs.org/${name//\//%2F}/$VERSION" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try { console.log(JSON.stringify(JSON.parse(s).dependencies||{})) } catch { console.log('ERROR') }})")"
  case "$deps" in
    *workspace:*) fail "$name@$VERSION published a workspace: dependency — it cannot be installed" ;;
    ERROR)        fail "$name@$VERSION is not on the registry" ;;
    *)            pass "$name@$VERSION dependencies are real versions" ;;
  esac
done

# The only check that matters: can a stranger install it and run it?
npm install --silent --no-audit --no-fund "$SCOPE/michi-cli@$VERSION" >/dev/null \
  || fail "installing the published CLI failed"
./node_modules/.bin/michi --version >/dev/null \
  || fail "the published binary does not run"
pass "a clean install of $SCOPE/michi-cli@$VERSION works and the binary runs"

say "PUBLISHED AND VERIFIED — $VERSION"
