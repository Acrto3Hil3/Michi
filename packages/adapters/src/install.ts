import type { PlannedFile } from "./types.js";

/**
 * Comparing a plan against what is on disk.
 *
 * Pure: it is handed a reader and returns what should happen. The CLI does the
 * writing, under the same policy checks as any other write.
 *
 * There is no `DELETE` and no `OVERWRITE` action, by construction (P10).
 * Somebody's hand-tuned `AGENTS.md` is not MICHI's to clobber, so a difference
 * is reported with a diff and left for them.
 */

export type InstallAction = "WRITE" | "UNCHANGED" | "CONFLICT";

export interface InstallOutcome {
  readonly path: string;
  readonly action: InstallAction;
  /** What would be written. Present on `WRITE`. */
  readonly content?: string;
  /** What is there now. Present on `CONFLICT`. */
  readonly existing?: string;
  /** A unified-ish diff, present on `CONFLICT`. */
  readonly diff?: readonly string[];
}

/** Returns the file's current content, or null if it does not exist. */
export type ReadFile = (path: string) => string | null;

const CONTEXT = 2;

/** Enough of a diff for a person to see what they would have lost. */
export function diffLines(mine: string, theirs: string, max = 40): string[] {
  const a = theirs.split("\n");
  const b = mine.split("\n");
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;

  const out: string[] = [];
  if (head > CONTEXT) out.push(`  … ${head - CONTEXT} identical line(s)`);
  for (const line of a.slice(Math.max(0, head - CONTEXT), head)) out.push(`  ${line}`);
  for (const line of a.slice(head, a.length - tail)) out.push(`- ${line}`);
  for (const line of b.slice(head, b.length - tail)) out.push(`+ ${line}`);
  for (const line of a.slice(a.length - tail, a.length - tail + CONTEXT)) out.push(`  ${line}`);
  if (tail > CONTEXT) out.push(`  … ${tail - CONTEXT} identical line(s)`);
  return out.length > max ? [...out.slice(0, max), `  … ${out.length - max} more line(s)`] : out;
}

export function reconcile(files: readonly PlannedFile[], read: ReadFile): InstallOutcome[] {
  return files.map((file) => {
    const existing = read(file.path);
    if (existing === null) return { path: file.path, action: "WRITE" as const, content: file.content };
    if (existing === file.content) return { path: file.path, action: "UNCHANGED" as const };
    return {
      path: file.path,
      action: "CONFLICT" as const,
      existing,
      diff: diffLines(file.content, existing),
    };
  });
}
