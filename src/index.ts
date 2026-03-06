import { resolve } from 'node:path';
import type { ImportreeOptions, ImportTree } from './types.js';
import { walk } from './walker.js';

export type { ImportreeOptions, ImportTree } from './types.js';

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
export async function importree(
  entry: string,
  options?: ImportreeOptions,
): Promise<ImportTree> {
  return walk(entry, options ?? {});
}

/**
 * Given an import tree and a changed file, returns all files that
 * transitively depend on the changed file (i.e., files that would
 * need to be re-evaluated if the changed file is modified).
 *
 * The changed file itself is NOT included in the result.
 */
export function getAffectedFiles(
  tree: ImportTree,
  changedFile: string,
): string[] {
  const absolute = resolve(changedFile);

  if (!tree.reverseGraph[absolute]) return [];

  const affected = new Set<string>();
  const queue = [absolute];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = tree.reverseGraph[current];
    if (!dependents) continue;

    for (const parent of dependents) {
      if (!affected.has(parent)) {
        affected.add(parent);
        queue.push(parent);
      }
    }
  }

  return [...affected].sort();
}
