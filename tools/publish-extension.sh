#!/usr/bin/env bash
#
# Publish the editor extension to both registries, then check it is actually
# there.
#
# Two registries because the editors split across them: VS Code's marketplace
# is licensed for VS Code, so Cursor, Windsurf, VSCodium, Gitpod and Theia
# take their extensions from Open VSX. Publishing to one reaches about half
# the editors MICHI already supports.
#
# Tokens are read from the environment and never printed:
#   VSCE_PAT   — Azure DevOps PAT, scoped to Marketplace → Manage
#   OVSX_PAT   — open-vsx.org access token
set -euo pipefail

EXT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../packages/vscode" && pwd)"
REPO="$(cd "$EXT/../.." && pwd)"
NAME="$(node -p "require('$EXT/package.json').name")"
PUBLISHER="$(node -p "require('$EXT/package.json').publisher")"
VERSION="$(node -p "require('$EXT/package.json').version")"
ID="$PUBLISHER.$NAME"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; exit 1; }

say "Publishing $ID@$VERSION"

# --- the tokens, before anything slow ---------------------------------------
missing=0
[ -n "${VSCE_PAT:-}" ] || { echo "  VSCE_PAT is not set."; missing=1; }
[ -n "${OVSX_PAT:-}" ] || { echo "  OVSX_PAT is not set."; missing=1; }
if [ "$missing" = "1" ]; then
  cat <<EOF

  Both tokens are needed, and both come from a website:

  VSCE_PAT   Create the publisher "$PUBLISHER" at
             https://marketplace.visualstudio.com/manage
             (set its DISPLAY NAME to "Subhash Yadav" — that is the name a
             reader sees under the extension title).
             Then a Personal Access Token at https://dev.azure.com,
             scoped to Marketplace → Manage.

  OVSX_PAT   Sign in at https://open-vsx.org with GitHub, sign the publisher
             agreement, and create an access token on your profile page.

  Then, with a leading space so they stay out of shell history:

       export VSCE_PAT=...
       export OVSX_PAT=...
       pnpm release:extension

EOF
  exit 1
fi
pass "both tokens are present"

# --- the gate ----------------------------------------------------------------
say "Gate"
(cd "$REPO" && pnpm verify >/dev/null) || fail "the test suite is not green"
pass "tests and invariants"

say "Building"
(cd "$EXT" && pnpm build >/dev/null && ./node_modules/.bin/vsce package \
  --no-dependencies --out michi.vsix >/dev/null) || fail "packaging failed"
pass "michi.vsix built from a clean build"

# The CLI is bundled, so a vsix without it would install and do nothing.
unzip -l "$EXT/michi.vsix" | grep -q "dist/cli/michi.mjs" \
  && pass "the CLI is inside the package" \
  || fail "the vsix has no bundled CLI — run pnpm build first"
[ "$(unzip -l "$EXT/michi.vsix" | grep -c 'skills/.*/SKILL.md')" = "7" ] \
  && pass "all seven skills are inside the package" \
  || fail "the vsix is missing skills"

# --- publish -----------------------------------------------------------------
say "VS Code Marketplace"
(cd "$EXT" && ./node_modules/.bin/vsce publish --no-dependencies --pat "$VSCE_PAT") \
  || fail "vsce publish failed"
pass "published to the VS Code Marketplace"

say "Open VSX"
# The namespace has to exist first, and creating one twice is not an error
# worth stopping for.
(cd "$EXT" && ./node_modules/.bin/ovsx create-namespace "$PUBLISHER" -p "$OVSX_PAT" 2>/dev/null) || true
(cd "$EXT" && ./node_modules/.bin/ovsx publish michi.vsix -p "$OVSX_PAT") \
  || fail "ovsx publish failed"
pass "published to Open VSX"

# --- verify it is actually there ---------------------------------------------
# A successful upload proves the upload worked. Both marketplaces take a few
# minutes to serve a brand new extension, so a miss here is usually lag.
say "Checking both registries"

ovsx_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  "https://open-vsx.org/api/$PUBLISHER/$NAME/$VERSION")"
[ "$ovsx_code" = "200" ] \
  && pass "Open VSX is serving $ID@$VERSION" \
  || echo "  ....  Open VSX answered $ovsx_code — usually propagation; check again shortly"

found="$(curl -s --max-time 20 -X POST \
  'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json;api-version=3.0-preview.1' \
  -d "{\"filters\":[{\"criteria\":[{\"filterType\":7,\"value\":\"$ID\"}]}],\"flags\":914}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      try{const e=JSON.parse(s).results[0].extensions;console.log(e.length?e[0].versions[0].version:'')}catch{console.log('')}})")"
[ -n "$found" ] \
  && pass "the VS Code Marketplace is serving $ID@$found" \
  || echo "  ....  the marketplace has not listed it yet — usually propagation"

say "PUBLISHED — $ID@$VERSION"
echo "  VS Code:  https://marketplace.visualstudio.com/items?itemName=$ID"
echo "  Open VSX: https://open-vsx.org/extension/$PUBLISHER/$NAME"
