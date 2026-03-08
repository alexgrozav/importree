# importree

[![npm version](https://img.shields.io/npm/v/importree)](https://www.npmjs.com/package/importree)
[![npm downloads](https://img.shields.io/npm/dm/importree)](https://www.npmjs.com/package/importree)
[![bundle size](https://img.shields.io/bundlephobia/minzip/importree)](https://bundlephobia.com/package/importree)
[![license](https://img.shields.io/npm/l/importree)](https://github.com/alexgrozav/importree/blob/main/LICENSE)

Build import dependency trees for TypeScript and JavaScript files. Fast, zero-dependency static analysis for dependency detection and cache invalidation.

When a file changes, you need to know what else is affected. importree builds the full import dependency tree for any TypeScript or JavaScript entry point — with zero dependencies and zero AST overhead.

Built for CI pipelines, build tools, monorepo task runners, and test selectors.

[Website](https://importree.js.org) · [GitHub](https://github.com/alexgrozav/importree) · [npm](https://www.npmjs.com/package/importree)

## Highlights

- **Zero dependencies** — Built entirely on Node.js built-ins. No native binaries, no WASM.
- **Fast scanning** — Regex-based import extraction with concurrent async file traversal. No AST parsing overhead.
- **Path alias support** — Resolve `@/components`, `~/utils`, or any custom alias with longest-prefix matching and automatic extension probing.
- **Cache invalidation** — Pre-computed reverse dependency graph answers "what needs rebuilding?" instantly.
- **Dual output** — Ships both ESM and CJS with full TypeScript declarations.

## Benchmarks

Measured with [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js v22. Results vary by hardware.

### Comparison with alternatives

Each tool brings different strengths — [dependency-tree](https://github.com/dependents/node-dependency-tree) offers robust AST-based analysis via detective, [madge](https://github.com/pahen/madge) supports multiple languages and provides circular dependency detection with visualization. importree trades those features for raw speed through regex-based extraction.

| Scenario           | importree   | [dependency-tree](https://github.com/dependents/node-dependency-tree) | [madge](https://github.com/pahen/madge) | Manual glob+regex | ts.createProgram |
| ------------------ | ----------- | --------------------------------------------------------------------- | --------------------------------------- | ----------------- | ---------------- |
| Small (10 files)   | **0.4 ms**  | 3.1 ms                                                                | 3.7 ms                                  | 0.6 ms            | 49.9 ms          |
| Medium (100 files) | **2.1 ms**  | 14.3 ms                                                               | 15.1 ms                                 | 5.2 ms            | 48.4 ms          |
| Large (500 files)  | **12.7 ms** | 44.4 ms                                                               | 43.3 ms                                 | 26.5 ms           | 50.9 ms          |

### Full tree build

| Project size | Mean time | Throughput   |
| ------------ | --------- | ------------ |
| 10 files     | 0.4 ms    | ~2,548 ops/s |
| 100 files    | 2.5 ms    | ~406 ops/s   |
| 500 files    | 12.1 ms   | ~83 ops/s    |
| 1,000 files  | 26.4 ms   | ~38 ops/s    |

### Scanner throughput

| Operation                     | Throughput   |
| ----------------------------- | ------------ |
| `scanImports` (3 imports)     | ~661K ops/s  |
| `scanImports` (50 imports)    | ~41K ops/s   |
| `stripComments` (1,000 lines) | ~2,497 ops/s |

> Run `pnpm bench:run` to reproduce locally.

## Install

```sh
npm install importree
# or
pnpm add importree
# or
yarn add importree
# or
bun add importree
```

Requires Node.js >= 18.

## Quick Start

### Build the tree

```ts
import { importree } from "importree";

const tree = await importree("./src/index.ts", {
  aliases: { "@": "./src" },
});

console.log(tree.files);
// ['/abs/src/index.ts', '/abs/src/app.ts', ...]

console.log(tree.externals);
// ['react', 'lodash', 'node:path']

console.log(tree.graph);
// { '/abs/src/index.ts': ['/abs/src/app.ts', ...] }
```

### Find affected files

```ts
import { importree, getAffectedFiles } from "importree";

const tree = await importree("./src/index.ts");

// When utils.ts changes, what needs rebuilding?
const affected = getAffectedFiles(tree, "./src/utils.ts");

console.log(affected);
// ['/abs/src/app.ts', '/abs/src/index.ts']
// ^ every file that transitively depends on utils.ts
```

## API

### `importree(entry, options?)`

Recursively resolves all static imports, dynamic imports, `require()` calls, and re-exports starting from the entry file. Returns the full dependency graph.

```ts
importree(entry: string, options?: ImportreeOptions): Promise<ImportTree>
```

#### Parameters

| Parameter | Type               | Required | Description                                     |
| --------- | ------------------ | -------- | ----------------------------------------------- |
| `entry`   | `string`           | Yes      | Path to the entry file (resolved against `cwd`) |
| `options` | `ImportreeOptions` | No       | Configuration for resolution behavior           |

#### `ImportreeOptions`

| Option       | Type                     | Default                                          | Description                                                 |
| ------------ | ------------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| `rootDir`    | `string`                 | `process.cwd()`                                  | Root directory for resolving relative alias paths           |
| `aliases`    | `Record<string, string>` | `{}`                                             | Path alias mappings (e.g., `{ '@': './src' }`)              |
| `extensions` | `string[]`               | `['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']` | File extensions to try when resolving extensionless imports |

#### Returns

`Promise<ImportTree>` — the resolved dependency tree.

---

### `getAffectedFiles(tree, changedFile)`

BFS traversal of the reverse dependency graph. Returns all files that transitively depend on the changed file — sorted, deterministic, and without the changed file itself.

```ts
getAffectedFiles(tree: ImportTree, changedFile: string): string[]
```

#### Parameters

| Parameter     | Type         | Required | Description                                          |
| ------------- | ------------ | -------- | ---------------------------------------------------- |
| `tree`        | `ImportTree` | Yes      | A tree previously returned by `importree()`          |
| `changedFile` | `string`     | Yes      | Path to the file that changed (resolved to absolute) |

#### Returns

`string[]` — sorted absolute paths of all files that transitively depend on the changed file. The changed file itself is excluded. Returns an empty array if the file is not in the graph.

---

### `ImportTree`

The result object returned by `importree()`.

| Field          | Type                       | Description                                                                       |
| -------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `entrypoint`   | `string`                   | Absolute path of the entry file                                                   |
| `files`        | `string[]`                 | Sorted absolute paths of all local files in the dependency tree                   |
| `externals`    | `string[]`                 | Sorted unique bare import specifiers — packages like `react`, `lodash`, `node:fs` |
| `graph`        | `Record<string, string[]>` | Forward adjacency list. Each file maps to its direct local imports.               |
| `reverseGraph` | `Record<string, string[]>` | Reverse adjacency list. Each file maps to files that import it.                   |

## What gets detected

importree extracts specifiers from all standard import patterns:

- Static imports — `import { foo } from './bar'`
- Default imports — `import foo from './bar'`
- Namespace imports — `import * as foo from './bar'`
- Side-effect imports — `import './bar'`
- Type imports — `import type { Foo } from './bar'`
- Dynamic imports — `import('./bar')`
- CommonJS require — `require('./bar')`
- Re-exports — `export { foo } from './bar'`, `export * from './bar'`

Imports inside comments and string literals are ignored.

Circular dependencies are handled — each file is visited once.

## Resolution

1. **Relative imports** (`./` or `../`) resolve against the importing file's directory.
2. **Alias imports** match against the configured `aliases` using longest-prefix matching, then resolve as relative paths from `rootDir`.
3. **Bare specifiers** (e.g., `react`, `@scope/pkg`, `node:fs`) are classified as external and collected in `externals`.

For each resolved path, importree probes in order:

1. Exact path
2. Path + each extension (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`)
3. Path as directory + `index` + each extension

## License

ISC — [Alex Grozav](https://github.com/alexgrozav)
