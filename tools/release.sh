#!/usr/bin/env bash
#
# Release MICHI everywhere, in one act.
#
# The extension carries a copy of the CLI inside it, which is what makes
# "install the extension and start" true. The cost is that there are two
# places a version lives, and a release that updates one leaves every
# extension user on the old CLI with nothing telling them so.
#
# So this publishes both, or neither. The version is one number across all
# five packages, checked before anything is sent.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$REPO/packages/cli/package.json').version")"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; exit 1; }

say "Releasing MICHI $VERSION"

# --- one version, everywhere -------------------------------------------------
for p in core cli adapters skills vscode; do
  found="$(node -p "require('$REPO/packages/$p/package.json').version")"
  [ "$found" = "$VERSION" ] || fail "packages/$p is $found, not $VERSION — bump them together"
done
grep -q "version: \"$VERSION\"" "$REPO/packages/core/src/identity.ts" \
  || fail "core/src/identity.ts does not say $VERSION — that is what the CLI reports"
pass "all five packages and identity.ts say $VERSION"

# --- the tokens, before anything slow ---------------------------------------
WHO="$(npm whoami 2>/dev/null || true)"
[ -n "$WHO" ] || fail "not logged in to npm — run: npm login"
pass "npm: logged in as $WHO"
[ -n "${VSCE_PAT:-}" ] || fail "VSCE_PAT is not set — see tools/publish-extension.sh"
[ -n "${OVSX_PAT:-}" ] || fail "OVSX_PAT is not set — see tools/publish-extension.sh"
pass "both extension tokens are present"

# --- npm first ---------------------------------------------------------------
# The extension bundles the CLI from source rather than from the registry, so
# the order does not strictly matter. npm goes first because it is the one
# that can be resumed if 2FA times out halfway.
say "npm"
bash "$REPO/tools/publish.sh"

say "Editors"
bash "$REPO/tools/publish-extension.sh"

say "RELEASED EVERYWHERE — $VERSION"
echo "  npm:      https://www.npmjs.com/package/@dev-subhash/michi"
echo "  VS Code:  https://marketplace.visualstudio.com/items?itemName=dev-subhash.michi"
echo "  Open VSX: https://open-vsx.org/extension/dev-subhash/michi"
echo
echo "  Extension users get the new CLI automatically — editors update"
echo "  extensions on their own, and the CLI travels inside it."
