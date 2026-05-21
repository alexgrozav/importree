import { describe, it, expect } from "vitest";
import { stripComments, scanImports, parseSpecifiers } from "./scanner.js";

describe("stripComments", () => {
  it("removes single-line comments", () => {
    const result = stripComments("const a = 1; // comment\nconst b = 2;");
    expect(result).not.toContain("comment");
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
  });

  it("removes block comments", () => {
    const result = stripComments("const a = 1; /* block comment */ const b = 2;");
    expect(result).not.toContain("block comment");
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
  });

  it("removes multi-line block comments", () => {
    const result = stripComments("const a = 1;\n/* line1\nline2\nline3 */\nconst b = 2;");
    expect(result).not.toContain("line1");
    expect(result).toContain("const a = 1;");
    expect(result).toContain("const b = 2;");
  });

  it("preserves string content", () => {
    const result = stripComments("const s = 'hello world';");
    expect(result).toContain("hello world");
  });

  it("handles escaped quotes in strings", () => {
    const result = stripComments("const s = 'it\\'s a test'; const a = 1;");
    expect(result).toContain("const a = 1;");
  });

  it("does not strip comment-like patterns inside strings", () => {
    const code = "const s = '// not a comment'; import { a } from './a';";
    const result = stripComments(code);
    expect(result).toContain("from './a'");
    expect(result).toContain("// not a comment");
  });

  it("handles template literals with interpolation", () => {
    const code = "const s = `hello ${world} test`;";
    const result = stripComments(code);
    expect(result).toContain("`");
    expect(result).toContain("hello");
  });

  it("handles comment-like patterns inside template literals", () => {
    const code = "const s = `// not a comment`; const a = 1;";
    const result = stripComments(code);
    expect(result).toContain("// not a comment");
    expect(result).toContain("const a = 1;");
  });

  it("handles escaped characters inside template literals", () => {
    const code = "const s = `hello \\n world`; const a = 1;";
    const result = stripComments(code);
    expect(result).toContain("hello \\n world");
    expect(result).toContain("const a = 1;");
  });

  it("handles unterminated block comment", () => {
    const code = "const a = 1; /* unterminated";
    const result = stripComments(code);
    expect(result).toContain("const a = 1;");
    expect(result).not.toContain("unterminated");
  });

  it("handles unterminated string literal", () => {
    const code = "const s = 'unterminated";
    const result = stripComments(code);
    expect(result).toContain("unterminated");
  });
});

