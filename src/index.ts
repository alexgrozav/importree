import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ImportreeOptions, ImportTree, ImportEdge } from "./types.js";
import { buildEdges, walk } from "./walker.js";
import { scanImports } from "./scanner.js";
import { createResolver } from "./resolver.js";

export type { ImportreeOptions, ImportTree, ImportEdge } from "./types.js";

/**
 * Builds a full import dependency tree starting from an entry file.
 *
 * Recursively resolves all static imports, dynamic imports, require() calls,
 * and re-exports. Supports path aliases for custom resolution.
 *
 * @example
 * ```ts
 * const tree = await importree('./src/index.ts', {
 *   aliases: { '@': './src' },
 * });
 *
 * console.log(tree.files);      // all local dependency file paths
 * console.log(tree.externals);  // external package names
 * console.log(tree.graph);      // file → direct dependencies
 * ```
 */
export async function importree(entry: string, options?: ImportreeOptions): Promise<ImportTree> {
  return walk(entry, options ?? {});
}

/**
 * Parses a single file and returns its direct import edges without recursive traversal.
 *
 * @example
 * ```ts
 * const edges = parseImports('./src/components/Button.tsx', {
 *   aliases: { '@': './src' },
 * });
 *
 * for (const edge of edges) {
 *   console.log(edge.path, edge.specifiers);
 * }
 * ```
 */
export function parseImports(filePath: string, options?: ImportreeOptions): ImportEdge[] {
  const absolutePath = resolve(filePath);
  const basedir = options?.rootDir ? resolve(options.rootDir) : process.cwd();
  const resolveSpecifier = createResolver(basedir, options ?? {});

  const content = readFileSync(absolutePath, "utf-8");
  const rawImports = scanImports(content);
  const { edges } = buildEdges(rawImports, resolveSpecifier, absolutePath);

  return edges;
}

/**
 * Given an import tree and a changed file, returns all files that
 * transitively depend on the changed file (i.e., files that would
 * need to be re-evaluated if the changed file is modified).
 *
 * The changed file itself is NOT included in the result.
 */
export function getAffectedFiles(tree: ImportTree, changedFile: string): string[] {
  const absolute = resolve(changedFile);

  if (!tree.reverseGraph[absolute]) return [];

  const affected = new Set<string>();
  const queue = [absolute];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = tree.reverseGraph[current];
    if (!dependents) continue;

    for (const edge of dependents) {
      if (!affected.has(edge.path)) {
        affected.add(edge.path);
        queue.push(edge.path);
      }
    }
  }

  affected.delete(absolute);
  return [...affected].sort();
}
