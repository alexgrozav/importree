import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ImportreeOptions, ImportTree, ImportEdge } from "./types.js";
import { scanImports } from "./scanner.js";
import { createResolver } from "./resolver.js";

/**
 * Walks imports starting from an entry file and builds the full dependency tree.
 * Uses iterative DFS with an explicit stack to avoid call-stack limits on deep chains.
 */
export async function walk(entryFile: string, options: ImportreeOptions): Promise<ImportTree> {
  const entrypoint = resolve(entryFile);
  const basedir = options.rootDir ? resolve(options.rootDir) : process.cwd();
  const resolveSpecifier = createResolver(basedir, options);

  const graph: Record<string, ImportEdge[]> = {};
  const externals = new Set<string>();
  const visited = new Set<string>();
  const stack = [entrypoint];

  while (stack.length > 0) {
    const filePath = stack.pop()!;
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    const content = readFileSync(filePath, "utf-8");
    const rawImports = scanImports(content);

    const edges: ImportEdge[] = [];
    for (const raw of rawImports) {
      const resolved = resolveSpecifier(raw.path, filePath);
      if (!resolved) continue;

      if (resolved.type === "external" && resolved.specifier) {
        externals.add(resolved.specifier);
      } else if (resolved.type === "local" && resolved.absolutePath) {
        const existing = edges.find((e) => e.path === resolved.absolutePath);
        if (existing) {
          if (raw.isNamespace) {
            existing.isNamespace = true;
            existing.specifiers = undefined;
            existing.isSideEffect = undefined;
          } else if (raw.specifiers && !existing.isNamespace) {
            (existing.specifiers ??= []).push(...raw.specifiers);
            existing.isSideEffect = undefined;
          }
          if (raw.isSideEffect && !existing.specifiers && !existing.isNamespace) {
            existing.isSideEffect = true;
          }
          if (raw.isDynamic) existing.isDynamic = true;
        } else {
          edges.push({
            path: resolved.absolutePath,
            specifiers: raw.specifiers,
            isNamespace: raw.isNamespace,
            isDynamic: raw.isDynamic,
            isSideEffect: raw.isSideEffect,
          });
        }
      }
    }

    graph[filePath] = edges;

    for (const edge of edges) stack.push(edge.path);
  }

  // Build reverse graph
  const reverseGraph: Record<string, ImportEdge[]> = {};
  for (const file of Object.keys(graph)) {
    reverseGraph[file] = [];
  }
  for (const [file, edges] of Object.entries(graph)) {
    for (const edge of edges) {
      if (!reverseGraph[edge.path]) reverseGraph[edge.path] = [];
      reverseGraph[edge.path].push({
        path: file,
        specifiers: edge.specifiers,
        isNamespace: edge.isNamespace,
        isDynamic: edge.isDynamic,
        isSideEffect: edge.isSideEffect,
      });
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
