import { describe, bench } from "vitest";
import { scanImports, stripComments } from "../scanner.js";
import { generateHeavyCommentFile, generateMixedImportFile } from "./generate-fixtures.js";

describe("stripComments", () => {
  const file100 = generateHeavyCommentFile(100);
  const file500 = generateHeavyCommentFile(500);
  const file1000 = generateHeavyCommentFile(1000);
  const file5000 = generateHeavyCommentFile(5000);

  bench("100 lines", () => {
    stripComments(file100);
  });
  bench("500 lines", () => {
    stripComments(file500);
  });
  bench("1000 lines", () => {
    stripComments(file1000);
  });
  bench("5000 lines", () => {
    stripComments(file5000);
  });
});

describe("scanImports", () => {
  const few = [
    `import { a } from './a';`,
    `import { b } from './b';`,
    `import { c } from './c';`,
    `export const x = 1;`,
  ].join("\n");

  const twenty = generateMixedImportFile(20);
  const fifty = generateMixedImportFile(50);

  bench("3 imports", () => {
    scanImports(few);
  });
  bench("20 mixed imports", () => {
    scanImports(twenty);
  });
  bench("50 mixed imports", () => {
    scanImports(fifty);
  });
});
