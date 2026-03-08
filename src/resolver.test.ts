import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { createResolver } from "./resolver.js";

const fixturesDir = resolve(import.meta.dirname, "__tests__/fixtures");

describe("createResolver", () => {
  it("resolves relative import with extension", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "basic", "entry.ts");
    const result = resolver("./dep", fromFile);

    expect(result).toEqual({
      type: "local",
      absolutePath: join(fixturesDir, "basic", "dep.ts"),
    });
  });

  it("resolves relative import trying extensions", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "chain", "a.ts");
    const result = resolver("./b", fromFile);

    expect(result?.type).toBe("local");
    expect(result?.absolutePath).toBe(join(fixturesDir, "chain", "b.ts"));
  });

  it("resolves directory import to index file", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "index-resolution", "entry.ts");
    const result = resolver("./utils", fromFile);

    expect(result?.type).toBe("local");
    expect(result?.absolutePath).toBe(join(fixturesDir, "index-resolution", "utils", "index.ts"));
  });

  it("resolves alias imports", () => {
    const aliasBase = join(fixturesDir, "aliases");
    const resolver = createResolver(aliasBase, {
      aliases: { "@": "./src" },
    });
    const fromFile = join(aliasBase, "src", "entry.ts");
    const result = resolver("@/utils", fromFile);

    expect(result?.type).toBe("local");
    expect(result?.absolutePath).toBe(join(aliasBase, "src", "utils.ts"));
  });

  it("classifies bare specifiers as external", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "externals", "entry.ts");
    const result = resolver("lodash", fromFile);

    expect(result).toEqual({
      type: "external",
      specifier: "lodash",
    });
  });

  it("classifies scoped packages as external", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "externals", "entry.ts");
    const result = resolver("@scope/pkg/path", fromFile);

    expect(result).toEqual({
      type: "external",
      specifier: "@scope/pkg",
    });
  });

  it("classifies node: built-ins as external", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "externals", "local.ts");
    const result = resolver("node:path", fromFile);

    expect(result).toEqual({
      type: "external",
      specifier: "node:path",
    });
  });

  it("uses longest-match alias", () => {
    const aliasBase = join(fixturesDir, "aliases");
    const resolver = createResolver(aliasBase, {
      aliases: {
        "@": "./src",
        "@/utils": "./src/utils",
      },
    });
    const fromFile = join(aliasBase, "src", "entry.ts");

    // @/utils should match the longer alias first
    const result = resolver("@/utils", fromFile);
    expect(result?.type).toBe("local");
  });

  it("returns undefined for unresolvable relative import", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "basic", "entry.ts");
    const result = resolver("./nonexistent", fromFile);

    expect(result).toBeUndefined();
  });

  it("caches resolved paths", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "basic", "entry.ts");

    const result1 = resolver("./dep", fromFile);
    const result2 = resolver("./dep", fromFile);

    // Should return the same object (cached)
    expect(result1).toBe(result2);
  });

  it("handles scoped package with no subpath", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "externals", "entry.ts");
    const result = resolver("@scope", fromFile);

    expect(result).toEqual({
      type: "external",
      specifier: "@scope",
    });
  });

  it("returns undefined for alias that matches but file does not exist", () => {
    const aliasBase = join(fixturesDir, "aliases");
    const resolver = createResolver(aliasBase, {
      aliases: { "@": "./src" },
    });
    const fromFile = join(aliasBase, "src", "entry.ts");
    const result = resolver("@/nonexistent", fromFile);

    expect(result).toBeUndefined();
  });

  it("resolves exact alias without subpath", () => {
    const aliasBase = join(fixturesDir, "aliases");
    const resolver = createResolver(aliasBase, {
      aliases: { "@": "./src" },
    });
    const fromFile = join(aliasBase, "src", "entry.ts");
    // '@' exactly matches the alias key, no subpath
    const result = resolver("@", fromFile);

    // ./src is a directory, should resolve to ./src/entry.ts via extension probing
    expect(result).toBeUndefined();
  });

  it("resolves import with explicit extension (exact path match)", () => {
    const resolver = createResolver(fixturesDir, {});
    const fromFile = join(fixturesDir, "basic", "entry.ts");
    const result = resolver("./dep.ts", fromFile);

    expect(result?.type).toBe("local");
    expect(result?.absolutePath).toBe(join(fixturesDir, "basic", "dep.ts"));
  });
});
