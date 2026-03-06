import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ImportreeOptions, ImportTree } from './types.js';
import { scanImports } from './scanner.js';
import { createResolver } from './resolver.js';

/**
 * Recursively walks imports starting from an entry file and builds
 * the full dependency tree.
 */
export async function walk(
  entryFile: string,
  options: ImportreeOptions,
): Promise<ImportTree> {
  const entrypoint = resolve(entryFile);
  const basedir = options.rootDir ? resolve(options.rootDir) : process.cwd();
  const resolveSpecifier = createResolver(basedir, options);

  const graph: Record<string, string[]> = {};
  const externals = new Set<string>();
  const visited = new Set<string>();

  async function visit(filePath: string): Promise<void> {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const content = await readFile(filePath, 'utf-8');
    const specifiers = scanImports(content);

    const localDeps: string[] = [];
    for (const spec of specifiers) {
      const resolved = resolveSpecifier(spec, filePath);
      if (!resolved) continue;

      if (resolved.type === 'external' && resolved.specifier) {
        externals.add(resolved.specifier);
      } else if (resolved.type === 'local' && resolved.absolutePath) {
        localDeps.push(resolved.absolutePath);
      }
    }

    graph[filePath] = localDeps;

    await Promise.all(localDeps.map((dep) => visit(dep)));
  }

  await visit(entrypoint);

  // Build reverse graph
  const reverseGraph: Record<string, string[]> = {};
  for (const file of Object.keys(graph)) {
    reverseGraph[file] = [];
  }
  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (!reverseGraph[dep]) reverseGraph[dep] = [];
      reverseGraph[dep].push(file);
    }
  }

  return {
    entrypoint,
    files: Object.keys(graph).sort(),
    externals: [...externals].sort(),
    graph,
    reverseGraph,
  };
}
