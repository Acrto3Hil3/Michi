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
`dev-subhash`. Set its **display name** to `Subhash Yadav` on that page — the
id is what appears in the extension's identifier, the display name is what a
reader sees under the title.

```bash
npx vsce login dev-subhash     # paste the PAT when asked
pnpm publish:vscode
```

## 2. Open VSX — reaches Cursor, Windsurf, VSCodium, Gitpod, Eclipse Theia

VS Code's marketplace is licensed for VS Code only, so the forks use Open VSX
instead. Publishing to just one registry reaches about half the editors MICHI
already supports, which would be an odd place to stop.

Needed: an account at https://open-vsx.org (sign in with GitHub), a signed
Publisher Agreement, and an access token from the profile page.

```bash
npx ovsx create-namespace dev-subhash -p <token>   # once
pnpm publish:openvsx -p <token>
```

## The name a reader sees

The publisher **id** is `dev-subhash`, and that is what appears in the
extension identifier — `dev-subhash.michi`. It cannot be changed after the
first publish.

The publisher **display name** is separate, set on the management page, and it
is what a reader sees under the extension title. Set it to **Subhash Yadav**.

Until the extension is published, a sideloaded `.vsix` can only show the id —
VS Code has no field for a display name in the manifest, so the id is all it
has to work with locally. This is not something the build can fix.

## Before either

- The version in `packages/vscode/package.json` is independent of the CLI's.
  Bump it when the extension changes, not when MICHI does.
- `pnpm package` must run clean. The `.vsix` should contain `dist/`, the
  icon, the readme and the licence — no source, no tests, no sourcemaps.
- The extension needs the CLI installed separately
  (`npm install -g @dev-subhash/michi`). The readme says so; do not
  bundle a copy, because then there would be two versions of MICHI on one
  machine and no way to tell which answered.
