import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/**
 * A Decision is structured project state. An ADR is the human-readable
 * document describing it. They are distinct concepts with separate id spaces
 * (OQ-003) — nothing here derives one from the other by string manipulation,
 * and the registry is authoritative for the mapping.
 */

export const DECISION_STATES = [
  "PROPOSED", "USER_CONFIRMED", "LOCKED", "REJECTED", "SUPERSEDED",
] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

export const OptionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** Plain language, for someone who cannot code (P11). */
  explanation: z.string().min(1).nullable().default(null),
  tradeoffs: z.string().min(1).nullable().default(null),
});
export type DecisionOption = z.infer<typeof OptionSchema>;

export const ApprovalSchema = z.object({
  by: z.string().min(1),
  at: z.string().datetime(),
});

export const DecisionSchema = z
  .object({
    id: z.string().regex(/^D\d{3,}$/),
    title: z.string().min(1),
    type: z.enum(["product", "engineering"]),
    category: z.string().min(1),
    status: z.enum(DECISION_STATES),
    options: z.array(OptionSchema),
    selected_option: z.string().min(1).nullable(),
    rationale: z.string().min(1).nullable(),
    alternatives_rejected: z.array(z.object({
      key: z.string().min(1),
      reason: z.string().min(1),
    })),
    consequences: z.array(z.string().min(1)),
    approval: ApprovalSchema.nullable(),
    adr: z.string().regex(/^ADR-\d{3,}$/).nullable(),
    adr_file: z.string().min(1).nullable(),
    affects_requirements: z.array(z.string()),
    affects_components: z.array(z.string()),
    supersedes: z.string().regex(/^D\d{3,}$/).nullable(),
    superseded_by: z.string().regex(/^D\d{3,}$/).nullable(),
    rejected_reason: z.string().min(1).nullable().default(null),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((d, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (d.selected_option && d.options.length > 0) {
      if (!d.options.some((o) => o.key === d.selected_option)) {
        fail("selected_option", `selected_option "${d.selected_option}" is not one of the offered options`);
      }
    }

    const settled = d.status === "USER_CONFIRMED" || d.status === "LOCKED" || d.status === "SUPERSEDED";
    if (!settled) return;

    // P2, enforced by the schema rather than by good intentions.
    if (!d.approval) fail("approval", "a decision past PROPOSED must record the approval that settled it");
    if (!d.selected_option) fail("selected_option", "a settled decision must record what was chosen");
    if (!d.rationale) fail("rationale", "a settled decision must record why — a decision nobody can explain is a habit");
    if (d.status === "LOCKED" || d.status === "SUPERSEDED") {
      if (!d.adr) fail("adr", "a LOCKED decision must have an ADR documenting it");
      if (!d.adr_file) fail("adr_file", "a LOCKED decision must name its ADR file");
    }
  });
export type Decision = z.infer<typeof DecisionSchema>;

export const RegistrySchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  next_decision_id: z.number().int().positive(),
  next_adr_id: z.number().int().positive(),
  decisions: z.array(DecisionSchema),
});
export type DecisionRegistry = z.infer<typeof RegistrySchema>;

export function newRegistry(): DecisionRegistry {
  return {
    schema_version: SCHEMA_VERSION,
    next_decision_id: 1,
    next_adr_id: 1,
    decisions: [],
  };
}

/**
 * Separate counters, each holding the next number to allocate (DECISION_MODEL.md
 * shows `next_id: 10` alongside D001..D008). Neither id is ever computed from
 * the other (OQ-003).
 */
export function nextDecisionId(registry: DecisionRegistry): string {
  return `D${String(registry.next_decision_id).padStart(3, "0")}`;
}

export function nextAdrId(registry: DecisionRegistry): string {
  return `ADR-${String(registry.next_adr_id).padStart(3, "0")}`;
}

export function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "decision";
}

export function adrFileName(adrId: string, title: string): string {
  return `${adrId}-${slugify(title)}.md`;
}

export function findDecision(registry: DecisionRegistry, id: string): Decision | undefined {
  return registry.decisions.find((d) => d.id === id);
}
