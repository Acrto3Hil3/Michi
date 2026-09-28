/**
 * Package and binary identity.
 *
 * OQ-002 is unresolved: the `michi` binary name and the `@michi` npm scope
 * have not been checked for availability. Everything that needs to name the
 * tool reads it from here, so settling OQ-002 is a change to this file rather
 * than a rename across the repository.
 */
export const IDENTITY = {
  /** The command users type. */
  binary: "michi",
  /** The npm scope. Provisional. */
  scope: "@michi",
  /** How the tool refers to itself in prose. */
  displayName: "MICHI",
  version: "0.1.0",
} as const;

export function cmd(rest: string): string {
  return `${IDENTITY.binary} ${rest}`;
}
