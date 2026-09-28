import { describe, it, expect } from "vitest";
import { tempProject, NOW } from "./helpers.js";
import { scanProject } from "../src/scan/scanner.js";

const scan = (files: Record<string, string> = {}) => scanProject(tempProject(files), NOW);

const pkg = (o: object) => JSON.stringify(o);

describe("scanner — what it can establish", () => {
  it("detects the package manager from a lockfile, citing it", () => {
    const m = scan({ "package.json": pkg({ name: "a" }), "pnpm-lock.yaml": "" });
    expect(m.detections.package_manager.value).toBe("pnpm");
    expect(m.detections.package_manager.confidence).toBe("DETECTED");
    expect(m.detections.package_manager.sources).toEqual(["pnpm-lock.yaml"]);
  });

  it("prefers an explicit packageManager field over a lockfile", () => {
    const m = scan({
      "package.json": pkg({ name: "a", packageManager: "yarn@4.0.0" }),
      "pnpm-lock.yaml": "",
    });
    expect(m.detections.package_manager.value).toBe("yarn");
    expect(m.detections.package_manager.sources).toEqual(["package.json:packageManager"]);
  });

  it("detects TypeScript from tsconfig.json", () => {
    const m = scan({ "package.json": pkg({ name: "a" }), "tsconfig.json": "{}" });
    expect(m.detections.languages.value).toEqual(["TypeScript"]);
    expect(m.detections.languages.confidence).toBe("DETECTED");
  });

  it("only infers JavaScript when there is a manifest but no tsconfig", () => {
    const m = scan({ "package.json": pkg({ name: "a" }) });
    expect(m.detections.languages.value).toEqual(["JavaScript"]);
    expect(m.detections.languages.confidence).toBe("INFERRED");
    expect(m.detections.languages.note).toMatch(/no tsconfig/);
  });

  it("detects frameworks, database, ORM and test framework from dependencies", () => {
    const m = scan({
      "package.json": pkg({
        name: "a",
        dependencies: { react: "18", express: "4", pg: "8", "drizzle-orm": "0.3" },
        devDependencies: { vitest: "2" },
      }),
    });
    expect(m.detections.frameworks.value).toEqual(["Express", "React"]);
    expect(m.detections.database.value).toBe("PostgreSQL");
    expect(m.detections.orm.value).toBe("Drizzle");
    expect(m.detections.test_framework.value).toBe("Vitest");
    expect(m.detections.database.sources).toContain("package.json:pg");
  });

  it("detects Prisma from its schema file", () => {
    const m = scan({
      "package.json": pkg({ name: "a" }),
      "prisma/schema.prisma": "datasource db {}",
    });
    expect(m.detections.orm.value).toBe("Prisma");
    expect(m.detections.orm.sources).toEqual(["prisma/schema.prisma"]);
  });

  it("detects deployment indicators from files and CI", () => {
    const m = scan({
      "package.json": pkg({ name: "a" }),
      Dockerfile: "FROM node",
      ".github/workflows/ci.yml": "on: push",
    });
    expect(m.detections.deployment.value).toEqual(["Docker", "GitHub Actions"]);
  });

  it("recognises non-Node projects", () => {
    expect(scan({ "pyproject.toml": "" }).detections.project_type.value).toBe("python");
    expect(scan({ "Cargo.toml": "" }).detections.project_type.value).toBe("rust");
    expect(scan({ "go.mod": "" }).detections.project_type.value).toBe("go");
  });
});

describe("scanner — what it refuses to guess", () => {
  it("reports an empty directory as unknown throughout", () => {
    const m = scan();
    for (const key of ["project_type", "package_manager", "database", "orm",
                       "test_framework", "frameworks", "deployment", "runtime"] as const) {
      expect(m.detections[key].confidence).toBe("UNKNOWN");
      expect(m.detections[key].value).toBeNull();
    }
  });

  it("does not guess a package manager from a manifest alone", () => {
    const m = scan({ "package.json": pkg({ name: "a" }) });
    expect(m.detections.package_manager.confidence).toBe("UNKNOWN");
    expect(m.detections.package_manager.note).toMatch(/no lockfile/);
  });

  it("does not guess a database just because an ORM is present", () => {
    const m = scan({ "package.json": pkg({ name: "a", dependencies: { "drizzle-orm": "0.3" } }) });
    expect(m.detections.orm.value).toBe("Drizzle");
    expect(m.detections.database.confidence).toBe("UNKNOWN");
  });

  it("treats an unparseable manifest as a fact, not a crash", () => {
    const m = scan({ "package.json": "{ this is not json" });
    expect(m.detections.project_type.confidence).toBe("UNKNOWN");
    expect(m.detections.project_type.note).toMatch(/could not be parsed/);
  });

  it("every detection carries a confidence and its sources", () => {
    const m = scan({ "package.json": pkg({ name: "a", dependencies: { react: "18" } }) });
    for (const d of Object.values(m.detections)) {
      expect(["DETECTED", "INFERRED", "UNKNOWN"]).toContain(d.confidence);
      expect(Array.isArray(d.sources)).toBe(true);
      if (d.confidence === "UNKNOWN") expect(d.sources).toEqual([]);
      else expect(d.sources.length).toBeGreaterThan(0);
    }
  });
});

describe("scanner — structure and determinism", () => {
  it("ignores build output and dependency directories", () => {
    const m = scan({
      "package.json": pkg({ name: "a" }),
      "src/index.ts": "",
      "node_modules/x/index.js": "",
      "dist/index.js": "",
      ".git/HEAD": "",
    });
    expect(m.structure.directories).toEqual(["src"]);
  });

  it("does not count ignored directories in the files it considered", () => {
    const bare = scan({ "package.json": "{}" });
    const noisy = scan({
      "package.json": "{}",
      "node_modules/x/index.js": "",
      "dist/out.js": "",
      ".michi/config.yaml": "",
    });
    expect(noisy.stats.files_considered).toBe(bare.stats.files_considered);
  });

  it("produces byte-identical output for the same repository", () => {
    const files = {
      "package.json": pkg({ name: "a", dependencies: { react: "18", express: "4" } }),
      "tsconfig.json": "{}",
      "pnpm-lock.yaml": "",
      "src/index.ts": "",
    };
    const root = tempProject(files);
    expect(JSON.stringify(scanProject(root, NOW))).toBe(JSON.stringify(scanProject(root, NOW)));
  });

  it("records entry points from the manifest and conventional locations", () => {
    const m = scan({
      "package.json": pkg({ name: "a", main: "./lib/main.js", bin: { a: "./bin/a.js" } }),
      "src/index.ts": "",
    });
    expect(m.structure.entry_points).toEqual(["./bin/a.js", "./lib/main.js", "src/index.ts"]);
  });
});
