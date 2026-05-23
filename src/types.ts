/**
 * Configuration options for importree.
 */
export interface ImportreeOptions {
  /**
   * Root directory for resolving relative alias paths.
   * Defaults to the current working directory.
   */
  rootDir?: string;

  /**
   * Path alias mappings. Keys are alias prefixes, values are the
   * replacement paths (resolved relative to `rootDir` or absolute).
   *
   * @example { '@': './src', '~': './lib' }
   */
  aliases?: Record<string, string>;

  /**
   * File extensions to try when resolving imports without extensions.
   *
   * @default ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
   */
  extensions?: string[];
}

/**
 * A single directed edge in the import graph, carrying metadata about
 * how one file imports another.
 */
export interface ImportEdge {
  /** Absolute path of the imported file. */
  path: string;

  /**
   * Specifiers imported (original names, not aliases).
   * Contains `"default"` for default imports (e.g., `import X from '...'`).
   */
  specifiers?: string[];

  /** True when the import is `import * as X from '...'` or `export * from '...'`. */
  isNamespace?: boolean;

  /** True when the import is `import('...')`. */
  isDynamic?: boolean;

  /** True when the import is `import '...'` (side-effect only). */
  isSideEffect?: boolean;
}

/**
 * The result of building an import dependency tree.
 */
export interface ImportTree {
  /** Absolute path of the entry file. */
  entrypoint: string;

  /** Sorted array of absolute paths of all local files in the dependency tree. */
  files: string[];

  /** Sorted array of unique bare/external import specifiers (packages). */
  externals: string[];

  /**
   * Forward adjacency list: each key is an absolute file path, and its value
   * is an array of import edges describing how it depends on other files.
   */
  graph: Record<string, ImportEdge[]>;

  /**
   * Reverse adjacency list: each key is an absolute file path, and its value
   * is an array of import edges describing files that import it.
   */
  reverseGraph: Record<string, ImportEdge[]>;
}

/**
 * Result of resolving a single import specifier.
 * @internal
 */
export interface ResolvedImport {
  type: "local" | "external";
  /** Absolute file path (only for local imports). */
  absolutePath?: string;
  /** Bare specifier / package name (only for external imports). */
  specifier?: string;
}
