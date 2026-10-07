import { Command, CommanderError } from "commander";
import {
  ExitCode, IDENTITY, MichiError, errorPayload, exitCodeFor, init, scan, status,
  discoverStart, discoverStatus, discoverAnswer, discoverExport, discoverClose,
  decideList, decideShow, decidePropose, decideConfirm, decideReject, decideSupersede,
  planStatus, planUpdate, planExport, planClose,
  architectureStatus, architectureExport, architectureClose,
  resolveContext, buildGraph, orphans, coverage,
  planTasks, planValidate, taskList, taskShow, taskNext, taskStart, taskReport, taskBlock,
  taskDone,
  runTest, recordTest, review, debugStage, verify, DEBUG_STAGES,
} from "@michi/core";
import type { Result } from "@michi/core";
import {
  renderInit, renderScan, renderStatus,
  renderDiscoverStart, renderDiscoverAnswer, renderDiscoverStatus, renderDiscoverClose,
  renderDecideList, renderDecision, renderDecideShow, renderSupersede,
  renderPlanStatus, renderPlanUpdate, renderPlanClose,
  renderArchitectureStatus, renderArchitectureClose,
  renderContext, renderGraph, renderGraphMermaid, renderOrphans,
  renderPlanTasks, renderPlanValidate, renderTaskList, renderTaskShow,
  renderTaskNext, renderTaskStart, renderTaskReport, renderTaskBlock, renderTaskDone,
  renderTest, renderReview, renderDebug, renderVerify,
} from "./render.js";

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export interface Env {
  cwd?: string;
  now?: () => string;
}

interface GlobalOpts {
  json?: boolean;
  quiet?: boolean;
  project?: string;
  dryRun?: boolean;
}

/**
 * In --json mode the whole envelope goes to stdout, success or failure: an
 * agent reads one stream, and splitting it across two is how integrations
 * start losing errors.
 */
function emit<T>(
  result: Result<T>,
  opts: GlobalOpts,
  io: Io,
  human: (data: T) => string[],
): number {
  if (opts.json) {
    io.out(JSON.stringify(result, null, 2));
    return result.ok ? ExitCode.SUCCESS : exitCodeFor(result.error.code);
  }
  if (!result.ok) {
    io.err(result.error.message);
    if (result.error.next) io.err(result.error.next);
    return exitCodeFor(result.error.code);
  }
  if (!opts.quiet) for (const line of human(result.data)) io.out(line);
  return ExitCode.SUCCESS;
}

