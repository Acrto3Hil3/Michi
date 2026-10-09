/**
 * Keeping the extension and the CLI in step.
 *
 * The extension is a thin client over `michi`, so a CLI older than the
 * commands this extension calls will fail in ways that look like extension
 * bugs. Checking once on activation turns that into one clear sentence.
 *
 * No semver dependency: this compares three numbers, and an extension that
 * pulls a package in to do that has lost the plot.
 */

/** The oldest CLI whose commands this extension relies on. */
export const MINIMUM_CLI = "0.2.0";

const parts = (version: string): number[] | null => {
  const core = version.trim().split("-")[0] ?? "";
  if (!/^\d+(\.\d+)*$/.test(core)) return null;
  return core.split(".").map(Number);
};

/** Negative, zero or positive, like any comparator. Missing parts are zero. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a), right = parts(b);
  if (!left || !right) return 0;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * True only when a version was read *and* it is behind the minimum.
 *
 * An unreadable version is not evidence of an old one, so it says nothing
 * rather than nagging about an upgrade that may not be needed (P9).
 */
export function cliNeedsUpdate(found: string | undefined): boolean {
  if (!found || !parts(found)) return false;
  return compareVersions(found, MINIMUM_CLI) < 0;
}
