import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { importree } from "./index.js";
import type { ImportTree, ImportEdge } from "./types.js";

const fixturesDir = resolve(import.meta.dirname, "__tests__/fixtures");
const f = (...parts: string[]): string => join(fixturesDir, ...parts);

describe("importree", () => {
  it("resolves basic single import", async () => {
    const tree = await importree(f("basic", "entry.ts"));

    expect(tree.entrypoint).toBe(f("basic", "entry.ts"));
    expect(tree.files).toEqual([f("basic", "dep.ts"), f("basic", "entry.ts")]);
    expect(tree.externals).toEqual([]);
    expect(tree.graph[f("basic", "entry.ts")]).toEqual([
      { path: f("basic", "dep.ts"), specifiers: ["foo"] },
    ]);
    expect(tree.graph[f("basic", "dep.ts")]).toEqual([]);
  });

  it("resolves transitive chain a → b → c", async () => {
    const tree = await importree(f("chain", "a.ts"));

    expect(tree.files).toEqual([f("chain", "a.ts"), f("chain", "b.ts"), f("chain", "c.ts")]);
    expect(tree.graph[f("chain", "a.ts")]).toEqual([
      { path: f("chain", "b.ts"), specifiers: ["b"] },
    ]);
    expect(tree.graph[f("chain", "b.ts")]).toEqual([
      { path: f("chain", "c.ts"), specifiers: ["c"] },
    ]);
    expect(tree.graph[f("chain", "c.ts")]).toEqual([]);
  });

  it("handles circular imports without infinite loop", async () => {
    const tree = await importree(f("circular", "a.ts"));

    expect(tree.files).toHaveLength(2);
    expect(tree.files).toContain(f("circular", "a.ts"));
    expect(tree.files).toContain(f("circular", "b.ts"));
    expect(tree.graph[f("circular", "a.ts")]).toContainEqual(
      expect.objectContaining({ path: f("circular", "b.ts") }),
    );
    expect(tree.graph[f("circular", "b.ts")]).toContainEqual(
      expect.objectContaining({ path: f("circular", "a.ts") }),
    );
  });

  it("resolves aliased imports", async () => {
    const aliasBase = f("aliases");
    const tree = await importree(f("aliases", "src", "entry.ts"), {
      aliases: { "@": join(aliasBase, "src") },
    });

    expect(tree.files).toContain(f("aliases", "src", "utils.ts"));
  });

  it("resolves relative aliases using rootDir", async () => {
    const aliasBase = f("aliases");
    const tree = await importree(f("aliases", "src", "entry.ts"), {
      rootDir: aliasBase,
      aliases: { "@": "./src" },
    });

    expect(tree.files).toContain(f("aliases", "src", "utils.ts"));
  });

  it("classifies external packages", async () => {
    const tree = await importree(f("externals", "entry.ts"));

    expect(tree.externals).toContain("lodash");
    expect(tree.externals).toContain("react");
    expect(tree.externals).toContain("node:path");
    expect(tree.files).toContain(f("externals", "local.ts"));
  });

  it("follows dynamic imports", async () => {
    const tree = await importree(f("dynamic", "entry.ts"));

    expect(tree.files).toContain(f("dynamic", "lazy.ts"));
    expect(tree.graph[f("dynamic", "entry.ts")]).toContainEqual(
      expect.objectContaining({ path: f("dynamic", "lazy.ts"), isDynamic: true }),
    );
  });

  it("follows require() calls", async () => {
    const tree = await importree(f("require-cjs", "entry.ts"));

    expect(tree.files).toContain(f("require-cjs", "helper.ts"));
  });

  it("follows re-exports", async () => {
    const tree = await importree(f("reexports", "entry.ts"));

    expect(tree.files).toContain(f("reexports", "barrel.ts"));
    expect(tree.files).toContain(f("reexports", "a.ts"));
    expect(tree.files).toContain(f("reexports", "b.ts"));
    const barrelEdges = tree.graph[f("reexports", "barrel.ts")];
    expect(barrelEdges).toContainEqual(
      expect.objectContaining({ path: f("reexports", "a.ts"), isNamespace: true }),
    );
    expect(barrelEdges).toContainEqual(
      expect.objectContaining({ path: f("reexports", "b.ts"), specifiers: ["b"] }),
    );
  });

  it("resolves directory to index file", async () => {
    const tree = await importree(f("index-resolution", "entry.ts"));

    expect(tree.files).toContain(f("index-resolution", "utils", "index.ts"));
    expect(tree.files).toContain(f("index-resolution", "utils", "helper.ts"));
  });

  it("includes type imports", async () => {
    const tree = await importree(f("type-imports", "entry.ts"));

    expect(tree.files).toContain(f("type-imports", "types.ts"));
  });

  it("ignores imports inside comments", async () => {
    const tree = await importree(f("comments", "entry.ts"));

    expect(tree.files).toContain(f("comments", "real.ts"));
    expect(tree.files).toHaveLength(2);
  });

  it("ignores imports inside string literals", async () => {
    const tree = await importree(f("strings", "entry.ts"));

    expect(tree.files).toContain(f("strings", "real.ts"));
    expect(tree.files).toHaveLength(2);
  });

  it("handles diamond dependency correctly", async () => {
    const tree = await importree(f("diamond", "a.ts"));

    expect(tree.files).toEqual([
      f("diamond", "a.ts"),
      f("diamond", "b.ts"),
      f("diamond", "c.ts"),
      f("diamond", "d.ts"),
    ]);
    expect(tree.graph[f("diamond", "b.ts")]).toContainEqual(
      expect.objectContaining({ path: f("diamond", "d.ts") }),
    );
    expect(tree.graph[f("diamond", "c.ts")]).toContainEqual(
      expect.objectContaining({ path: f("diamond", "d.ts") }),
    );
  });

  it("computes reverseGraph correctly", async () => {
    const tree = await importree(f("chain", "a.ts"));

    expect(tree.reverseGraph[f("chain", "c.ts")]).toContainEqual(
      expect.objectContaining({ path: f("chain", "b.ts") }),
    );
    expect(tree.reverseGraph[f("chain", "b.ts")]).toContainEqual(
      expect.objectContaining({ path: f("chain", "a.ts") }),
    );
    expect(tree.reverseGraph[f("chain", "a.ts")]).toEqual([]);
  });

  it("handles mixed import patterns", async () => {
    const tree = await importree(f("mixed", "entry.ts"));

    expect(tree.files).toContain(f("mixed", "static-dep.ts"));
    expect(tree.files).toContain(f("mixed", "types.ts"));
    expect(tree.files).toContain(f("mixed", "side-effect.ts"));
    expect(tree.files).toContain(f("mixed", "dynamic-dep.ts"));
    expect(tree.files).toContain(f("mixed", "cjs-dep.ts"));
    expect(tree.files).toContain(f("mixed", "reexport.ts"));
    expect(tree.files).toHaveLength(7);
  });

  it("tracks specifiers in mixed import patterns", async () => {
    const tree = await importree(f("mixed", "entry.ts"));
    const edges = tree.graph[f("mixed", "entry.ts")];

    expect(edges).toContainEqual(
      expect.objectContaining({ path: f("mixed", "static-dep.ts"), specifiers: ["staticDep"] }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ path: f("mixed", "types.ts"), specifiers: ["SomeType"] }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ path: f("mixed", "side-effect.ts"), isSideEffect: true }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ path: f("mixed", "dynamic-dep.ts"), isDynamic: true }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({ path: f("mixed", "reexport.ts"), specifiers: ["everything"] }),
    );
  });

  it("merges edges for duplicate imports from the same module", async () => {
    const tree = await importree(f("specifiers", "entry.ts"));
    const edges = tree.graph[f("specifiers", "entry.ts")];

    const mergedEdge = edges.find((e) => e.path === f("specifiers", "merged.ts"));
    expect(mergedEdge).toBeDefined();
    expect(mergedEdge!.specifiers).toContain("a");
    expect(mergedEdge!.specifiers).toContain("b");
  });

  it("tracks aliased import original names", async () => {
    const tree = await importree(f("specifiers", "entry.ts"));
    const edges = tree.graph[f("specifiers", "entry.ts")];

    const aliasEdge = edges.find((e) => e.path === f("specifiers", "aliased.ts"));
    expect(aliasEdge).toBeDefined();
    expect(aliasEdge!.specifiers).toContain("button");
    expect(aliasEdge!.specifiers).toContain("badge");
  });

  it("resolves multi-line named imports with aliases", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    const namedEdge = edges.find((e) => e.path === f("multiline", "named-multiline.ts"));
    expect(namedEdge).toBeDefined();
    expect(namedEdge!.specifiers).toEqual(["alpha", "beta", "gamma"]);
  });

  it("resolves multi-line type imports", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    const typeEdge = edges.find((e) => e.path === f("multiline", "types-multiline.ts"));
    expect(typeEdge).toBeDefined();
    expect(typeEdge!.specifiers).toEqual(["Config", "Options"]);
  });

  it("resolves multi-line combined default and named imports", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    const combinedEdge = edges.find((e) => e.path === f("multiline", "combined-multiline.ts"));
    expect(combinedEdge).toBeDefined();
    expect(combinedEdge!.specifiers).toEqual(["default", "helper", "util"]);
  });

  it("resolves multi-line namespace imports", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    const nsEdge = edges.find((e) => e.path === f("multiline", "namespace-dep.ts"));
    expect(nsEdge).toBeDefined();
    expect(nsEdge!.isNamespace).toBe(true);
  });

  it("resolves multi-line re-exports", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    const reexportEdge = edges.find((e) => e.path === f("multiline", "reexport-multiline.ts"));
    expect(reexportEdge).toBeDefined();
    expect(reexportEdge!.specifiers).toEqual(["one", "two"]);
  });

  it("discovers all files from multi-line imports", async () => {
    const tree = await importree(f("multiline", "entry.ts"));

    expect(tree.files).toContain(f("multiline", "entry.ts"));
    expect(tree.files).toContain(f("multiline", "named-multiline.ts"));
    expect(tree.files).toContain(f("multiline", "types-multiline.ts"));
    expect(tree.files).toContain(f("multiline", "combined-multiline.ts"));
    expect(tree.files).toContain(f("multiline", "namespace-dep.ts"));
    expect(tree.files).toContain(f("multiline", "reexport-multiline.ts"));
    expect(tree.files).toHaveLength(6);
  });

  it("side-effect + named import merges to specifiers only", async () => {
    const tree = await importree(f("merge-edge-types", "entry.ts"));
    const edges = tree.graph[f("merge-edge-types", "entry.ts")];

    const depEdge = edges.find((e) => e.path === f("merge-edge-types", "dep.ts"))!;
    expect(depEdge).toBeDefined();
    expect(depEdge.specifiers).toEqual(["bar"]);
    expect(depEdge.isSideEffect).toBeUndefined();
  });

  it("namespace + named import merges to namespace only", async () => {
    const tree = await importree(f("merge-edge-types", "entry.ts"));
    const edges = tree.graph[f("merge-edge-types", "entry.ts")];

    const nsEdge = edges.find((e) => e.path === f("merge-edge-types", "ns-dep.ts"))!;
    expect(nsEdge).toBeDefined();
    expect(nsEdge.isNamespace).toBe(true);
    expect(nsEdge.specifiers).toBeUndefined();
  });
});

