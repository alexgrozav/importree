import { describe, bench, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { importree } from "../index.js";
import { createFixture, type Fixture, type FixtureSize } from "./generate-fixtures.js";

// Detect available comparison tools
let madgeAvailable = false;
let tsAvailable = false;
let depTreeAvailable = false;

try {
  await import("madge");
  madgeAvailable = true;
} catch {}

try {
  await import("typescript");
  tsAvailable = true;
} catch {}

try {
  await import("dependency-tree");
  depTreeAvailable = true;
} catch {}

const fixtures: Record<string, Fixture> = {};

beforeAll(() => {
  const sizes: FixtureSize[] = ["small", "medium", "large"];
  for (const size of sizes) {
    fixtures[size] = createFixture(size);
  }
});

afterAll(() => {
  for (const f of Object.values(fixtures)) f.cleanup();
});

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (/\.[tj]sx?$/.test(entry.name)) results.push(full);
  }
  return results;
}

describe("comparison - small (10 files)", () => {
  bench("importree", async () => {
    await importree(fixtures.small.entryFile, {
      rootDir: fixtures.small.rootDir,
      aliases: { "@": join(fixtures.small.rootDir, "modules") },
    });
  });

  if (madgeAvailable) {
    bench("madge", async () => {
      const madge = (await import("madge")).default;
      await madge(fixtures.small.entryFile, {
        fileExtensions: ["ts", "tsx", "js", "jsx"],
      });
    });
  }

  bench("manual glob+regex", async () => {
    const files = walkDir(fixtures.small.rootDir);
    const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
    const graph: Record<string, string[]> = {};
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const deps: string[] = [];
      for (const m of content.matchAll(fromRe)) {
        if (m[1].startsWith(".")) deps.push(m[1]);
      }
      graph[file] = deps;
    }
  });

  if (depTreeAvailable) {
    bench("dependency-tree", () => {
      const depTree = require("dependency-tree");
      depTree.toList({
        filename: fixtures.small.entryFile,
        directory: fixtures.small.rootDir,
      });
    });
  }

  if (tsAvailable) {
    bench("ts.createProgram", () => {
      const ts = require("typescript");
      const program = ts.createProgram([fixtures.small.entryFile], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
      });
      program.getSourceFiles();
    });
  }
});

describe("comparison - medium (100 files)", () => {
  bench("importree", async () => {
    await importree(fixtures.medium.entryFile, {
      rootDir: fixtures.medium.rootDir,
      aliases: { "@": join(fixtures.medium.rootDir, "modules") },
    });
  });

  if (madgeAvailable) {
    bench("madge", async () => {
      const madge = (await import("madge")).default;
      await madge(fixtures.medium.entryFile, {
        fileExtensions: ["ts", "tsx", "js", "jsx"],
      });
    });
  }

  bench("manual glob+regex", async () => {
    const files = walkDir(fixtures.medium.rootDir);
    const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
    const graph: Record<string, string[]> = {};
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const deps: string[] = [];
      for (const m of content.matchAll(fromRe)) {
        if (m[1].startsWith(".")) deps.push(m[1]);
      }
      graph[file] = deps;
    }
  });

  if (depTreeAvailable) {
    bench("dependency-tree", () => {
      const depTree = require("dependency-tree");
      depTree.toList({
        filename: fixtures.medium.entryFile,
        directory: fixtures.medium.rootDir,
      });
    });
  }

  if (tsAvailable) {
    bench("ts.createProgram", () => {
      const ts = require("typescript");
      const program = ts.createProgram([fixtures.medium.entryFile], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
      });
      program.getSourceFiles();
    });
  }
});

describe("comparison - large (500 files)", () => {
  bench("importree", async () => {
    await importree(fixtures.large.entryFile, {
      rootDir: fixtures.large.rootDir,
      aliases: { "@": join(fixtures.large.rootDir, "modules") },
    });
  });

  if (madgeAvailable) {
    bench("madge", async () => {
      const madge = (await import("madge")).default;
      await madge(fixtures.large.entryFile, {
        fileExtensions: ["ts", "tsx", "js", "jsx"],
      });
    });
  }

  bench("manual glob+regex", async () => {
    const files = walkDir(fixtures.large.rootDir);
    const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
    const graph: Record<string, string[]> = {};
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const deps: string[] = [];
      for (const m of content.matchAll(fromRe)) {
        if (m[1].startsWith(".")) deps.push(m[1]);
      }
      graph[file] = deps;
    }
  });

  if (depTreeAvailable) {
    bench("dependency-tree", () => {
      const depTree = require("dependency-tree");
      depTree.toList({
        filename: fixtures.large.entryFile,
        directory: fixtures.large.rootDir,
      });
    });
  }

  if (tsAvailable) {
    bench("ts.createProgram", () => {
      const ts = require("typescript");
      const program = ts.createProgram([fixtures.large.entryFile], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        skipLibCheck: true,
      });
      program.getSourceFiles();
    });
  }
});
