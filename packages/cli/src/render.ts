/**
 * Human rendering.
 *
 * Both renderings are projections of the same typed result (Phase 1.6), so
 * nothing here may know something the JSON does not. Short, plain language,
 * and always ending with what needs the person (CLI_CONTRACT.md, P11).
 */
import type { InitData, ScanData, StatusData, Detection } from "@michi/core";
import { cmd } from "@michi/core";

const bullet = (s: string) => `  ${s}`;

function describe(label: string, d: Detection<string | string[]>): string {
  if (d.confidence === "UNKNOWN") {
    return bullet(`${label.padEnd(16)} not known${d.note ? ` — ${d.note}` : ""}`);
  }
  const value = Array.isArray(d.value) ? d.value.join(", ") : String(d.value);
  const qualifier = d.confidence === "INFERRED" ? " (a guess from convention)" : "";
  return bullet(`${label.padEnd(16)} ${value}${qualifier}`);
}

function detectionLines(detections: StatusData["detected"]): string[] {
  if (!detections) return [bullet("MICHI has not looked at your code yet.")];
  const d = detections.detections;
  return [
    describe("Project type", d.project_type),
    describe("Language", d.languages),
    describe("Package manager", d.package_manager),
    describe("Runtime", d.runtime),
    describe("Frameworks", d.frameworks),
    describe("Database", d.database),
    describe("Data layer", d.orm),
    describe("Tests", d.test_framework),
    describe("Deployment", d.deployment),
  ];
}

export function renderInit(data: InitData): string[] {
  const lines: string[] = [];
  if (data.dry_run) {
    lines.push(`This is a dry run — nothing was written.`, "");
    lines.push(`MICHI would set up ${data.project.name} and create:`);
  } else {
    lines.push(`MICHI is set up for ${data.project.name}.`, "");
    lines.push(`Created in ${data.brain}:`);
  }
  for (const f of data.created) lines.push(bullet(f));
  if (data.kept.length > 0) {
    lines.push("", "Left alone because they already exist:");
    for (const f of data.kept) lines.push(bullet(f));
  }
  lines.push("", "What MICHI found in your project:");
  lines.push(...detectionLines({ generated_at: data.scan.generated_at, detections: data.scan.detections }));
  lines.push("", "Next:");
  lines.push(bullet(`Tell MICHI what you want to build — run: ${cmd("discover start")}`));
  return lines;
}

export function renderScan(data: ScanData): string[] {
  const lines: string[] = [
    data.changed
      ? "MICHI looked at your project and found changes since last time."
      : "MICHI looked at your project. Nothing has changed since the last scan.",
    "",
  ];
  lines.push(...detectionLines({ generated_at: data.map.generated_at, detections: data.map.detections }));
  lines.push("", `Files considered: ${data.map.stats.files_considered}`);
  return lines;
}

export function renderStatus(data: StatusData): string[] {
  const lines = [
    `MICHI PROJECT STATUS`,
    "",
    bullet(`Project           ${data.project.name}`),
    bullet(`Stage             ${data.stage}`),
    bullet(`Architecture      ${data.architecture_status}`),
    bullet(`Milestone         ${data.current_milestone ?? "none yet"}`),
    bullet(`Active task       ${data.active_task ?? "none"}`),
    bullet(
      `Last look at code ${data.last_scan ? data.last_scan.at : "never"}`,
    ),
    "",
    "What MICHI knows about your project:",
    ...detectionLines(data.detected),
  ];
  if (data.needs_you.length > 0) {
    lines.push("", "Needs you:");
    for (const item of data.needs_you) lines.push(bullet(item));
  }
  return lines;
}
