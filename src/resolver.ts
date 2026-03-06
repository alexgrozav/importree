import { statSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import type { ImportreeOptions, ResolvedImport } from './types.js';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function fileExists(filePath: string): boolean {
  const stat = statSync(filePath, { throwIfNoEntry: false });
  return stat !== undefined && stat.isFile();
}

function dirExists(filePath: string): boolean {
  const stat = statSync(filePath, { throwIfNoEntry: false });
  return stat !== undefined && stat.isDirectory();
}

/**
 * Extract the bare package name from an import specifier.
 * - Scoped: `@scope/pkg/path` → `@scope/pkg`
 * - Unscoped: `pkg/path` → `pkg`
 */
function getBareSpecifier(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

function resolveFile(
  filePath: string,
  extensions: string[],
): string | undefined {
  // Try exact path
  if (fileExists(filePath)) return filePath;

  // Try with each extension
  for (const ext of extensions) {
    const withExt = filePath + ext;
    if (fileExists(withExt)) return withExt;
  }

  // Try as directory with index file
  if (dirExists(filePath)) {
    for (const ext of extensions) {
      const indexPath = join(filePath, `index${ext}`);
      if (fileExists(indexPath)) return indexPath;
    }
  }

  return undefined;
}

export interface Resolver {
  (specifier: string, fromFile: string): ResolvedImport | undefined;
}

/**
 * Creates a resolver function that resolves import specifiers to absolute
 * file paths, with support for aliases and extension probing.
 */
export function createResolver(
  basedir: string,
  options: ImportreeOptions,
): Resolver {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  // Sort aliases by key length descending for longest-prefix matching
  const aliases = options.aliases
    ? Object.entries(options.aliases).sort((a, b) => b[0].length - a[0].length)
    : [];

  const resolvedAliasValues = aliases.map(([key, value]) => [
    key,
    isAbsolute(value) ? value : resolve(basedir, value),
  ] as const);

  const cache = new Map<string, ResolvedImport | undefined>();

  return function resolveSpecifier(
    specifier: string,
    fromFile: string,
  ): ResolvedImport | undefined {
    const fromDir = dirname(fromFile);
    const cacheKey = `${specifier}\0${fromDir}`;

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    let result: ResolvedImport | undefined;

    // Relative import
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const absolutePath = resolveFile(resolve(fromDir, specifier), extensions);
      if (absolutePath) {
        result = { type: 'local', absolutePath };
      }
    }
    // Check aliases
    else {
      let matched = false;
      for (const [prefix, replacement] of resolvedAliasValues) {
        if (specifier === prefix || specifier.startsWith(prefix + '/')) {
          const rest = specifier === prefix ? '' : specifier.slice(prefix.length);
          const absolutePath = resolveFile(join(replacement, rest), extensions);
          if (absolutePath) {
            result = { type: 'local', absolutePath };
          }
          matched = true;
          break;
        }
      }

      // Bare specifier → external
      if (!matched) {
        result = { type: 'external', specifier: getBareSpecifier(specifier) };
      }
    }

    cache.set(cacheKey, result);
    return result;
  };
}
