import { describe, it, expect } from "vitest";
import { resolve, join, isAbsolute } from "node:path";
import { importree, getAffectedFiles, parseImports } from "./index.js";

const fixturesDir = resolve(import.meta.dirname, "__tests__/fixtures");
const f = (...parts: string[]): string => join(fixturesDir, ...parts);

describe("parseImports", () => {
  it("returns direct import edges for a single file", () => {
    const edges = parseImports(f("basic", "entry.ts"));

    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("basic", "dep.ts"));
    expect(edges[0].specifiers).toEqual(["foo"]);
  });

  it("does not recurse into imported files", () => {
    const edges = parseImports(f("chain", "a.ts"));

    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("chain", "b.ts"));
  });

  it("excludes external imports", () => {
    const edges = parseImports(f("externals", "entry.ts"));

    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("externals", "local.ts"));
  });

  it("flags dynamic imports", () => {
    const edges = parseImports(f("dynamic", "entry.ts"));

    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("dynamic", "lazy.ts"));
    expect(edges[0].isDynamic).toBe(true);
  });

  it("ignores imports inside comments", () => {
    const edges = parseImports(f("comments", "entry.ts"));

    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("comments", "real.ts"));
  });

  it("returns absolute paths", () => {
    const edges = parseImports(f("basic", "entry.ts"));

    for (const edge of edges) {
      expect(isAbsolute(edge.path)).toBe(true);
    }
  });
});

describe("getAffectedFiles", () => {
  it("returns empty array for unknown file", async () => {
    const tree = await importree(f("basic", "entry.ts"));
    const affected = getAffectedFiles(tree, "/nonexistent/file.ts");

    expect(affected).toEqual([]);
  });

  it("returns direct dependents", async () => {
    const tree = await importree(f("basic", "entry.ts"));
    const affected = getAffectedFiles(tree, f("basic", "dep.ts"));

    expect(affected).toContain(f("basic", "entry.ts"));
  });

  it("returns transitive dependents", async () => {
    const tree = await importree(f("chain", "a.ts"));
    const affected = getAffectedFiles(tree, f("chain", "c.ts"));

    // c changed → b depends on c → a depends on b
    expect(affected).toContain(f("chain", "b.ts"));
    expect(affected).toContain(f("chain", "a.ts"));
  });

  it("handles diamond dependency", async () => {
    const tree = await importree(f("diamond", "a.ts"));
    const affected = getAffectedFiles(tree, f("diamond", "d.ts"));

    // d changed → b, c depend on d → a depends on b and c
    expect(affected).toContain(f("diamond", "b.ts"));
    expect(affected).toContain(f("diamond", "c.ts"));
    expect(affected).toContain(f("diamond", "a.ts"));
  });

  it("handles circular dependency", async () => {
    const tree = await importree(f("circular", "a.ts"));
    const affected = getAffectedFiles(tree, f("circular", "a.ts"));

    // a changed → b depends on a, but a itself should NOT be included
    expect(affected).toContain(f("circular", "b.ts"));
    expect(affected).not.toContain(f("circular", "a.ts"));
  });

  it("does not include the changed file itself", async () => {
    const tree = await importree(f("chain", "a.ts"));
    const affected = getAffectedFiles(tree, f("chain", "c.ts"));

    expect(affected).not.toContain(f("chain", "c.ts"));
  });

  it("returns sorted results", async () => {
    const tree = await importree(f("diamond", "a.ts"));
    const affected = getAffectedFiles(tree, f("diamond", "d.ts"));

    const sorted = [...affected].sort();
    expect(affected).toEqual(sorted);
  });

  it("returns empty for entry file with no dependents", async () => {
    const tree = await importree(f("chain", "a.ts"));
    const affected = getAffectedFiles(tree, f("chain", "a.ts"));

    // a is the root — nothing depends on it
    expect(affected).toEqual([]);
  });

  it("skips nodes not present in reverseGraph during BFS", async () => {
    const tree: import("./index.js").ImportTree = {
      entrypoint: "/a.ts",
      files: ["/a.ts", "/b.ts"],
      externals: [],
      graph: { "/a.ts": [{ path: "/b.ts", specifiers: ["b"] }], "/b.ts": [] },
      reverseGraph: { "/a.ts": [], "/b.ts": [{ path: "/a.ts", specifiers: ["b"] }] },
    };
    // Manually add an entry that points to a node not in reverseGraph
    tree.reverseGraph["/b.ts"] = [{ path: "/a.ts", specifiers: ["b"] }, { path: "/phantom.ts" }];
    const affected = getAffectedFiles(tree, "/b.ts");

    // Should include /a.ts and /phantom.ts, but not crash when /phantom.ts has no reverseGraph entry
    expect(affected).toContain("/a.ts");
    expect(affected).toContain("/phantom.ts");
  });
});
