/**
 * Strips comments from source code while preserving string literals.
 *
 * Line comments (`//`) are removed entirely. Block comments are replaced
 * with a single space (newlines within them are preserved). Strings and
 * template literals are left intact so that import specifiers inside
 * `from 'specifier'` remain extractable. The function correctly handles
 * comment-like sequences inside strings (e.g., `'//'` won't start a comment).
 */
export function stripComments(code: string): string {
  const len = code.length;
  const parts: string[] = [];
  let i = 0;
  let segStart = 0;

  while (i < len) {
    const ch = code[i];
    const next = i + 1 < len ? code[i + 1] : "";

    if (ch === "/" && next === "/") {
      parts.push(code.slice(segStart, i));
      while (i < len && code[i] !== "\n") i++;
      segStart = i;
      continue;
    }

    if (ch === "/" && next === "*") {
      parts.push(code.slice(segStart, i));
      i += 2;
      while (i < len && !(code[i] === "*" && i + 1 < len && code[i + 1] === "/")) {
        if (code[i] === "\n") parts.push("\n");
        i++;
      }
      if (i < len) i += 2;
      parts.push(" ");
      segStart = i;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < len && code[i] !== quote) {
        if (code[i] === "\\" && i + 1 < len) i++;
        i++;
      }
      if (i < len) i++;
      continue;
    }

    if (ch === "`") {
      i++;
      let depth = 0;
      while (i < len) {
        if (code[i] === "\\" && i + 1 < len) {
          i += 2;
        } else if (code[i] === "$" && i + 1 < len && code[i + 1] === "{") {
          i += 2;
          depth++;
        } else if (code[i] === "}" && depth > 0) {
          i++;
          depth--;
        } else if (code[i] === "`" && depth === 0) {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    i++;
  }

  parts.push(code.slice(segStart));
  return parts.join("");
}

export interface RawImport {
  path: string;
  specifiers?: string[];
  isNamespace?: boolean;
  isDynamic?: boolean;
  isSideEffect?: boolean;
}

// Static regex patterns — compiled once
const nsImportRe = /\bimport\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g;
const namedImportRe =
  /\bimport\s+(?:type\s+)?(?:(\w+)\s*,\s*)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
const defaultImportRe = /\bimport\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g;
const reexportStarRe = /\bexport\s+\*\s+(?:as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/g;
const reexportNamedRe = /\bexport\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
const sideEffectRe = /\bimport\s+['"]([^'"]+)['"]/g;
const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function parseSpecifiers(clause: string): string[] {
  return clause
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const withoutType = s.replace(/^type\s+/, "");
      const parts = withoutType.split(/\s+as\s+/);
      return parts[0].trim();
    })
    .filter(Boolean);
}

/**
 * Scans source code and extracts all imports with metadata.
 *
 * Handles: static imports, dynamic imports, require(), re-exports.
 * Ignores imports inside comments. Imports inside string literals may
 * produce false positives, but unresolvable paths are silently skipped
 * by the resolver.
 */
export function scanImports(code: string): RawImport[] {
  const stripped = stripComments(code);
  const results: RawImport[] = [];

  for (const m of stripped.matchAll(nsImportRe)) {
    results.push({ path: m[1], isNamespace: true });
  }

  for (const m of stripped.matchAll(namedImportRe)) {
    const specifiers = parseSpecifiers(m[2]);
    if (m[1]) specifiers.unshift("default");
    results.push({ path: m[3], specifiers });
  }

  for (const m of stripped.matchAll(defaultImportRe)) {
    results.push({ path: m[2], specifiers: ["default"] });
  }

  for (const m of stripped.matchAll(reexportStarRe)) {
    results.push({ path: m[1], isNamespace: true });
  }

  for (const m of stripped.matchAll(reexportNamedRe)) {
    results.push({ path: m[2], specifiers: parseSpecifiers(m[1]) });
  }

  for (const m of stripped.matchAll(sideEffectRe)) {
    results.push({ path: m[1], isSideEffect: true });
  }

  for (const m of stripped.matchAll(dynamicRe)) {
    results.push({ path: m[1], isDynamic: true });
  }

  for (const m of stripped.matchAll(requireRe)) {
    results.push({ path: m[1] });
  }

  return results;
}
