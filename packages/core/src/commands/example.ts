import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { cmd } from "../identity.js";

/**
 * `michi example <name>` — a complete, valid file for every command that
 * takes `--file`.
 *
 * This exists because of what a validation error can and cannot say. A schema
 * failure names one missing field at a time, so discovering the shape of a
 * file by trial costs one round-trip per field: a dogfood run of 0.1.1 needed
 * seven to write a single discovery update, and never learned which values
 * `confidence` accepts. The caller is usually an agent, and an agent guessing
 * its way through a schema is a slow, lossy way to spend somebody's session.
 *
 * Every example here is parsed by its own schema in the tests. An example that
 * does not validate is worse than none — it sends the reader back around the
 * loop they were trying to escape.
 */

export interface Example {
  /** What this file is for, in a sentence. */
  readonly what: string;
  /** The command it is fed to. */
  readonly used_by: string;
  /** A complete, valid file. */
  readonly body: unknown;
  /** Anything the shape alone does not tell you — allowed values, mostly. */
  readonly notes: readonly string[];
}

const CONFIDENCE =
  "confidence and origin_confidence are STATED (the user said it), " +
  "INFERRED (you worked it out from what they said) or ASSUMED (neither — " +
  "flag it and check). Never record a guess as STATED.";

export const EXAMPLES: Record<string, Example> = {
  "discover-answer": {
    what: "What you learned in a discovery conversation: the intent, and the requirements it implies.",
    used_by: "discover answer --file",
    body: {
      intent: {
        problem: { value: "People lose track of what they spend each month.", confidence: "STATED" },
        goal: { value: "Let someone log an expense in seconds and see the total.", confidence: "STATED" },
        users: { value: ["A freelancer tracking their own costs"], confidence: "STATED" },
        constraints: { value: ["No budget for paid services"], confidence: "STATED" },
      },
      requirements: [
        {
          title: "Log an expense",
          description: "Record an amount, a date, a category and a note.",
          type: "functional",
          priority: "high",
          origin_confidence: "STATED",
          acceptance_criteria: ["an expense can be saved and read back"],
        },
      ],
    },
    notes: [
      CONFIDENCE,
      "type is functional, non_functional or constraint. priority is high, medium or low.",
      "Requirements arrive PROPOSED. Confirming is a separate send: " +
        `{ "confirm": { "requirements": ["REQ-001"], "by": "<the user's name>" }, ` +
        `"confirm_intent": { "by": "<the user's name>" } }`,
      "Only the user confirms. MICHI refuses a confirmation that does not name who gave it.",
    ],
  },

  "plan-update": {
    what: "Who this is for, what ships first, and how anyone will know it works.",
    used_by: "plan update --file",
    body: {
      personas: [
        { name: "Freelancer", description: "Tracks their own costs for tax.", goals: ["know what they spent"] },
      ],
      scope: [
        { requirement: "REQ-001", scope: "MVP", reason: "nothing works without it" },
        { requirement: "REQ-002", scope: "FUTURE", reason: "only needed at tax time" },
      ],
      criteria: [
        { requirement: "REQ-001", kind: "PLAIN", text: "An expense can be saved and read back." },
      ],
    },
    notes: [
      "scope is MVP, FUTURE, OUT_OF_SCOPE or UNKNOWN. FUTURE is a promise, not a deletion.",
      "kind is PLAIN (a sentence anyone can check) or GHERKIN (Given/When/Then).",
      "Confirming is a separate send: " +
        `{ "confirm": { "scope": ["REQ-001"], "by": "<name>" }, "confirm_specification": { "by": "<name>" } }`,
    ],
  },

  "decide-propose": {
    what: "A technical choice put to the user: options with honest trade-offs, and no decision made.",
    used_by: "decide propose --file",
    body: {
      title: "Where the expenses are stored",
      type: "engineering",
      category: "database",
      options: [
        {
          key: "sqlite",
          label: "A single file on your machine",
          explanation: "No service to run and no monthly cost. Backing up means copying one file.",
          tradeoffs: "If you later want this on a phone and a laptop at once, you will have to move.",
        },
        {
          key: "hosted",
          label: "A hosted database",
          explanation: "Run by someone else and reachable from anywhere.",
          tradeoffs: "Around 7 a month, and one more account to manage.",
        },
      ],
      affects_requirements: ["REQ-001"],
    },
    notes: [
      "type is product or engineering.",
      "Two options at least, each with an explanation a non-coder can read and a real trade-off.",
      "This decides nothing. The user chooses: " +
        `${cmd("decide confirm D001 --choice sqlite --by <name> --rationale <why> --adr <file.md>")}`,
      "affects_requirements must name requirements that exist.",
    ],
  },

  "task-report": {
    what: "What the agent says it did. Recorded as a claim; it moves nothing towards verified.",
    used_by: "task report --from",
    body: {
      result: "REPORTED",
      files_touched: ["src/expenses.ts", "src/expenses.test.ts"],
      tests: { run: 4, passed: 4, failed: 0 },
      notes: "Added the expense table and its tests.",
      new_decisions_requested: [],
    },
    notes: [
      "result is REPORTED, ABORTED or STOPPED_BY_CONDITION.",
      "Nothing here can mark work verified. That needs a check MICHI ran itself.",
      "new_decisions_requested is how an agent says it hit a choice nobody has made.",
    ],
  },

  "test-record": {
    what: "A result only the agent saw — a manual check, a screenshot. Kept apart from what MICHI ran.",
    used_by: "test --record",
    body: { kind: "TESTS", summary: "Ran the suite by hand: 4 passed.", passed: true },
    notes: [
      "kind is TESTS, LINT, TYPECHECK, BUILD, MANUAL or OTHER.",
      "Prefer " + cmd("test <id> --run <key>") + ": MICHI runs that itself and watches the result.",
      "Never record something you did not actually see.",
    ],
  },

  review: {
    what: "A code review's findings. Every finding names a file and a line, and says what to do.",
    used_by: "review --findings",
    body: {
      findings: [
        {
          file: "src/expenses.ts",
          line: 12,
          problem: "The amount is not validated before storing.",
          why: "A negative amount would be saved and shown as income.",
          fix: "Reject an amount that is not positive, with a clear error.",
        },
      ],
    },
    notes: [
      "The verdict is a flag, not part of this file: --verdict PASS or --verdict CHANGES_REQUIRED.",
      "CHANGES_REQUIRED with no findings is refused. If you cannot say what is wrong, you have no verdict.",
      "Pass an empty list for a clean review: { \"findings\": [] }",
    ],
  },

  verify: {
    what: "Each acceptance criterion, addressed, with a reason and the evidence it rests on.",
    used_by: "verify --from",
    body: {
      criteria: [
        {
          id: "AC-001",
          status: "SATISFIED",
          reason: "The suite covers saving and reading an expense back.",
          evidence: ["TESTS"],
        },
      ],
    },
    notes: [
      "status is SATISFIED, UNSATISFIED or NOT_APPLICABLE. Every criterion must appear.",
      "ids come from " + cmd("task show <id>") + " — not from you.",
      "This refuses unless MICHI has observed at least one passing check itself. " +
        "An agent's own report of its own work is a claim, and there is no override.",
    ],
  },
};

export function exampleNames(): string[] {
  return Object.keys(EXAMPLES);
}

export interface ExampleData {
  name: string;
  what: string;
  used_by: string;
  json: string;
  notes: string[];
}

export function example(options: { name: string }): Result<ExampleData> {
  try {
    const found = EXAMPLES[options.name];
    if (!found) {
      throw new MichiError({
        class: "UNKNOWN", code: "NOT_FOUND",
        message: `There is no example called "${options.name}".`,
        detail: { known: exampleNames() },
        next: `Try one of: ${exampleNames().join(", ")}`,
      });
    }
    return ok({
      name: options.name,
      what: found.what,
      used_by: found.used_by,
      json: JSON.stringify(found.body, null, 2),
      notes: [...found.notes],
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
