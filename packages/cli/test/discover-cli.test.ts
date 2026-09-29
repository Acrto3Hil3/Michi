import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/run.js";

const made: string[] = [];
function project(): string {
  const root = mkdtempSync(join(tmpdir(), "michi-d-"));
  made.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"shop"}', "utf8");
  return root;
}
afterEach(() => { while (made.length) { const d = made.pop(); if (d) rmSync(d, { recursive: true, force: true }); } });

const NOW = "2026-09-29T10:00:00.000Z";

async function cli(args: string[], root: string) {
  let out = "", err = "";
  const code = await run(["--project", root, ...args],
    { out: (s) => { out += s + "\n"; }, err: (s) => { err += s + "\n"; } },
    { now: () => NOW });
  return { code, out, err };
}
const json = (c: { out: string }) => JSON.parse(c.out);

function file(root: string, name: string, data: unknown): string {
  const p = join(root, name);
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data), "utf8");
  return p;
}

describe("michi discover — cli", () => {
  it("exits 3 before init", async () => {
    expect((await cli(["discover", "start"], project())).code).toBe(3);
  });

  it("starts a session and says what to do next", async () => {
    const root = project();
    await cli(["init"], root);
    const r = await cli(["discover", "start"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/SESSION-001/);
    expect(r.out.toLowerCase()).toMatch(/next/);
  });

  it("exits 8 when answering with no session open", async () => {
    const root = project();
    await cli(["init"], root);
    const r = await cli(["discover", "answer", "--file", file(root, "u.json", { answers: [] })], root);
    expect(r.code).toBe(8);
  });

  it("exits 2 when --file is missing", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["discover", "start"], root);
    expect((await cli(["discover", "answer"], root)).code).toBe(2);
  });

  it("exits 4 on an invalid update and names the problem", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["discover", "start"], root);
    const bad = file(root, "u.json", { confirm: { requirements: ["REQ-001"] } });
    const r = await cli(["discover", "answer", "--file", bad, "--json"], root);
    expect(r.code).toBe(4);
    expect(json(r).error.message.toLowerCase()).toMatch(/by/);
  });

  it("shows what is known, assumed and unknown", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["discover", "start"], root);
    await cli(["discover", "answer", "--file", file(root, "u.json", {
      intent: { problem: { value: "They lose stock", confidence: "STATED" },
                users: { value: ["owner"], confidence: "INFERRED" } },
    })], root);
    const r = await cli(["discover", "status"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/They lose stock/);
    expect(r.out.toLowerCase()).toMatch(/still unknown|not established|unknown/);
  });

  it("exits 7 when closing an unconfirmed session", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["discover", "start"], root);
    const r = await cli(["discover", "close"], root);
    expect(r.code).toBe(7);
  });

  it("export is stable and writes nothing", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["discover", "start"], root);
    const a = await cli(["discover", "export", "--json"], root);
    const b = await cli(["discover", "export", "--json"], root);
    expect(a.out).toBe(b.out);
    expect(a.code).toBe(0);
  });
});

describe("michi decide — cli", () => {
  const PROPOSAL = {
    title: "How people log in", type: "engineering", category: "authentication",
    options: [
      { key: "managed", label: "A login service", explanation: "Someone else holds the passwords.", tradeoffs: "Costs money at scale." },
      { key: "passwords", label: "Email and password", explanation: "You hold the passwords.", tradeoffs: "You carry the risk." },
    ],
  };

  it("lists nothing on a fresh project without failing", async () => {
    const root = project();
    await cli(["init"], root);
    const r = await cli(["decide"], root);
    expect(r.code).toBe(0);
    expect(r.out.toLowerCase()).toMatch(/no decisions/);
  });

  it("proposes, then confirms, then refuses a silent change", async () => {
    const root = project();
    await cli(["init"], root);

    const p = await cli(["decide", "propose", "--file", file(root, "p.json", PROPOSAL), "--json"], root);
    expect(p.code).toBe(0);
    expect(json(p).data.decision.id).toBe("D001");

    const adr = file(root, "adr.md", "Because it removes most of the ways we could get this wrong.");
    const c = await cli(["decide", "confirm", "D001", "--choice", "managed", "--by", "user", "--rationale", "Least risk", "--adr", adr], root);
    expect(c.code).toBe(0);
    expect(c.out).toMatch(/ADR-001/);
    expect(existsSync(join(root, ".michi/decisions/ADR-001-how-people-log-in.md"))).toBe(true);

    const again = await cli(["decide", "confirm", "D001", "--choice", "passwords", "--by", "user", "--rationale", "x", "--adr", adr, "--json"], root);
    expect(again.code).toBe(7);
    expect(json(again).error.next).toMatch(/supersede/i);
  });

  it("exits 8 for a decision that does not exist", async () => {
    const root = project();
    await cli(["init"], root);
    expect((await cli(["decide", "show", "D404"], root)).code).toBe(8);
  });

  it("shows a locked decision in plain language", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["decide", "propose", "--file", file(root, "p.json", PROPOSAL)], root);
    await cli(["decide", "confirm", "D001", "--choice", "managed", "--by", "user", "--rationale", "Least risk",
               "--adr", file(root, "adr.md", "Reasoning here.")], root);
    const r = await cli(["decide", "show", "D001"], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/A login service/);
    expect(r.out).toMatch(/user/);
  });

  it("surfaces an open decision in michi status", async () => {
    const root = project();
    await cli(["init"], root);
    await cli(["decide", "propose", "--file", file(root, "p.json", PROPOSAL)], root);
    const r = await cli(["status"], root);
    expect(r.out).toMatch(/Needs you/);
    expect(r.out).toMatch(/decision/i);
  });
});