export async function run(argv: string[], io: Io, env: Env = {}): Promise<number> {
  const now = env.now ?? (() => new Date().toISOString());
  const program = new Command();
  let code: number = ExitCode.SUCCESS;

  program
    .name(IDENTITY.binary)
    .description(
      `${IDENTITY.displayName} — the path from idea to software.\n\n` +
        `Turns what you want into engineering decisions your AI coding agent can follow.`,
    )
    .version(IDENTITY.version)
    .option("--json", "machine-readable output")
    .option("--quiet", "errors only")
    .option("--no-color", "disable coloured output")
    .option("--project <path>", "project root (default: the current folder)")
    .option("--dry-run", "show what would change and write nothing")
    .exitOverride()
    .configureOutput({
      writeOut: (s) => io.out(s.replace(/\n$/, "")),
      writeErr: (s) => io.err(s.replace(/\n$/, "")),
    });

  const root = (): string => program.opts<GlobalOpts>().project ?? env.cwd ?? process.cwd();
  const opts = (): GlobalOpts => program.opts<GlobalOpts>();

  program
    .command("init")
    .description("set MICHI up in this project")
    .option("--force", "restore missing MICHI files without overwriting anything")
    .action((local: { force?: boolean }) => {
      const g = opts();
      code = emit(
        init({
          root: root(),
          now,
          force: local.force ?? false,
          dryRun: g.dryRun ?? false,
        }),
        g,
        io,
        renderInit,
      );
    });

  program
    .command("scan")
    .description("look at the project and record what is actually there")
    .action(() => {
      code = emit(scan({ root: root(), now }), opts(), io, renderScan);
    });

  program
    .command("status")
    .description("where the project stands, and what needs you")
    .action(() => {
      code = emit(status({ root: root(), now }), opts(), io, renderStatus);
    });

  // -------------------------------------------------------------------------
  // discover — structured operations only. The conversation happens a layer up.
  // -------------------------------------------------------------------------
  const discover = program
    .command("discover")
    .description("turn what the user wants into structured engineering state");

  discover
    .command("start")
    .description("open a discovery session, or resume the open one")
    .action(() => {
      code = emit(discoverStart({ root: root(), now }), opts(), io, renderDiscoverStart);
    });

  discover
    .command("status")
    .description("what is known, what is assumed, and what is still unknown")
    .action(() => {
      code = emit(discoverStatus({ root: root(), now }), opts(), io, renderDiscoverStatus);
    });

  discover
    .command("answer")
    .description("record what a turn of conversation established")
    .requiredOption("--file <path>", "the discovery update, as JSON")
    .action((local: { file: string }) => {
      code = emit(
        discoverAnswer({ root: root(), now, file: local.file }), opts(), io, renderDiscoverAnswer,
      );
    });

  discover
    .command("export")
    .description("emit the discovery result; writes nothing")
    .action(() => {
      code = emit(discoverExport({ root: root(), now }), opts(), io, renderDiscoverStatus);
    });

  discover
    .command("close")
    .description("write the confirmed requirements and move on to specification")
    .action(() => {
      code = emit(discoverClose({ root: root(), now }), opts(), io, renderDiscoverClose);
    });

  // -------------------------------------------------------------------------
  // plan — product planning. The task DAG arrives in a later phase.
  // -------------------------------------------------------------------------
  const plan = program
    .command("plan")
    .description("decide what gets built first, for whom, and how we will know it works")
    .action(() => {
      code = emit(planStatus({ root: root(), now }), opts(), io, renderPlanStatus);
    });

  plan
    .command("status")
    .description("what the specification has, what it lacks, and what needs the user")
    .action(() => {
      code = emit(planStatus({ root: root(), now }), opts(), io, renderPlanStatus);
    });

  plan
    .command("update")
    .description("record what a turn of product planning established")
    .requiredOption("--file <path>", "the planning update, as JSON")
    .action((local: { file: string }) => {
      code = emit(
        planUpdate({ root: root(), now, file: local.file }), opts(), io, renderPlanUpdate,
      );
    });

  plan
    .command("export")
    .description("emit the specification; writes nothing")
    .action(() => {
      code = emit(planExport({ root: root(), now }), opts(), io, renderPlanStatus);
    });

  plan
    .command("close")
    .description("write the PRD and move on to architecture")
    .action(() => {
      code = emit(planClose({ root: root(), now }), opts(), io, renderPlanClose);
    });

  plan
    .command("tasks")
    .description("plan the work the agreed architecture now makes possible")
    .option("--from-requirements", "seed one task per first-version requirement")
    .option("--file <path>", "a task plan, as JSON")
    .action((local: { fromRequirements?: boolean; file?: string }) => {
      if (!local.fromRequirements && !local.file) {
        io.err("Give either --from-requirements or --file <plan.json>.");
        code = ExitCode.USAGE_ERROR;
        return;
      }
      code = emit(
        planTasks({
          root: root(), now,
          ...(local.file ? { file: local.file } : { fromRequirements: true }),
        }),
        opts(), io, renderPlanTasks,
      );
    });

  plan
    .command("validate")
    .description("check the plan can actually be executed before anyone builds against it")
    .action(() => {
      const result = planValidate({ root: root(), now });
      code = emit(result, opts(), io, renderPlanValidate);
      // A plan with problems is a failure, even though reading it succeeded.
      if (result.ok && !result.data.ok) code = ExitCode.CONFLICT;
    });

  // -------------------------------------------------------------------------
  // context — what an agent actually needs for one piece of work
  // -------------------------------------------------------------------------
  program
    .command("context <focus>")
    .description("resolve the project knowledge needed to work on one requirement")
    .option("--budget <tokens>", "cap the estimated context size")
    .option("--explain", "list everything that was left out, and why")
    .option("--include <ids>", "comma-separated ids to pull in regardless")
    .option("--exclude <ids>", "comma-separated ids to withhold")
    .action((focus: string, local: {
      budget?: string; explain?: boolean; include?: string; exclude?: string;
    }) => {
      const list = (value?: string) =>
        value ? value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) : [];
      const request: Record<string, unknown> = {
        focus: { type: "requirement", id: focus },
        include: list(local.include),
        exclude: list(local.exclude),
      };
      if (local.budget !== undefined) request.budget_tokens = Number(local.budget);

      code = emit(
        resolveContext({ root: root(), now, request }), opts(), io,
        (packet) => renderContext(packet, local.explain ?? false),
      );
    });

  // -------------------------------------------------------------------------
  // graph — a read-only view over canonical state
  // -------------------------------------------------------------------------
  const graph = program
    .command("graph")
    .description("how this project's requirements, decisions and criteria connect")
    .argument("[node]", "focus on one node")
    .option("--format <kind>", "text, json or mermaid", "text")
    .action((nodeId: string | undefined, local: { format: string }) => {
      try {
        const g = buildGraph(root());
        if (opts().json || local.format === "json") {
          io.out(JSON.stringify(g, null, 2));
        } else if (local.format === "mermaid") {
          for (const line of renderGraphMermaid(g)) io.out(line);
        } else {
          for (const line of renderGraph(g, nodeId)) io.out(line);
        }
        code = ExitCode.SUCCESS;
      } catch (e) {
        const err = MichiError.from(e);
        if (opts().json) io.out(JSON.stringify(errorPayload(err), null, 2));
        else io.err(err.payload.message);
        code = err.exitCode;
      }
    });

  graph
    .command("orphans")
    .description("requirements with no decided approach, and none with a way to check them")
    .action(() => {
      try {
        const g = buildGraph(root());
        const data = { ungoverned: orphans(g, "REQUIREMENT", "GOVERNS"), uncovered: coverage(g) };
        if (opts().json) io.out(JSON.stringify({ ok: true, data }, null, 2));
        else for (const line of renderOrphans(data)) io.out(line);
        code = ExitCode.SUCCESS;
      } catch (e) {
        const err = MichiError.from(e);
        if (opts().json) io.out(JSON.stringify(errorPayload(err), null, 2));
        else io.err(err.payload.message);
        code = err.exitCode;
      }
    });

  graph
    .command("coverage")
    .description("requirements with no acceptance criterion proving them")
    .action(() => {
      try {
        const g = buildGraph(root());
        const data = { ungoverned: [] as string[], uncovered: coverage(g) };
        if (opts().json) io.out(JSON.stringify({ ok: true, data }, null, 2));
        else for (const line of renderOrphans(data)) io.out(line);
        code = ExitCode.SUCCESS;
      } catch (e) {
        const err = MichiError.from(e);
        if (opts().json) io.out(JSON.stringify(errorPayload(err), null, 2));
        else io.err(err.payload.message);
        code = err.exitCode;
      }
    });

  // -------------------------------------------------------------------------
  // architecture — a gate over the decisions, not a second decision system
  // -------------------------------------------------------------------------
  const architecture = program
    .command("architecture")
    .description("check that everything being built first has a decided approach")
    .action(() => {
      code = emit(architectureStatus({ root: root(), now }), opts(), io, renderArchitectureStatus);
    });

  architecture
    .command("status")
    .description("what is decided, what is waiting on the user, what has no approach yet")
    .action(() => {
      code = emit(architectureStatus({ root: root(), now }), opts(), io, renderArchitectureStatus);
    });

  architecture
    .command("export")
    .description("emit the architecture position; writes nothing")
    .action(() => {
      code = emit(architectureExport({ root: root(), now }), opts(), io, renderArchitectureStatus);
    });

  architecture
    .command("close")
    .description("write up how this gets built and move on to design")
    .action(() => {
      code = emit(architectureClose({ root: root(), now }), opts(), io, renderArchitectureClose);
    });

  // -------------------------------------------------------------------------
  // task — the work, and the handoff to an agent
  // -------------------------------------------------------------------------
  const task = program
    .command("task")
    .description("the planned work, and handing a piece of it to a coding agent");

  task
    .command("list")
    .description("every task and where it stands")
    .option("--status <state>", "only tasks in this state")
    .action((local: { status?: string }) => {
      code = emit(
        taskList({ root: root(), now, ...(local.status ? { status: local.status } : {}) }),
        opts(), io, renderTaskList,
      );
    });

  task
    .command("show <id>")
    .description("one task, its criteria and its handovers")
    .action((id: string) => {
      code = emit(taskShow({ root: root(), now, id }), opts(), io, renderTaskShow);
    });

  task
    .command("next")
    .description("the next piece of work whose dependencies are met and context resolves")
    .action(() => {
      code = emit(taskNext({ root: root(), now }), opts(), io, renderTaskNext);
    });

  task
    .command("start <id>")
    .description("hand a task to a coding agent, with the compiled instruction")
    .requiredOption("--agent <name>", "which agent is taking it")
    .action((id: string, local: { agent: string }) => {
      code = emit(
        taskStart({ root: root(), now, id, agent: local.agent }), opts(), io, renderTaskStart,
      );
    });

  task
    .command("report <id>")
    .description("record what the agent said it did — a claim, not evidence")
    .requiredOption("--from <path>", "the agent's report, as JSON")
    .action((id: string, local: { from: string }) => {
      code = emit(
        taskReport({ root: root(), now, id, file: local.from }), opts(), io, renderTaskReport,
      );
    });

  task
    .command("done <id>")
    .description("close a verified task and file it under tasks/completed")
    .action((id: string) => {
      code = emit(taskDone({ root: root(), now, id }), opts(), io, renderTaskDone);
    });

  task
    .command("block <id>")
    .description("record that a task cannot proceed, and why")
    .requiredOption("--reason <text>", "what is in the way")
    .action((id: string, local: { reason: string }) => {
      code = emit(
        taskBlock({ root: root(), now, id, reason: local.reason }), opts(), io, renderTaskBlock,
      );
    });

  // -------------------------------------------------------------------------
  // verification — evidence, not assurances
  // -------------------------------------------------------------------------
  program
    .command("test <id>")
    .description("run an allow-listed check, or record one the agent ran")
    .option("--run <key>", "a key in verification.allow — never a command")
    .option("--record <path>", "what the agent reported, as JSON")
    .action((id: string, local: { run?: string; record?: string }) => {
      if (!local.run && !local.record) {
        io.err("Give either --run <key> or --record <file>.");
        code = ExitCode.USAGE_ERROR;
        return;
      }
      code = emit(
        local.run
          ? runTest({ root: root(), now, id, key: local.run })
          : recordTest({ root: root(), now, id, file: local.record as string }),
        opts(), io, renderTest,
      );
    });

  program
    .command("review <id>")
    .description("record a review verdict and its findings")
    .requiredOption("--verdict <verdict>", "PASS or CHANGES_REQUIRED")
    .requiredOption("--findings <path>", "the findings, as JSON")
    .action((id: string, local: { verdict: string; findings: string }) => {
      if (local.verdict !== "PASS" && local.verdict !== "CHANGES_REQUIRED") {
        io.err("--verdict must be PASS or CHANGES_REQUIRED.");
        code = ExitCode.USAGE_ERROR;
        return;
      }
      code = emit(
        review({ root: root(), now, id, verdict: local.verdict, file: local.findings }),
        opts(), io, renderReview,
      );
    });

  program
    .command("debug <id>")
    .description("work a bug through reproduce, observe, hypothesis, root cause, fix, verify")
    .requiredOption("--stage <stage>", DEBUG_STAGES.join(" | "))
    .requiredOption("--note <text>", "what you did and what you saw")
    .action((id: string, local: { stage: string; note: string }) => {
      if (!(DEBUG_STAGES as readonly string[]).includes(local.stage)) {
        io.err(`--stage must be one of: ${DEBUG_STAGES.join(", ")}`);
        code = ExitCode.USAGE_ERROR;
        return;
      }
      code = emit(
        debugStage({
          root: root(), now, id,
          stage: local.stage as (typeof DEBUG_STAGES)[number],
          note: local.note,
        }),
        opts(), io, renderDebug,
      );
    });

  program
    .command("verify <id>")
    .description("weigh the evidence against the acceptance criteria — the only path to VERIFIED")
    .requiredOption("--from <path>", "the verdict on each criterion, as JSON")
    .action((id: string, local: { from: string }) => {
      code = emit(verify({ root: root(), now, id, file: local.from }), opts(), io, renderVerify);
    });

  // -------------------------------------------------------------------------
  // decide
  // -------------------------------------------------------------------------
  const decide = program
    .command("decide")
    .description("the choices this project has made, and why")
    .action(() => {
      code = emit(decideList({ root: root(), now }), opts(), io, renderDecideList);
    });

  decide
    .command("show <id>")
    .description("one decision and the record written up for it")
    .action((id: string) => {
      code = emit(decideShow({ root: root(), now, id }), opts(), io, renderDecideShow);
    });

  decide
    .command("propose")
    .description("put a choice to the user; decides nothing")
    .requiredOption("--file <path>", "the proposal, as JSON")
    .action((local: { file: string }) => {
      code = emit(
        decidePropose({ root: root(), now, file: local.file }), opts(), io, renderDecision,
      );
    });

  decide
    .command("confirm <id>")
    .description("record the user's choice and lock it")
    .requiredOption("--choice <key>", "the option the user picked")
    .requiredOption("--by <who>", "who approved it")
    .requiredOption("--rationale <text>", "why, in one sentence")
    .requiredOption("--adr <path>", "the written reasoning, as Markdown")
    .action((id: string, local: { choice: string; by: string; rationale: string; adr: string }) => {
      code = emit(
        decideConfirm({
          root: root(), now, id, choice: local.choice, by: local.by,
          rationale: local.rationale, adrFile: local.adr,
        }),
        opts(), io, renderDecision,
      );
    });

  decide
    .command("reject <id>")
    .description("record that the user said no")
    .requiredOption("--reason <text>", "why not")
    .action((id: string, local: { reason: string }) => {
      code = emit(
        decideReject({ root: root(), now, id, reason: local.reason }), opts(), io, renderDecision,
      );
    });

  decide
    .command("supersede <id>")
    .description("replace a locked decision with a newer locked one")
    .requiredOption("--with <id>", "the replacement decision")
    .action((id: string, local: { with: string }) => {
      code = emit(
        decideSupersede({ root: root(), now, id, withId: local.with }), opts(), io, renderSupersede,
      );
    });

  try {
    await program.parseAsync(argv, { from: "user" });
    return code;
  } catch (e) {
    if (e instanceof CommanderError) {
      // Help and version are a successful outcome, not a failure.
      if (e.exitCode === 0 || e.code === "commander.helpDisplayed" ||
          e.code === "commander.version") {
        return ExitCode.SUCCESS;
      }
      return ExitCode.USAGE_ERROR;
    }
    const err = MichiError.from(e);
    const payload = errorPayload(err);
    if (opts().json) io.out(JSON.stringify(payload, null, 2));
    else io.err(err.payload.message);
    return err.exitCode;
  }
}
