import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detection, Detections, ProjectMap } from "../schemas/scan.js";
import { detected, inferred, unknownDetection } from "../schemas/scan.js";
import { SCHEMA_VERSION } from "../schemas/version.js";
import { hashOf } from "../fs/canonical.js";

/**
 * A deliberately conservative scanner.
 *
 * It reports only what the repository states. Where evidence is absent the
 * answer is UNKNOWN, not a guess — a project map nobody can trust is worse
 * than a thin one, because every context packet downstream inherits the lie.
 */

const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".turbo", ".cache", ".michi", ".venv", "__pycache__",
]);

const LOCKFILES: Record<string, string> = {
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
  "bun.lock": "bun",
};

const FRAMEWORKS: Record<string, string> = {
  react: "React", next: "Next.js", vue: "Vue", svelte: "Svelte",
  "@angular/core": "Angular", astro: "Astro", "@remix-run/react": "Remix",
  express: "Express", fastify: "Fastify", "@nestjs/core": "NestJS",
  hono: "Hono", koa: "Koa", "@sveltejs/kit": "SvelteKit",
};

const DATABASES: Record<string, string> = {
  pg: "PostgreSQL", postgres: "PostgreSQL", mysql2: "MySQL", mysql: "MySQL",
  sqlite3: "SQLite", "better-sqlite3": "SQLite", mongodb: "MongoDB",
  redis: "Redis", ioredis: "Redis", "@libsql/client": "SQLite (libSQL)",
};

const ORMS: Record<string, string> = {
  prisma: "Prisma", "@prisma/client": "Prisma", "drizzle-orm": "Drizzle",
  typeorm: "TypeORM", sequelize: "Sequelize", mongoose: "Mongoose",
  kysely: "Kysely", knex: "Knex",
};

const TEST_FRAMEWORKS: Record<string, string> = {
  vitest: "Vitest", jest: "Jest", mocha: "Mocha", ava: "AVA",
  "@playwright/test": "Playwright", cypress: "Cypress", tap: "tap",
};

const DEPLOYMENT_FILES: Record<string, string> = {
  Dockerfile: "Docker",
  "docker-compose.yml": "Docker Compose",
  "docker-compose.yaml": "Docker Compose",
  "vercel.json": "Vercel",
  "netlify.toml": "Netlify",
  "fly.toml": "Fly.io",
  "render.yaml": "Render",
  Procfile: "Heroku-style Procfile",
  "railway.json": "Railway",
};

const KNOWN_CONFIG_FILES = [
  "package.json", "tsconfig.json", "pnpm-workspace.yaml", ".npmrc",
  "vite.config.ts", "vitest.config.ts", "next.config.js", "next.config.mjs",
  "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod",
  "composer.json", "Gemfile", "pom.xml", "build.gradle",
  ...Object.keys(LOCKFILES), ...Object.keys(DEPLOYMENT_FILES),
];

