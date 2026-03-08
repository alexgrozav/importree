import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { importree, getAffectedFiles } from "./index.js";

const fixturesDir = resolve(import.meta.dirname, "__tests__/fixtures");
const f = (...parts: string[]): string => join(fixturesDir, ...parts);

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
      graph: { "/a.ts": ["/b.ts"], "/b.ts": [] },
      reverseGraph: { "/a.ts": [], "/b.ts": ["/a.ts"] },
    };
    // Manually add an entry that points to a node not in reverseGraph
    tree.reverseGraph["/b.ts"] = ["/a.ts", "/phantom.ts"];
    const affected = getAffectedFiles(tree, "/b.ts");

    // Should include /a.ts and /phantom.ts, but not crash when /phantom.ts has no reverseGraph entry
    expect(affected).toContain("/a.ts");
    expect(affected).toContain("/phantom.ts");
  });
});
