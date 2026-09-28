import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach } from "vitest";

const made: string[] = [];

export function tempProject(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "michi-test-"));
  made.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return root;
}

afterEach(() => {
  while (made.length) {
    const d = made.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

export const NOW = "2026-09-28T12:00:00.000Z";
export const clock = () => NOW;
