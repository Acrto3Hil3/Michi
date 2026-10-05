export { IDENTITY, cmd } from "./identity.js";
export { ExitCode, MichiError, errorPayload, exitCodeFor } from "./errors.js";
export type { ErrorClass, ErrorCode, ErrorPayload, ExitCodeValue } from "./errors.js";
export { ok } from "./result.js";
export type { Result, Ok, Err } from "./result.js";

export { SCHEMA_VERSION } from "./schemas/version.js";
export { ConfigSchema, newConfig } from "./schemas/config.js";
export type { MichiConfig, PolicySetting } from "./schemas/config.js";
export { StateSchema, newState, PROJECT_STAGES } from "./schemas/state.js";
export type { ProjectState, ProjectStage } from "./schemas/state.js";
export { ProjectMapSchema, detected, inferred, unknownDetection } from "./schemas/scan.js";
export type { ProjectMap, Detection, Detections, Confidence } from "./schemas/scan.js";

export { BRAIN, BRAIN_DIRS, brainDir, isInitialized } from "./fs/brain.js";
export { canonicalJson, hashOf } from "./fs/canonical.js";
export { scanProject, mapHash } from "./scan/scanner.js";

export { init } from "./commands/init.js";
export type { InitOptions, InitData } from "./commands/init.js";
export { scan } from "./commands/scan.js";
export type { ScanOptions, ScanData } from "./commands/scan.js";
export { status } from "./commands/status.js";
export type { StatusOptions, StatusData } from "./commands/status.js";

export {
  ConfidenceSchema, IntentSchema, RequirementSchema, SessionSchema,
  newSession, unknownField, INTENT_FIELDS,
  RequirementsRegistrySchema, newRequirementsRegistry, requirementId,
  isActive, titleKey,
  REQUIREMENT_STATES, SESSION_STATES, questionId,
} from "./schemas/discovery.js";
export type {
  Answer, DiscoveryConfidence, DiscoverySession, Intent, IntentField,
  IntentFieldName, Question, Requirement, RequirementsRegistry, SessionState,
} from "./schemas/discovery.js";

export {
  DecisionSchema, RegistrySchema, DECISION_STATES, newRegistry,
  nextDecisionId, nextAdrId, adrFileName, findDecision,
} from "./schemas/decision.js";
export type { Decision, DecisionOption, DecisionRegistry } from "./schemas/decision.js";

export {
  discoverStart, discoverStatus, discoverAnswer, discoverExport, discoverClose,
  computeStatus,
} from "./commands/discover.js";
export type {
  DiscoverOptions, AnswerOptions, StartData, AnswerData, CloseData,
  StatusData as DiscoverStatusData, DiscoveryUpdate,
} from "./commands/discover.js";

export {
  decideList, decideShow, decidePropose, decideConfirm, decideReject, decideSupersede,
} from "./commands/decide.js";
export type {
  DecideOptions, ProposeOptions, ConfirmOptions, RejectOptions, SupersedeOptions,
} from "./commands/decide.js";

export {
  SCOPE_VALUES, SPECIFICATION_STATES, ScopeSchema, PersonaSchema, UseCaseSchema,
  AcceptanceCriterionSchema, ScopeAssignmentSchema, OutOfScopeItemSchema,
  SpecificationSchema, RevisionSchema, PublicationSchema, ArtifactStateSchema,
  ARTIFACT_STATES, newSpecification, effectiveScope, scopeAssignment, isLive,
  personaId, useCaseId, criterionId, outOfScopeId, revisionId,
} from "./schemas/product.js";
export type {
  AcceptanceCriterion, ArtifactState, OutOfScopeItem, Persona,
  ProductSpecification, Publication, Revision, Scope, ScopeAssignment, UseCase,
} from "./schemas/product.js";
export { parseOrInvalid } from "./schemas/parse.js";

export { planStatus, planUpdate, planExport, planClose } from "./commands/plan.js";
export type {
  PlanOptions, PlanUpdateOptions, PlanStatusData, PlanUpdateData, PlanCloseData,
  PlanGaps, PlanUpdateDocument,
} from "./commands/plan.js";

export {
  architectureStatus, architectureExport, architectureClose,
} from "./commands/architecture.js";
export type {
  ArchitectureOptions, ArchitectureStatusData, ArchitectureCloseData,
} from "./commands/architecture.js";
