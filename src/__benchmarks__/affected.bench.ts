import { describe, bench, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { importree, getAffectedFiles, type ImportTree } from "../index.js";
import { createFixture, type Fixture, type FixtureSize } from "./generate-fixtures.js";

const fixtures: Record<string, Fixture> = {};
const trees: Record<string, ImportTree> = {};

beforeAll(async () => {
  const sizes: FixtureSize[] = ["small", "medium", "large", "xlarge"];
  for (const size of sizes) {
    fixtures[size] = createFixture(size);
    trees[size] = await importree(fixtures[size].entryFile, {
      rootDir: fixtures[size].rootDir,
      aliases: { "@": join(fixtures[size].rootDir, "modules") },
    });
  }
});

afterAll(() => {
  for (const f of Object.values(fixtures)) f.cleanup();
});

describe("getAffectedFiles - small (10 files)", () => {
  bench("leaf file (max propagation)", () => {
    const tree = trees.small;
    getAffectedFiles(tree, tree.files[tree.files.length - 1]);
  });

  bench("mid-level file", () => {
    const tree = trees.small;
    getAffectedFiles(tree, tree.files[Math.floor(tree.files.length / 2)]);
  });

  bench("entry file (no dependents)", () => {
    getAffectedFiles(trees.small, trees.small.entrypoint);
  });
});

describe("getAffectedFiles - medium (100 files)", () => {
  bench("leaf file (max propagation)", () => {
    const tree = trees.medium;
    getAffectedFiles(tree, tree.files[tree.files.length - 1]);
  });

  bench("mid-level file", () => {
    const tree = trees.medium;
    getAffectedFiles(tree, tree.files[Math.floor(tree.files.length / 2)]);
  });

  bench("entry file (no dependents)", () => {
    getAffectedFiles(trees.medium, trees.medium.entrypoint);
  });
});

describe("getAffectedFiles - large (500 files)", () => {
  bench("leaf file (max propagation)", () => {
    const tree = trees.large;
    getAffectedFiles(tree, tree.files[tree.files.length - 1]);
  });

  bench("mid-level file", () => {
    const tree = trees.large;
    getAffectedFiles(tree, tree.files[Math.floor(tree.files.length / 2)]);
  });

  bench("entry file (no dependents)", () => {
    getAffectedFiles(trees.large, trees.large.entrypoint);
  });
});

describe("getAffectedFiles - xlarge (1000 files)", () => {
  bench("leaf file (max propagation)", () => {
    const tree = trees.xlarge;
    getAffectedFiles(tree, tree.files[tree.files.length - 1]);
  });

  bench("mid-level file", () => {
    const tree = trees.xlarge;
    getAffectedFiles(tree, tree.files[Math.floor(tree.files.length / 2)]);
  });

  bench("entry file (no dependents)", () => {
    getAffectedFiles(trees.xlarge, trees.xlarge.entrypoint);
  });
});
