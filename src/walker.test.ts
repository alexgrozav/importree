import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { importree } from "./index.js";

const fixturesDir = resolve(import.meta.dirname, "__tests__/fixtures");
const f = (...parts: string[]): string => join(fixturesDir, ...parts);

describe("importree", () => {
  it("resolves basic single import", async () => {
    const tree = await importree(f("basic", "entry.ts"));

    expect(tree.entrypoint).toBe(f("basic", "entry.ts"));
    expect(tree.files).toEqual([f("basic", "dep.ts"), f("basic", "entry.ts")]);
    expect(tree.externals).toEqual([]);
    expect(tree.graph[f("basic", "entry.ts")]).toEqual([f("basic", "dep.ts")]);
    expect(tree.graph[f("basic", "dep.ts")]).toEqual([]);
  });

  it("resolves transitive chain a → b → c", async () => {
    const tree = await importree(f("chain", "a.ts"));

    expect(tree.files).toEqual([f("chain", "a.ts"), f("chain", "b.ts"), f("chain", "c.ts")]);
    expect(tree.graph[f("chain", "a.ts")]).toEqual([f("chain", "b.ts")]);
    expect(tree.graph[f("chain", "b.ts")]).toEqual([f("chain", "c.ts")]);
    expect(tree.graph[f("chain", "c.ts")]).toEqual([]);
  });

  it("handles circular imports without infinite loop", async () => {
    const tree = await importree(f("circular", "a.ts"));

    expect(tree.files).toHaveLength(2);
    expect(tree.files).toContain(f("circular", "a.ts"));
    expect(tree.files).toContain(f("circular", "b.ts"));
    expect(tree.graph[f("circular", "a.ts")]).toContain(f("circular", "b.ts"));
    expect(tree.graph[f("circular", "b.ts")]).toContain(f("circular", "a.ts"));
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
    expect(tree.graph[f("dynamic", "entry.ts")]).toContain(f("dynamic", "lazy.ts"));
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
    expect(tree.graph[f("reexports", "barrel.ts")]).toContain(f("reexports", "a.ts"));
    expect(tree.graph[f("reexports", "barrel.ts")]).toContain(f("reexports", "b.ts"));
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
    // Should not attempt to find ./fake or ./also-fake
    expect(tree.files).toHaveLength(2); // entry + real only
  });

  it("ignores imports inside string literals", async () => {
    const tree = await importree(f("strings", "entry.ts"));

    expect(tree.files).toContain(f("strings", "real.ts"));
    expect(tree.files).toHaveLength(2); // entry + real only
  });

  it("handles diamond dependency correctly", async () => {
    const tree = await importree(f("diamond", "a.ts"));

    expect(tree.files).toEqual([
      f("diamond", "a.ts"),
      f("diamond", "b.ts"),
      f("diamond", "c.ts"),
      f("diamond", "d.ts"),
    ]);
    // d appears in both b and c's deps
    expect(tree.graph[f("diamond", "b.ts")]).toContain(f("diamond", "d.ts"));
    expect(tree.graph[f("diamond", "c.ts")]).toContain(f("diamond", "d.ts"));
  });

  it("computes reverseGraph correctly", async () => {
    const tree = await importree(f("chain", "a.ts"));

    expect(tree.reverseGraph[f("chain", "c.ts")]).toContain(f("chain", "b.ts"));
    expect(tree.reverseGraph[f("chain", "b.ts")]).toContain(f("chain", "a.ts"));
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
    expect(tree.files).toHaveLength(7); // entry + 6 deps
  });
});
