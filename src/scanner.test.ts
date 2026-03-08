import { describe, it, expect } from "vitest";
import { stripComments, scanImports } from "./scanner.js";

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

describe("scanImports", () => {
  it("extracts static named import", () => {
    expect(scanImports("import { foo } from './foo';")).toContain("./foo");
  });

  it("extracts static default import", () => {
    expect(scanImports("import foo from './foo';")).toContain("./foo");
  });

  it("extracts namespace import", () => {
    expect(scanImports("import * as foo from './foo';")).toContain("./foo");
  });

  it("extracts side-effect import", () => {
    expect(scanImports("import './side-effect';")).toContain("./side-effect");
  });

  it("extracts type import", () => {
    expect(scanImports("import type { Foo } from './types';")).toContain("./types");
  });

  it("extracts dynamic import", () => {
    expect(scanImports("const m = import('./lazy');")).toContain("./lazy");
  });

  it("extracts dynamic import with await", () => {
    expect(scanImports("const m = await import('./lazy');")).toContain("./lazy");
  });

  it("extracts require()", () => {
    expect(scanImports("const m = require('./cjs');")).toContain("./cjs");
  });

  it("extracts export from", () => {
    expect(scanImports("export { foo } from './foo';")).toContain("./foo");
  });

  it("extracts export * from", () => {
    expect(scanImports("export * from './all';")).toContain("./all");
  });

  it("extracts export type from", () => {
    expect(scanImports("export type { Foo } from './types';")).toContain("./types");
  });

  it("deduplicates specifiers", () => {
    const code = "import { a } from './x';\nimport { b } from './x';";
    const result = scanImports(code);
    expect(result.filter((s) => s === "./x")).toHaveLength(1);
  });

  it("ignores imports inside line comments", () => {
    const code = "// import { fake } from './fake';\nimport { real } from './real';";
    const result = scanImports(code);
    expect(result).toContain("./real");
    expect(result).not.toContain("./fake");
  });

  it("ignores imports inside block comments", () => {
    const code = "/* import { fake } from './fake'; */\nimport { real } from './real';";
    const result = scanImports(code);
    expect(result).toContain("./real");
    expect(result).not.toContain("./fake");
  });

  it("handles multi-line import statement", () => {
    const code = "import {\n  foo,\n  bar,\n} from './multi';";
    expect(scanImports(code)).toContain("./multi");
  });

  it("extracts multiple different specifiers", () => {
    const code = `
      import { a } from './a';
      import b from './b';
      export * from './c';
      const d = import('./d');
      const e = require('./e');
    `;
    const result = scanImports(code);
    expect(result).toContain("./a");
    expect(result).toContain("./b");
    expect(result).toContain("./c");
    expect(result).toContain("./d");
    expect(result).toContain("./e");
  });

  it("handles external package specifiers", () => {
    const code = "import lodash from 'lodash';\nimport { join } from 'node:path';";
    const result = scanImports(code);
    expect(result).toContain("lodash");
    expect(result).toContain("node:path");
  });
});
