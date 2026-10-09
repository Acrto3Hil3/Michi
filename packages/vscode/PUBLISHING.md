# Publishing the extension

Two registries, because the editors split across them. Both take the same
`.vsix`, and both need an account that only the owner can create.

```bash
cd packages/vscode
pnpm package            # builds dist/ and writes michi.vsix
```

That file is installable on its own, with no registry at all:

```bash
code --install-extension michi.vsix
```

## 1. VS Code Marketplace — reaches VS Code

Needed: a publisher at https://marketplace.visualstudio.com/manage, created
under a Microsoft account, plus a Personal Access Token from Azure DevOps
(https://dev.azure.com) scoped to **Marketplace → Manage**.

The publisher id must match `"publisher"` in `package.json`, which is
currently `subhashyadav98146`.

```bash
npx vsce login subhashyadav98146     # paste the PAT when asked
pnpm publish:vscode
```

## 2. Open VSX — reaches Cursor, Windsurf, VSCodium, Gitpod, Eclipse Theia

VS Code's marketplace is licensed for VS Code only, so the forks use Open VSX
instead. Publishing to just one registry reaches about half the editors MICHI
already supports, which would be an odd place to stop.

Needed: an account at https://open-vsx.org (sign in with GitHub), a signed
Publisher Agreement, and an access token from the profile page.

```bash
npx ovsx create-namespace subhashyadav98146 -p <token>   # once
pnpm publish:openvsx -p <token>
```

## Before either

- The version in `packages/vscode/package.json` is independent of the CLI's.
  Bump it when the extension changes, not when MICHI does.
- `pnpm package` must run clean. The `.vsix` should contain `dist/`, the
  icon, the readme and the licence — no source, no tests, no sourcemaps.
- The extension needs the CLI installed separately
  (`npm install -g @subhashyadav98146/michi-cli`). The readme says so; do not
  bundle a copy, because then there would be two versions of MICHI on one
  machine and no way to tell which answered.
