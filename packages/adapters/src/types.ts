/**
 * The agent adapter boundary.
 *
 * Core must not know which agent will consume its output
 * (AGENT_ADAPTER_MODEL.md). This package is the only place an agent's name
 * appears, and nothing here reaches into `.michi/`, sends anything anywhere,
 * or asks a model a question. Adapters describe files; they never write them.
 */

export interface Skill {
  /** Directory name, which is also the `name:` in the frontmatter. */
  readonly name: string;
  /** The `description:` from the frontmatter — what the agent triggers on. */
  readonly description: string;
  /** The whole file, frontmatter included, exactly as it ships. */
  readonly body: string;
}

export interface PlannedFile {
  /** Relative to the project root, forward slashes, never absolute. */
  readonly path: string;
  readonly content: string;
}

export interface InstallPlan {
  readonly agent: string;
  readonly files: readonly PlannedFile[];
  /** What the user should know before any of it is written. */
  readonly notes: readonly string[];
}

export interface InstallContext {
  readonly projectRoot: string;
  readonly projectName: string;
  readonly skills: readonly Skill[];
}

export interface DetectionResult {
  readonly id: string;
  readonly displayName: string;
  readonly present: boolean;
  /** The paths that led to the conclusion. Detection proposes; it argues its case. */
  readonly evidence: readonly string[];
}

export interface Capabilities {
  /**
   * Does the agent load a directory of skills in MICHI's own format?
   *
   * `false` is not a gap: the baseline `AGENTS.md` is the guarantee, and
   * native skill support is the optimisation.
   */
  readonly native_skills: boolean;
  /**
   * Can the agent run commands on the machine?
   *
   * `null` means MICHI does not know, which is different from `false` (P9).
   * An agent that cannot run commands cannot produce test evidence, which
   * makes that task's verification a human step rather than making MICHI
   * unusable.
   */
  readonly runs_commands: boolean | null;
}

export interface AgentAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: Capabilities;

  /** Is this agent present in the project? Reads; never writes. */
  detect(projectRoot: string): Promise<DetectionResult>;

  /** What should be written for this agent. Pure. */
  installPlan(context: InstallContext): InstallPlan;

  /** Optional per-agent context defaults (OQ-005 keeps `chars/4` the default). */
  readonly defaults?: {
    readonly budgetTokens?: number;
  };
}