describe("graph format correctness", () => {
  function assertEdgeShape(edge: ImportEdge, label: string): void {
    expect(typeof edge.path, `${label}: path must be a string`).toBe("string");
    expect(edge.path, `${label}: path must be absolute`).toMatch(/^\//);

    if (edge.specifiers !== undefined) {
      expect(Array.isArray(edge.specifiers), `${label}: specifiers must be array`).toBe(true);
      for (const s of edge.specifiers!) {
        expect(typeof s, `${label}: each specifier must be a string`).toBe("string");
        expect(s.length, `${label}: specifier must not be empty`).toBeGreaterThan(0);
      }
    }

    if (edge.isNamespace !== undefined) {
      expect(typeof edge.isNamespace, `${label}: isNamespace must be boolean`).toBe("boolean");
    }
    if (edge.isDynamic !== undefined) {
      expect(typeof edge.isDynamic, `${label}: isDynamic must be boolean`).toBe("boolean");
    }
    if (edge.isSideEffect !== undefined) {
      expect(typeof edge.isSideEffect, `${label}: isSideEffect must be boolean`).toBe("boolean");
    }
  }

  function assertGraphStructure(tree: ImportTree): void {
    const graphKeys = Object.keys(tree.graph).sort();
    const reverseKeys = Object.keys(tree.reverseGraph).sort();

    expect(tree.files).toEqual(graphKeys);
    expect(reverseKeys).toEqual(graphKeys);

    for (const [file, edges] of Object.entries(tree.graph)) {
      expect(Array.isArray(edges), `graph[${file}] must be an array`).toBe(true);

      for (const edge of edges) {
        assertEdgeShape(edge, `graph[${file}] → ${edge.path}`);
        expect(tree.graph[edge.path], `edge target ${edge.path} must be a graph key`).toBeDefined();
      }

      const paths = edges.map((e) => e.path);
      expect(new Set(paths).size, `graph[${file}] must not have duplicate targets`).toBe(
        paths.length,
      );
    }

    for (const [file, edges] of Object.entries(tree.reverseGraph)) {
      expect(Array.isArray(edges), `reverseGraph[${file}] must be an array`).toBe(true);

      for (const edge of edges) {
        assertEdgeShape(edge, `reverseGraph[${file}] ← ${edge.path}`);
      }
    }
  }

  function assertGraphReverseConsistency(tree: ImportTree): void {
    for (const [file, edges] of Object.entries(tree.graph)) {
      for (const edge of edges) {
        const reverseEdges = tree.reverseGraph[edge.path];
        expect(reverseEdges, `reverseGraph[${edge.path}] must exist`).toBeDefined();

        const match = reverseEdges.find((r) => r.path === file);
        expect(match, `reverseGraph[${edge.path}] must contain edge back to ${file}`).toBeDefined();

        expect(match!.specifiers).toEqual(edge.specifiers);
        expect(match!.isNamespace).toEqual(edge.isNamespace);
        expect(match!.isDynamic).toEqual(edge.isDynamic);
        expect(match!.isSideEffect).toEqual(edge.isSideEffect);
      }
    }

    for (const [file, edges] of Object.entries(tree.reverseGraph)) {
      for (const edge of edges) {
        const forwardEdges = tree.graph[edge.path];
        expect(forwardEdges, `graph[${edge.path}] must exist`).toBeDefined();

        const match = forwardEdges.find((fw) => fw.path === file);
        expect(match, `graph[${edge.path}] must contain edge to ${file}`).toBeDefined();
      }
    }
  }

  const fixtures: [string, string, Record<string, string> | undefined][] = [
    ["basic", f("basic", "entry.ts"), undefined],
    ["chain", f("chain", "a.ts"), undefined],
    ["circular", f("circular", "a.ts"), undefined],
    ["diamond", f("diamond", "a.ts"), undefined],
    ["dynamic", f("dynamic", "entry.ts"), undefined],
    ["require-cjs", f("require-cjs", "entry.ts"), undefined],
    ["reexports", f("reexports", "entry.ts"), undefined],
    ["type-imports", f("type-imports", "entry.ts"), undefined],
    ["externals", f("externals", "entry.ts"), undefined],
    ["comments", f("comments", "entry.ts"), undefined],
    ["strings", f("strings", "entry.ts"), undefined],
    ["mixed", f("mixed", "entry.ts"), undefined],
    ["specifiers", f("specifiers", "entry.ts"), undefined],
    ["multiline", f("multiline", "entry.ts"), undefined],
    ["merge-edge-types", f("merge-edge-types", "entry.ts"), undefined],
    ["index-resolution", f("index-resolution", "entry.ts"), undefined],
    ["aliases", f("aliases", "src", "entry.ts"), { "@": join(fixturesDir, "aliases", "src") }],
  ];

  for (const [name, entry, aliases] of fixtures) {
    describe(name, () => {
      let tree: ImportTree;

      it("builds without error", async () => {
        tree = await importree(entry, aliases ? { aliases } : undefined);
        expect(tree).toBeDefined();
      });

      it("has valid edge shapes", () => {
        assertGraphStructure(tree);
      });

      it("graph and reverseGraph are consistent", () => {
        assertGraphReverseConsistency(tree);
      });

      it("files array is sorted", () => {
        expect(tree.files).toEqual([...tree.files].sort());
      });

      it("externals array is sorted", () => {
        expect(tree.externals).toEqual([...tree.externals].sort());
      });

      it("entrypoint is in files", () => {
        expect(tree.files).toContain(tree.entrypoint);
      });

      it("no edge has both isSideEffect and specifiers", () => {
        for (const [, edges] of Object.entries(tree.graph)) {
          for (const edge of edges) {
            if (edge.isSideEffect) {
              expect(
                edge.specifiers,
                `side-effect edge to ${edge.path} must not have specifiers`,
              ).toBeUndefined();
            }
          }
        }
      });

      it("namespace edges do not carry specifiers", () => {
        for (const [, edges] of Object.entries(tree.graph)) {
          for (const edge of edges) {
            if (edge.isNamespace) {
              expect(
                edge.specifiers,
                `namespace edge to ${edge.path} must not have specifiers`,
              ).toBeUndefined();
            }
          }
        }
      });
    });
  }

  it("basic: exact graph shape", async () => {
    const tree = await importree(f("basic", "entry.ts"));

    expect(tree.graph).toEqual({
      [f("basic", "entry.ts")]: [{ path: f("basic", "dep.ts"), specifiers: ["foo"] }],
      [f("basic", "dep.ts")]: [],
    });
    expect(tree.reverseGraph).toEqual({
      [f("basic", "entry.ts")]: [],
      [f("basic", "dep.ts")]: [{ path: f("basic", "entry.ts"), specifiers: ["foo"] }],
    });
  });

  it("chain: exact graph shape", async () => {
    const tree = await importree(f("chain", "a.ts"));

    expect(tree.graph).toEqual({
      [f("chain", "a.ts")]: [{ path: f("chain", "b.ts"), specifiers: ["b"] }],
      [f("chain", "b.ts")]: [{ path: f("chain", "c.ts"), specifiers: ["c"] }],
      [f("chain", "c.ts")]: [],
    });
    expect(tree.reverseGraph).toEqual({
      [f("chain", "a.ts")]: [],
      [f("chain", "b.ts")]: [{ path: f("chain", "a.ts"), specifiers: ["b"] }],
      [f("chain", "c.ts")]: [{ path: f("chain", "b.ts"), specifiers: ["c"] }],
    });
  });

  it("diamond: exact graph shape", async () => {
    const tree = await importree(f("diamond", "a.ts"));

    expect(tree.graph).toEqual({
      [f("diamond", "a.ts")]: [
        { path: f("diamond", "b.ts"), specifiers: ["b"] },
        { path: f("diamond", "c.ts"), specifiers: ["c"] },
      ],
      [f("diamond", "b.ts")]: [{ path: f("diamond", "d.ts"), specifiers: ["d"] }],
      [f("diamond", "c.ts")]: [{ path: f("diamond", "d.ts"), specifiers: ["d"] }],
      [f("diamond", "d.ts")]: [],
    });
    expect(tree.reverseGraph[f("diamond", "d.ts")]).toHaveLength(2);
    expect(tree.reverseGraph[f("diamond", "d.ts")]).toContainEqual({
      path: f("diamond", "b.ts"),
      specifiers: ["d"],
    });
    expect(tree.reverseGraph[f("diamond", "d.ts")]).toContainEqual({
      path: f("diamond", "c.ts"),
      specifiers: ["d"],
    });
  });

  it("circular: both directions carry specifiers", async () => {
    const tree = await importree(f("circular", "a.ts"));

    expect(tree.graph[f("circular", "a.ts")]).toEqual([
      { path: f("circular", "b.ts"), specifiers: ["b"] },
    ]);
    expect(tree.graph[f("circular", "b.ts")]).toEqual([
      { path: f("circular", "a.ts"), specifiers: ["a"] },
    ]);
  });

  it("mixed: each import type has correct flags", async () => {
    const tree = await importree(f("mixed", "entry.ts"));
    const edges = tree.graph[f("mixed", "entry.ts")];

    const staticEdge = edges.find((e) => e.path === f("mixed", "static-dep.ts"))!;
    expect(staticEdge.specifiers).toEqual(["staticDep"]);
    expect(staticEdge.isDynamic).toBeUndefined();
    expect(staticEdge.isSideEffect).toBeUndefined();
    expect(staticEdge.isNamespace).toBeUndefined();

    const sideEffectEdge = edges.find((e) => e.path === f("mixed", "side-effect.ts"))!;
    expect(sideEffectEdge.isSideEffect).toBe(true);
    expect(sideEffectEdge.specifiers).toBeUndefined();
    expect(sideEffectEdge.isDynamic).toBeUndefined();
    expect(sideEffectEdge.isNamespace).toBeUndefined();

    const dynamicEdge = edges.find((e) => e.path === f("mixed", "dynamic-dep.ts"))!;
    expect(dynamicEdge.isDynamic).toBe(true);
    expect(dynamicEdge.specifiers).toBeUndefined();
    expect(dynamicEdge.isSideEffect).toBeUndefined();
    expect(dynamicEdge.isNamespace).toBeUndefined();

    const cjsEdge = edges.find((e) => e.path === f("mixed", "cjs-dep.ts"))!;
    expect(cjsEdge.specifiers).toBeUndefined();
    expect(cjsEdge.isDynamic).toBeUndefined();
    expect(cjsEdge.isSideEffect).toBeUndefined();
    expect(cjsEdge.isNamespace).toBeUndefined();

    const reexportEdge = edges.find((e) => e.path === f("mixed", "reexport.ts"))!;
    expect(reexportEdge.specifiers).toEqual(["everything"]);
  });

  it("reexports: barrel has namespace and named edges", async () => {
    const tree = await importree(f("reexports", "entry.ts"));
    const barrelEdges = tree.graph[f("reexports", "barrel.ts")];

    expect(barrelEdges).toHaveLength(2);

    const starEdge = barrelEdges.find((e) => e.path === f("reexports", "a.ts"))!;
    expect(starEdge.isNamespace).toBe(true);
    expect(starEdge.specifiers).toBeUndefined();

    const namedEdge = barrelEdges.find((e) => e.path === f("reexports", "b.ts"))!;
    expect(namedEdge.specifiers).toEqual(["b"]);
    expect(namedEdge.isNamespace).toBeUndefined();
  });

  it("specifiers: merged edges combine specifiers from multiple imports", async () => {
    const tree = await importree(f("specifiers", "entry.ts"));
    const edges = tree.graph[f("specifiers", "entry.ts")];

    const mergedEdge = edges.find((e) => e.path === f("specifiers", "merged.ts"))!;
    expect(mergedEdge.specifiers).toEqual(["a", "b"]);

    const aliasedEdge = edges.find((e) => e.path === f("specifiers", "aliased.ts"))!;
    expect(aliasedEdge.specifiers).toEqual(["button", "badge"]);

    expect(edges).toHaveLength(2);
  });

  it("dynamic: edge flagged isDynamic without specifiers", async () => {
    const tree = await importree(f("dynamic", "entry.ts"));
    const edges = tree.graph[f("dynamic", "entry.ts")];

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      path: f("dynamic", "lazy.ts"),
      isDynamic: true,
      isNamespace: undefined,
      isSideEffect: undefined,
      specifiers: undefined,
    });
  });

  it("require-cjs: edge has no metadata flags", async () => {
    const tree = await importree(f("require-cjs", "entry.ts"));
    const edges = tree.graph[f("require-cjs", "entry.ts")];

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      path: f("require-cjs", "helper.ts"),
      specifiers: undefined,
      isDynamic: undefined,
      isNamespace: undefined,
      isSideEffect: undefined,
    });
  });

  it("externals: local edge carries specifiers, externals are bare names", async () => {
    const tree = await importree(f("externals", "entry.ts"));

    expect(tree.externals).toEqual(["lodash", "node:path", "react"]);

    const edges = tree.graph[f("externals", "entry.ts")];
    expect(edges).toHaveLength(1);
    expect(edges[0].path).toBe(f("externals", "local.ts"));
    expect(edges[0].specifiers).toEqual(["local"]);
  });

  it("multiline: full graph shape with all edge metadata", async () => {
    const tree = await importree(f("multiline", "entry.ts"));
    const edges = tree.graph[f("multiline", "entry.ts")];

    expect(edges).toHaveLength(5);

    const named = edges.find((e) => e.path === f("multiline", "named-multiline.ts"))!;
    expect(named.specifiers).toEqual(["alpha", "beta", "gamma"]);

    const types = edges.find((e) => e.path === f("multiline", "types-multiline.ts"))!;
    expect(types.specifiers).toEqual(["Config", "Options"]);

    const combined = edges.find((e) => e.path === f("multiline", "combined-multiline.ts"))!;
    expect(combined.specifiers).toEqual(["default", "helper", "util"]);

    const ns = edges.find((e) => e.path === f("multiline", "namespace-dep.ts"))!;
    expect(ns.isNamespace).toBe(true);
    expect(ns.specifiers).toBeUndefined();

    const reexport = edges.find((e) => e.path === f("multiline", "reexport-multiline.ts"))!;
    expect(reexport.specifiers).toEqual(["one", "two"]);
  });
});
