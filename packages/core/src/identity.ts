/**
 * Package and binary identity.
 *
 * OQ-002 is settled: `@dev-subhash/*`, with the CLI published as `michi` and
 * the command also `michi` — bin names are not registered on npm, so the two
 * are independent (docs/specs/README.md).
 * Everything that names the tool reads it from here, so moving scope stays a
 * small mechanical change rather than a rename across the repository.
 *
 * `version` is what the CLI reports. Keep it in step with the four
 * package.json files; CONTRIBUTING.md lists both in the release steps.
 */
export const IDENTITY = {
  /** The command users type. */
  binary: "michi",
  /**
   * The npm scope. `@michi`, `@subhashyadav` and the unscoped `michi` all
   * belong to other accounts; `@dev-subhash` is the owner's own organisation.
   */
  scope: "@dev-subhash",
  /** How the tool refers to itself in prose. */
  displayName: "MICHI",
  version: "0.2.0",
} as const;

export function cmd(rest: string): string {
  return `${IDENTITY.binary} ${rest}`;
}