describe("parseSpecifiers", () => {
  it("parses simple names", () => {
    expect(parseSpecifiers("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("extracts original names from aliases", () => {
    expect(parseSpecifiers("button as btn, badge")).toEqual(["button", "badge"]);
  });

  it("strips type prefix", () => {
    expect(parseSpecifiers("type Foo, bar")).toEqual(["Foo", "bar"]);
  });

  it("handles combined type and alias", () => {
    expect(parseSpecifiers("type Foo as F, bar as b")).toEqual(["Foo", "bar"]);
  });

  it("handles whitespace and empty entries", () => {
    expect(parseSpecifiers("  a , , b  ")).toEqual(["a", "b"]);
  });

  it("handles single specifier", () => {
    expect(parseSpecifiers("foo")).toEqual(["foo"]);
  });
});

describe("scanImports", () => {
  it("extracts static named import with specifiers", () => {
    const results = scanImports("import { foo, bar } from './foo';");
    expect(results).toContainEqual({ path: "./foo", specifiers: ["foo", "bar"] });
  });

  it("extracts static default import", () => {
    const results = scanImports("import foo from './foo';");
    expect(results).toContainEqual({ path: "./foo", specifiers: ["default"] });
  });

  it("extracts namespace import", () => {
    const results = scanImports("import * as foo from './foo';");
    expect(results).toContainEqual({ path: "./foo", isNamespace: true });
  });

  it("extracts side-effect import", () => {
    const results = scanImports("import './side-effect';");
    expect(results).toContainEqual({ path: "./side-effect", isSideEffect: true });
  });

  it("extracts type import with specifiers", () => {
    const results = scanImports("import type { Foo } from './types';");
    expect(results).toContainEqual({ path: "./types", specifiers: ["Foo"] });
  });

  it("extracts dynamic import", () => {
    const results = scanImports("const m = import('./lazy');");
    expect(results).toContainEqual({ path: "./lazy", isDynamic: true });
  });

  it("extracts dynamic import with await", () => {
    const results = scanImports("const m = await import('./lazy');");
    expect(results).toContainEqual({ path: "./lazy", isDynamic: true });
  });

  it("extracts require()", () => {
    const results = scanImports("const m = require('./cjs');");
    expect(results).toContainEqual({ path: "./cjs" });
  });

  it("extracts export from with specifiers", () => {
    const results = scanImports("export { foo, bar } from './foo';");
    expect(results).toContainEqual({ path: "./foo", specifiers: ["foo", "bar"] });
  });

  it("extracts export * from as namespace", () => {
    const results = scanImports("export * from './all';");
    expect(results).toContainEqual({ path: "./all", isNamespace: true });
  });

  it("extracts export type from with specifiers", () => {
    const results = scanImports("export type { Foo } from './types';");
    expect(results).toContainEqual({ path: "./types", specifiers: ["Foo"] });
  });

  it("extracts aliased specifiers with original names", () => {
    const results = scanImports("import { button as btn, badge } from './ui';");
    expect(results).toContainEqual({ path: "./ui", specifiers: ["button", "badge"] });
  });

  it("extracts combined default and named import", () => {
    const results = scanImports("import React, { useState, useEffect } from 'react';");
    expect(results).toContainEqual({
      path: "react",
      specifiers: ["default", "useState", "useEffect"],
    });
  });

  it("returns separate entries for duplicate paths", () => {
    const code = "import { a } from './x';\nimport { b } from './x';";
    const results = scanImports(code);
    const xImports = results.filter((r) => r.path === "./x");
    expect(xImports).toHaveLength(2);
    expect(xImports[0].specifiers).toEqual(["a"]);
    expect(xImports[1].specifiers).toEqual(["b"]);
  });

  it("ignores imports inside line comments", () => {
    const code = "// import { fake } from './fake';\nimport { real } from './real';";
    const results = scanImports(code);
    expect(results.map((r) => r.path)).toContain("./real");
    expect(results.map((r) => r.path)).not.toContain("./fake");
  });

  it("ignores imports inside block comments", () => {
    const code = "/* import { fake } from './fake'; */\nimport { real } from './real';";
    const results = scanImports(code);
    expect(results.map((r) => r.path)).toContain("./real");
    expect(results.map((r) => r.path)).not.toContain("./fake");
  });

  it("handles multi-line import statement", () => {
    const code = "import {\n  foo,\n  bar,\n} from './multi';";
    const results = scanImports(code);
    expect(results).toContainEqual({ path: "./multi", specifiers: ["foo", "bar"] });
  });

  it("extracts multiple different specifiers", () => {
    const code = `
      import { a } from './a';
      import b from './b';
      export * from './c';
      const d = import('./d');
      const e = require('./e');
    `;
    const results = scanImports(code);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("./a");
    expect(paths).toContain("./b");
    expect(paths).toContain("./c");
    expect(paths).toContain("./d");
    expect(paths).toContain("./e");
  });

  it("handles external package specifiers", () => {
    const code = "import lodash from 'lodash';\nimport { join } from 'node:path';";
    const results = scanImports(code);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("lodash");
    expect(paths).toContain("node:path");
  });

  it("handles inline type specifiers", () => {
    const results = scanImports("import { type Foo, bar } from './mixed';");
    expect(results).toContainEqual({ path: "./mixed", specifiers: ["Foo", "bar"] });
  });

  it("handles export * as namespace", () => {
    const results = scanImports("export * as ns from './mod';");
    expect(results).toContainEqual({ path: "./mod", isNamespace: true });
  });

  it("handles type-only default import", () => {
    const results = scanImports("import type Foo from './types';");
    expect(results).toContainEqual({ path: "./types", specifiers: ["default"] });
  });

  it("handles multi-line named import with aliases", () => {
    const code = `import {
  alpha,
  beta as b,
  gamma,
} from './multi';`;
    const results = scanImports(code);
    expect(results).toContainEqual({ path: "./multi", specifiers: ["alpha", "beta", "gamma"] });
  });

  it("handles multi-line type import", () => {
    const code = `import type {
  Config,
  Options as Opts,
} from './types';`;
    const results = scanImports(code);
    expect(results).toContainEqual({ path: "./types", specifiers: ["Config", "Options"] });
  });

  it("handles multi-line combined default and named import", () => {
    const code = `import DefaultExport, {
  helper,
  util as u,
} from './combined';`;
    const results = scanImports(code);
    expect(results).toContainEqual({
      path: "./combined",
      specifiers: ["default", "helper", "util"],
    });
  });

  it("handles multi-line re-export", () => {
    const code = `export {
  one,
  two,
} from './reexport';`;
    const results = scanImports(code);
    expect(results).toContainEqual({ path: "./reexport", specifiers: ["one", "two"] });
  });

  it("handles multi-line import with inline type specifiers", () => {
    const code = `import {
  type Foo,
  bar,
  type Baz as B,
} from './mixed-types';`;
    const results = scanImports(code);
    expect(results).toContainEqual({
      path: "./mixed-types",
      specifiers: ["Foo", "bar", "Baz"],
    });
  });

  it("handles import with comment between specifiers and from", () => {
    const code = `import { foo } from './with-comment';`;
    const codeWithComment = `import { foo }
from './with-comment';`;
    const results = scanImports(codeWithComment);
    expect(results).toContainEqual({ path: "./with-comment", specifiers: ["foo"] });
  });

  it("handles many specifiers across multiple lines", () => {
    const code = `import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  useReducer,
} from 'react';`;
    const results = scanImports(code);
    expect(results).toContainEqual({
      path: "react",
      specifiers: [
        "useState",
        "useEffect",
        "useCallback",
        "useMemo",
        "useRef",
        "useContext",
        "useReducer",
      ],
    });
  });
});
