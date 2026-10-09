/**
 * Finding a `michi` to run.
 *
 * The extension ships the CLI inside it, so installing the extension is the
 * only thing a person has to do: no `npm install -g`, and no Node either —
 * the bundle runs on the Node that the editor already has.
 *
 * A michi the user installed themselves still wins. Somebody who ran
 * `npm install -g` has opinions about which version runs, and quietly using a
 * different one would surprise them — and leave them debugging a difference
 * nobody told them about.
 */

export type CliSource = "setting" | "path" | "bundled";

export interface ResolvedCli {
  readonly command: string;
  readonly args: readonly string[];
  readonly source: CliSource;
  readonly env?: Readonly<Record<string, string>>;
}

export interface ResolveInput {
  /** The `michi.path` setting. "michi" is the default and means "not set". */
  readonly setting: string;
  /** Is `michi` on PATH? */
  readonly onPath: () => boolean;
  /** Absolute path to the bundled michi.mjs. */
  readonly bundled: string;
  /** The editor's own Node. Defaults to this process's. */
  readonly execPath?: string;
}

export function resolveCli(input: ResolveInput): ResolvedCli {
  const setting = input.setting.trim();
  if (setting && setting !== "michi") {
    return { command: setting, args: [], source: "setting" };
  }
  if (input.onPath()) {
    return { command: "michi", args: [], source: "path" };
  }
  return {
    // ELECTRON_RUN_AS_NODE turns the editor's binary into a plain Node, which
    // is how an extension runs a script without a Node on the machine.
    command: input.execPath ?? process.execPath,
    args: [input.bundled],
    source: "bundled",
    env: { ELECTRON_RUN_AS_NODE: "1" },
  };
}

export function describeSource(source: CliSource): string {
  switch (source) {
    case "setting": return "the michi.path setting";
    case "path":    return "the michi you installed yourself";
    case "bundled": return "the copy built in to this extension";
  }
}
