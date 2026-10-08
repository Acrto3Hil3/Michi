/**
 * Package and binary identity.
 *
 * OQ-002 is settled: the `@michi` scope and the `michi` command, checked
 * against the registry (docs/specs/README.md). The one thing a registry read
 * cannot prove is scope *ownership* — a scope can be owned and empty — so
 * everything that names the tool still reads it from here, and changing it
 * stays a one-file edit rather than a rename across the repository.
 *
 * `version` is what the CLI reports. Keep it in step with the four
 * package.json files; CONTRIBUTING.md lists both in the release steps.
 */
export const IDENTITY = {
  /** The command users type. */
  binary: "michi",
  /** The npm scope. The unscoped `michi` package belongs to somebody else. */
  scope: "@michi",
  /** How the tool refers to itself in prose. */
  displayName: "MICHI",
  version: "0.1.0",
} as const;

export function cmd(rest: string): string {
  return `${IDENTITY.binary} ${rest}`;
}
