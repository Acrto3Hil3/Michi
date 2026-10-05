import type { ContextPacket } from "../schemas/context.js";
import type { Task } from "../schemas/task.js";

/**
 * The prompt compiler.
 *
 * Turns an approved task plus its resolved context into the instruction an
 * agent acts on. Deterministic: the same task and packet give the same bytes,
 * which is what makes `instruction_hash` worth recording.
 *
 * The instruction is a **generated artifact, never a source of truth**
 * (CONTEXT_MODEL.md §41). Editing a compiled instruction to fix a problem is
 * always wrong — the fix belongs in the state it was compiled from.
 */

/** CONTEXT_MODEL.md §41, in order. The order is part of the contract. */
export const INSTRUCTION_SECTIONS = [
  "ROLE", "PROJECT", "TASK", "USER REQUIREMENT", "ENGINEERING INTERPRETATION",
  "APPROVED DECISIONS", "ARCHITECTURE", "SCOPE", "OUT OF SCOPE", "RELEVANT FILES",
  "IMPLEMENTATION RULES", "SECURITY REQUIREMENTS", "ACCEPTANCE CRITERIA",
  "TESTING", "VERIFICATION", "STOP CONDITIONS", "REPORT BACK",
] as const;

export interface CompileInput {
  task: Task;
  packet: ContextPacket;
}

export function compileInstruction({ task, packet }: CompileInput): string {
  const out: string[] = [];
  const section = (name: (typeof INSTRUCTION_SECTIONS)[number], body: string[]): void => {
    out.push(`## ${name}`, "", ...body, "");
  };
  const of = (prefix: string, tiers = ["MUST_INCLUDE", "PREFERRED"]) =>
    packet.items.filter((i) => i.id.startsWith(prefix) && tiers.includes(i.tier));

  out.push(`# ${task.task_id} — ${task.title}`, "");

  section("ROLE", [
    "You are implementing an approved task inside an existing project.",
    "",
    "The engineering decisions below were made and approved by the project's",
    "owner. They are not suggestions and they are not yours to revisit. Build",
    "what is described, nothing more.",
  ]);

  const detected = Object.entries(packet.project.detected)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${String(v)}`);
  section("PROJECT", [
    packet.project.name,
    ...(detected.length > 0 ? ["", "What is already here:", "", ...detected] : []),
    ...(packet.project.constraints.length > 0
      ? ["", "Limits the owner stated:", "", ...packet.project.constraints.map((c) => `- ${c}`)]
      : []),
  ]);

  section("TASK", [task.description]);

  section("USER REQUIREMENT", of("REQ-").map((i) => `- ${i.content.split("\n")[0]}`));

  section("ENGINEERING INTERPRETATION", [
    `This task exists to satisfy ${task.requirements.join(", ")}.`,
    ...(task.dependencies.length > 0
      ? ["", `It follows ${task.dependencies.join(", ")}, which are already done.`]
      : []),
  ]);

  const decisions = of("D");
  section("APPROVED DECISIONS", decisions.length === 0
    ? ["None govern this task."]
    : decisions.flatMap((i) => {
        const lines = [`### ${i.id}`, "", i.content];
        if (i.needs_review) {
          lines.push("", `**This decision needs review**: ${i.review_reason ?? "the specification changed after it was agreed"}.`,
            "If the work depends on it, stop and say so rather than assuming it still holds.");
        }
        return [...lines, ""];
      }));

  const adrs = of("ADR-");
  section("ARCHITECTURE", adrs.length === 0
    ? ["Nothing recorded for this task."]
    : adrs.flatMap((i) => [`### ${i.id}`, "", i.content, ""]));

  section("SCOPE", task.scope.in.map((x) => `- ${x}`));

  section("OUT OF SCOPE", [
    ...task.scope.out.map((x) => `- ${x}`),
    "",
    "Anything not listed under SCOPE. If you find something that looks useful",
    "but is not in scope, say so and leave it alone.",
  ]);

  section("RELEVANT FILES", [
    "MICHI does not yet know which files implement which requirement — that",
    "mapping is built from what you report back.",
    "",
    "Inspect what exists before creating anything new. Reuse the patterns",
    "already in this project rather than introducing your own.",
  ]);

  section("IMPLEMENTATION RULES", [
    "- Reuse what is already here. Look before you write.",
    "- Do not introduce a new framework, library or service.",
    "- Do not duplicate existing validation or helpers.",
    "- Do not create abstractions for a single use.",
    "- Validate anything that comes from outside the system.",
    "- Preserve the existing architecture.",
    "- Do not modify anything outside this task's scope.",
  ]);

  section("SECURITY REQUIREMENTS", [
    "- Validate every input that crosses a trust boundary.",
    "- Never log or commit credentials, tokens or personal data.",
    "- Do not weaken an existing check to make this work.",
    "- Do not add a dependency without saying so in your report.",
  ]);

  section("ACCEPTANCE CRITERIA", [
    "This task is not finished until every one of these can be demonstrated:",
    "",
    ...task.acceptance_criteria.map((c) => `- **${c.id}** — ${c.text}`),
  ]);

  section("TESTING", [
    "Add tests that would fail if this behaviour broke, at the level the change",
    "warrants — a pure function needs a unit test; something touching data needs",
    "an integration test.",
    "",
    "Tests assert behaviour, not implementation. A test that breaks when a",
    "function is renamed, with nothing behaving differently, is a liability.",
  ]);

  section("VERIFICATION", [
    "Run the relevant tests and report what actually happened — the command, the",
    "exit code, the counts.",
    "",
    "Do not report success by restating this instruction. Saying it is done is",
    "not evidence that it is.",
  ]);

  section("STOP CONDITIONS", [
    "Stop, and say which of these happened, if:",
    "",
    "- a requirement is ambiguous in a way that changes what you build",
    "- the task needs a decision that has not been made",
    "- doing this would contradict a locked decision above",
    "- the scope would have to grow beyond what is listed",
    "- you need a credential, account or service you have not been given",
    "- tests reveal an architectural problem unrelated to this task",
    "",
    "Ask. Do not invent.",
  ]);

  // MICHI.md §78's handoff contract, in its own terms.
  section("REPORT BACK", [
    "When you stop, for any reason, report:",
    "",
    "- implementation summary: what you did, briefly",
    "- files changed: every one",
    "- tests executed, and whether they passed or failed",
    "- verification evidence: the commands and their actual output",
    "- remaining issues: anything unresolved",
    "- new decisions requiring approval: anything you had to choose that the",
    "  owner has not agreed",
  ]);

  return out.join("\n");
}
