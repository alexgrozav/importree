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
   * is an array of absolute paths of files it directly imports.
   */
  graph: Record<string, string[]>;

  /**
   * Reverse adjacency list: each key is an absolute file path, and its value
   * is an array of absolute paths of files that import it.
   */
  reverseGraph: Record<string, string[]>;
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
