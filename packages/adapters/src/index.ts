export type {
  AgentAdapter, Capabilities, DetectionResult, InstallContext, InstallPlan,
  PlannedFile, Skill,
} from "./types.js";
export { ADAPTERS, adapterFor, adapterIds, detectAll } from "./adapters.js";
export { baselineAgentsMd } from "./baseline.js";
export { diffLines, reconcile } from "./install.js";
export type { InstallAction, InstallOutcome, ReadFile } from "./install.js";
export { loadSkills } from "./skills.js";
