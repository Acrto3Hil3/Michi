import * as vscode from "vscode";
import {
  michi, nodeExec, isSetUp, statusBarText, agentChoices, agentDetail,
} from "./cli.js";
import type { AgentRow, RunResult, StatusData } from "./cli.js";
import { cliNeedsUpdate, MINIMUM_CLI } from "./version.js";
import { resolveCli, describeSource } from "./resolve.js";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * MICHI for VS Code.
 *
 * A thin client. It runs the CLI and shows what came back; it holds no
 * knowledge of agents, requirements or readiness of its own. The CLI already
 * writes plain-language errors with a next step, so this passes them through
 * rather than replacing them with something vaguer.
 *
 * It writes nothing without being asked. Setting MICHI up, connecting an
 * agent and installing files are all behind an explicit yes, and "Never for
 * this project" is remembered.
 */

const DECLINED = "michi.declinedSetup";
const CLI_PACKAGE = "@dev-subhash/michi";
const UPDATE_COMMAND = `npm install -g ${CLI_PACKAGE}@latest`;

/** Resolved once per activation; the answer cannot change mid-session. */
let cli: ReturnType<typeof resolveCli> | undefined;

function onPath(): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", ["michi"],
      { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function resolve(context: vscode.ExtensionContext): ReturnType<typeof resolveCli> {
  if (!cli) {
    cli = resolveCli({
      setting: vscode.workspace.getConfiguration("michi").get<string>("path") ?? "",
      onPath,
      bundled: join(context.extensionPath, "dist", "cli", "michi.mjs"),
    });
  }
  return cli;
}

function folder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

/** Show a failure in the CLI's own words, with its own next step as an action. */
async function report(result: RunResult<unknown>, what: string): Promise<void> {
  if (result.missing) {
    // MICHI ships inside this extension, so this means the resolved command
    // could not run at all — a michi.path pointing at nothing, usually.
    const where = resolved ? describeSource(resolved.source) : "MICHI";
    const picked = await vscode.window.showErrorMessage(
      `Could not run ${where}.`,
      { modal: false, detail: result.message ?? "" },
      "Open settings", "Open docs");
    if (picked === "Open settings") {
      await vscode.commands.executeCommand("workbench.action.openSettings", "michi.path");
    } else if (picked === "Open docs") {
      await vscode.env.openExternal(vscode.Uri.parse("https://github.com/Acrto3Hil3/Michi#readme"));
    }
    return;
  }
  const message = result.message ?? `${what} did not work.`;
  if (result.next) {
    const copy = "Copy next step";
    const picked = await vscode.window.showWarningMessage(message, { detail: result.next, modal: false }, copy);
    if (picked === copy) await vscode.env.clipboard.writeText(result.next);
  } else {
    vscode.window.showWarningMessage(message);
  }
}

let resolved: ReturnType<typeof resolveCli> | undefined;

async function run<T>(args: string[]): Promise<RunResult<T>> {
  const at = folder();
  if (!at) return { ok: false, message: "Open a project folder first." };
  if (!resolved) return { ok: false, message: "MICHI has not finished starting up." };
  return michi<T>(nodeExec, resolved, at.uri.fsPath, args);
}

/**
 * Ask which agent, then install for it.
 *
 * Detected agents come first, every adapter stays on the list, and nothing is
 * written until something is picked — detection proposes and the user decides.
 */
async function connectAgent(): Promise<void> {
  const found = await run<{ agents: AgentRow[] }>(["agents"]);
  if (!found.ok || !found.data) return report(found, "Looking for coding agents");

  const picked = await vscode.window.showQuickPick(
    agentChoices(found.data.agents).map((a) => ({
      label: a.present && a.id !== "manual" ? `$(check) ${a.name}` : a.name,
      description: a.id,
      detail: agentDetail(a),
      id: a.id,
    })),
    {
      title: "Which coding agent should MICHI set itself up for?",
      placeHolder: "MICHI will write that agent's instruction files. Nothing else is touched.",
      ignoreFocusOut: true,
    },
  );
  if (!picked) return;

  const planned = await run<{ would_write: string[]; unchanged: string[] }>(
    ["--dry-run", "install", "--agent", picked.id]);
  if (!planned.ok || !planned.data) return report(planned, "Planning the install");

  const toWrite = planned.data.would_write;
  if (toWrite.length === 0) {
    vscode.window.showInformationMessage(`${picked.label} is already set up. Nothing to write.`);
    return;
  }

  // Show the files before writing any of them. The user is entitled to see
  // what is about to go into their repository.
  const go = await vscode.window.showInformationMessage(
    `Write ${toWrite.length} file${toWrite.length === 1 ? "" : "s"} for ${picked.description}?`,
    { modal: true, detail: toWrite.join("\n") },
    "Write them",
  );
  if (go !== "Write them") return;

  const done = await run<{ written: string[] }>(["install", "--agent", picked.id]);
  if (!done.ok) return report(done, "Installing");
  vscode.window.showInformationMessage(
    `MICHI is connected to ${picked.description}. Talk to your agent as usual — it knows what to do.`);
}

async function setUp(): Promise<void> {
  const at = folder();
  if (!at) { vscode.window.showWarningMessage("Open a project folder first."); return; }
  if (isSetUp(at.uri.fsPath)) return connectAgent();

  const go = await vscode.window.showInformationMessage(
    "Set MICHI up in this project?",
    {
      modal: true,
      detail:
        "It creates a .michi folder: plain text files holding what this project " +
        "decides and why. Nothing else is touched, and none of your code is changed.",
    },
    "Set it up",
  );
  if (go !== "Set it up") return;

  const started = await run<unknown>(["init"]);
  if (!started.ok) return report(started, "Setting MICHI up");
  await connectAgent();
}

/**
 * Say once, per CLI version, when the CLI is behind what this extension calls.
 *
 * Checking every activation and telling someone every time is how a prompt
 * gets ignored and then disabled. Once per version they actually have is
 * enough to be useful and not enough to be a nuisance.
 */
async function checkCli(context: vscode.ExtensionContext): Promise<void> {
  // Only the user's own install can be out of date. The bundled one ships
  // with this extension, so warning about it would be warning about us.
  if (resolved?.source === "bundled") return;
  const found = await run<{ version?: string }>(["--version"]);
  // --version does not emit an envelope, so read it off the raw text instead.
  const version = typeof found.data === "string" ? found.data : undefined;
  if (!cliNeedsUpdate(version)) return;

  const told = `michi.toldAbout.${version}`;
  if (context.globalState.get<boolean>(told)) return;
  await context.globalState.update(told, true);

  const copy = "Copy update command";
  const picked = await vscode.window.showWarningMessage(
    `MICHI ${version} is older than this extension expects (${MINIMUM_CLI}).`,
    { detail: `Some commands may not exist yet in your CLI.`, modal: false },
    copy,
  );
  if (picked === copy) {
    await vscode.env.clipboard.writeText(UPDATE_COMMAND);
    vscode.window.showInformationMessage(`Copied: ${UPDATE_COMMAND}`);
  }
}

async function showStatus(): Promise<void> {
  const status = await run<StatusData>(["status"]);
  if (!status.ok || !status.data) return report(status, "Reading the status");

  const { stage, needs_you } = status.data;
  if (needs_you.length === 0) {
    vscode.window.showInformationMessage(`MICHI: ${stage.toLowerCase()}. Nothing is waiting on you.`);
    return;
  }
  const picked = await vscode.window.showQuickPick(
    needs_you.map((item) => ({ label: item })),
    { title: `MICHI — ${stage.toLowerCase()}`, placeHolder: "What needs you. Pick one to copy its command." },
  );
  if (!picked) return;
  const command = /run: (michi [^\s].*)$/.exec(picked.label)?.[1];
  if (command) {
    await vscode.env.clipboard.writeText(command);
    vscode.window.showInformationMessage(`Copied: ${command}`);
  }
}

async function explain(): Promise<void> {
  const id = await vscode.window.showInputBox({
    title: "Explain what?",
    prompt: "A decision (D001), a requirement (REQ-001), a task (TASK-001) or a file path.",
    placeHolder: "D001",
  });
  if (!id) return;

  const answer = await run<{ title: string; paragraphs: string[]; not_recorded: string[] }>(
    ["explain", id, "--simple"]);
  if (!answer.ok || !answer.data) return report(answer, `Explaining ${id}`);

  const body = [
    `# ${answer.data.title}`, "",
    ...answer.data.paragraphs.flatMap((p) => [p, ""]),
    ...(answer.data.not_recorded.length > 0
      ? ["---", "", "Not recorded, so MICHI will not guess:", "",
         ...answer.data.not_recorded.map((g) => `- ${g}`)]
      : []),
  ].join("\n");

  const doc = await vscode.workspace.openTextDocument({ content: body, language: "markdown" });
  await vscode.window.showTextDocument(doc, { preview: true });
}

export function activate(context: vscode.ExtensionContext): void {
  // The CLI ships inside this extension, so there is nothing for anyone to
  // install first. A michi they installed themselves still wins.
  resolved = resolve(context);
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  bar.command = "michi.status";
  bar.tooltip = "MICHI — what needs you";
  context.subscriptions.push(bar);

  const refresh = async (): Promise<void> => {
    const at = folder();
    if (!at || !isSetUp(at.uri.fsPath)) { bar.hide(); return; }
    const status = await run<StatusData>(["status"]);
    bar.text = statusBarText(status.ok ? status.data : undefined);
    bar.show();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("michi.setup", async () => { await setUp(); await refresh(); }),
    vscode.commands.registerCommand("michi.connectAgent", async () => { await connectAgent(); await refresh(); }),
    vscode.commands.registerCommand("michi.status", showStatus),
    vscode.commands.registerCommand("michi.explain", explain),
  );

  // .michi is plain text under version control, so it changes when the user
  // pulls, when their agent runs a command, and when they edit it by hand.
  const watcher = vscode.workspace.createFileSystemWatcher("**/.michi/state/state.yaml");
  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);
  context.subscriptions.push(watcher);

  void refresh();
  void checkCli(context);
  void offerSetup(context);
}

/**
 * Offer, once, in a project that does not have MICHI.
 *
 * Asking every time a folder opens is how an extension becomes something
 * people disable. One ask, and "Never for this project" is remembered.
 */
async function offerSetup(context: vscode.ExtensionContext): Promise<void> {
  const at = folder();
  if (!at || isSetUp(at.uri.fsPath)) return;
  if (!vscode.workspace.getConfiguration("michi").get<boolean>("offerSetup", true)) return;
  if (context.workspaceState.get<boolean>(DECLINED)) return;

  const picked = await vscode.window.showInformationMessage(
    "MICHI can turn an idea into requirements and a precise brief for your coding agent.",
    "Set it up", "Not now", "Never for this project",
  );
  if (picked === "Set it up") await setUp();
  else if (picked === "Never for this project") await context.workspaceState.update(DECLINED, true);
}

export function deactivate(): void {
  // Nothing to tear down: the CLI owns all the state, and it is on disk.
}