interface Manifest {
  name?: string;
  packageManager?: string;
  engines?: { node?: string };
  main?: string;
  bin?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readManifest(root: string): { manifest: Manifest | null; invalid: boolean } {
  const file = join(root, "package.json");
  if (!existsSync(file)) return { manifest: null, invalid: false };
  try {
    return { manifest: JSON.parse(readFileSync(file, "utf8")) as Manifest, invalid: false };
  } catch {
    // A broken manifest is a fact about the project, not a reason to crash.
    return { manifest: null, invalid: true };
  }
}

function allDeps(m: Manifest | null): Record<string, string> {
  return { ...(m?.dependencies ?? {}), ...(m?.devDependencies ?? {}) };
}

/** Map dependency names onto labels, keeping the dependency as the citation. */
function fromDeps(
  deps: Record<string, string>,
  table: Record<string, string>,
): { labels: string[]; sources: string[] } {
  const labels: string[] = [];
  const sources: string[] = [];
  for (const name of Object.keys(deps).sort()) {
    const label = table[name];
    if (label && !labels.includes(label)) {
      labels.push(label);
      sources.push(`package.json:${name}`);
    }
  }
  return { labels, sources };
}

function firstOf(
  deps: Record<string, string>,
  table: Record<string, string>,
): Detection<string> | null {
  const { labels, sources } = fromDeps(deps, table);
  const label = labels[0];
  const source = sources[0];
  if (label === undefined || source === undefined) return null;
  return detected(label, sources.slice(0, labels.length));
}

export function scanProject(root: string, now: string): ProjectMap {
  // Ignored directories are excluded from every count and list. MICHI's own
  // .michi/ folder is among them: its appearance is bookkeeping, not a change
  // to the user's project, and counting it would make the first scan after
  // `init` report a change that never happened.
  const entries = readdirSync(root, { withFileTypes: true })
    .filter((e) => !(e.isDirectory() && IGNORED_DIRS.has(e.name)));
  const files = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  const directories = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const { manifest, invalid } = readManifest(root);
  const deps = allDeps(manifest);
  const hasTs = files.has("tsconfig.json");

  // --- project type ------------------------------------------------------
  let project_type: Detection<string>;
  if (files.has("package.json") && !invalid) {
    project_type = detected("node", ["package.json"]);
  } else if (invalid) {
    project_type = unknownDetection("package.json exists but could not be parsed");
  } else if (files.has("pyproject.toml") || files.has("requirements.txt")) {
    project_type = detected("python", [files.has("pyproject.toml") ? "pyproject.toml" : "requirements.txt"]);
  } else if (files.has("Cargo.toml")) {
    project_type = detected("rust", ["Cargo.toml"]);
  } else if (files.has("go.mod")) {
    project_type = detected("go", ["go.mod"]);
  } else {
    project_type = unknownDetection("no recognised project manifest at the repository root");
  }

  // --- languages ---------------------------------------------------------
  let languages: Detection<string[]>;
  if (hasTs) {
    languages = detected(["TypeScript"], ["tsconfig.json"]);
  } else if (files.has("package.json") && !invalid) {
    languages = inferred(["JavaScript"], ["package.json"], "a Node manifest with no tsconfig.json");
  } else {
    languages = unknownDetection("no language configuration found at the repository root");
  }

  // --- package manager ---------------------------------------------------
  let package_manager: Detection<string>;
  const lockfile = Object.keys(LOCKFILES).find((f) => files.has(f));
  if (manifest?.packageManager) {
    package_manager = detected(manifest.packageManager.split("@")[0] ?? manifest.packageManager, [
      "package.json:packageManager",
    ]);
  } else if (lockfile) {
    package_manager = detected(LOCKFILES[lockfile] as string, [lockfile]);
  } else {
    package_manager = unknownDetection(
      files.has("package.json")
        ? "no lockfile and no packageManager field, so the package manager is not established"
        : "no Node manifest found",
    );
  }

  // --- runtime -----------------------------------------------------------
  let runtime: Detection<string>;
  if (manifest?.engines?.node) {
    runtime = detected(`node ${manifest.engines.node}`, ["package.json:engines.node"]);
  } else if (files.has("package.json") && !invalid) {
    runtime = inferred(["node"][0] as string, ["package.json"], "a Node manifest with no engines field");
  } else {
    runtime = unknownDetection("no runtime declared");
  }

  // --- the rest ----------------------------------------------------------
  const fw = fromDeps(deps, FRAMEWORKS);
  const frameworks: Detection<string[]> =
    fw.labels.length > 0
      ? detected(fw.labels, fw.sources)
      : unknownDetection(
          files.has("package.json")
            ? "no recognised framework among the declared dependencies"
            : "no dependency manifest to read",
        );

  const database =
    firstOf(deps, DATABASES) ??
    (existsSync(join(root, "prisma", "schema.prisma"))
      ? unknownDetection("a Prisma schema exists; its datasource was not read in this scan")
      : unknownDetection("nothing in the dependencies indicates a database"));

  const orm =
    (existsSync(join(root, "prisma", "schema.prisma"))
      ? detected("Prisma", ["prisma/schema.prisma"])
      : null) ??
    firstOf(deps, ORMS) ??
    unknownDetection("nothing in the dependencies indicates an ORM");

  const test_framework =
    firstOf(deps, TEST_FRAMEWORKS) ??
    unknownDetection("no recognised test framework among the declared dependencies");

  const deployIndicators: string[] = [];
  const deploySources: string[] = [];
  for (const [file, label] of Object.entries(DEPLOYMENT_FILES)) {
    if (files.has(file) && !deployIndicators.includes(label)) {
      deployIndicators.push(label);
      deploySources.push(file);
    }
  }
  if (existsSync(join(root, ".github", "workflows"))) {
    deployIndicators.push("GitHub Actions");
    deploySources.push(".github/workflows");
  }
  const deployment: Detection<string[]> =
    deployIndicators.length > 0
      ? detected(deployIndicators.sort(), deploySources.sort())
      : unknownDetection("no deployment or CI configuration found at the repository root");

  // --- structure ---------------------------------------------------------
  const entry_points: string[] = [];
  if (manifest?.main) entry_points.push(manifest.main);
  if (manifest?.bin) {
    if (typeof manifest.bin === "string") entry_points.push(manifest.bin);
    else if (typeof manifest.bin === "object" && manifest.bin !== null) {
      for (const v of Object.values(manifest.bin as Record<string, string>)) entry_points.push(v);
    }
  }
  for (const candidate of ["src/index.ts", "src/index.js", "src/main.ts", "index.js", "main.py"]) {
    if (existsSync(join(root, candidate))) entry_points.push(candidate);
  }

  const detections: Detections = {
    project_type,
    languages,
    package_manager,
    runtime,
    frameworks,
    database,
    orm,
    test_framework,
    deployment,
  };

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: now,
    detections,
    structure: {
      directories,
      config_files: KNOWN_CONFIG_FILES.filter((f) => files.has(f)).sort(),
      entry_points: [...new Set(entry_points)].sort(),
    },
    stats: { files_considered: entries.length },
  };
}

/**
 * The map's identity, for detecting real change.
 *
 * `generated_at` is deliberately excluded: it differs on every run, and a
 * hash that always differs cannot tell us whether anything actually changed
 * (CONTEXT_MODEL.md, hashing).
 */
export function mapHash(map: ProjectMap): string {
  const { generated_at: _when, ...rest } = map;
  return hashOf(rest);
}
