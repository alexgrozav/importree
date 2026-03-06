/**
 * Strips comments from source code while preserving string literals.
 *
 * Comments are replaced with spaces (preserving newlines). Strings and
 * template literals are left intact so that import specifiers inside
 * `from 'specifier'` remain extractable. The function correctly handles
 * comment-like sequences inside strings (e.g., `'//'` won't start a comment).
 */
export function stripComments(code: string): string {
  const len = code.length;
  const result: string[] = new Array(len);
  let i = 0;

  while (i < len) {
    const ch = code[i];
    const next = i + 1 < len ? code[i + 1] : '';

    // Line comment → blank to end of line
    if (ch === '/' && next === '/') {
      result[i++] = ' ';
      result[i++] = ' ';
      while (i < len && code[i] !== '\n') {
        result[i++] = ' ';
      }
      continue;
    }

    // Block comment → blank to closing */
    if (ch === '/' && next === '*') {
      result[i++] = ' ';
      result[i++] = ' ';
      while (i < len && !(code[i] === '*' && i + 1 < len && code[i + 1] === '/')) {
        result[i] = code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < len) {
        result[i++] = ' '; // *
        result[i++] = ' '; // /
      }
      continue;
    }

    // Single or double quoted string — copy verbatim (skip past to avoid
    // misidentifying comment markers inside strings)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      result[i] = code[i];
      i++;
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < len) {
          result[i] = code[i];
          i++;
          result[i] = code[i];
          i++;
        } else {
          result[i] = code[i];
          i++;
        }
      }
      if (i < len) {
        result[i] = code[i];
        i++;
      }
      continue;
    }

    // Template literal — copy verbatim, handling ${} nesting
    if (ch === '`') {
      result[i] = code[i];
      i++;
      let depth = 0;
      while (i < len) {
        if (code[i] === '\\' && i + 1 < len) {
          result[i] = code[i];
          i++;
          result[i] = code[i];
          i++;
        } else if (code[i] === '$' && i + 1 < len && code[i + 1] === '{') {
          result[i] = code[i];
          i++;
          result[i] = code[i];
          i++;
          depth++;
        } else if (code[i] === '}' && depth > 0) {
          result[i] = code[i];
          i++;
          depth--;
        } else if (code[i] === '`' && depth === 0) {
          result[i] = code[i];
          i++;
          break;
        } else {
          result[i] = code[i];
          i++;
        }
      }
      continue;
    }

    // Regular character
    result[i] = ch;
    i++;
  }

  return result.join('');
}

// Static regex patterns — compiled once
const fromRe = /\bfrom\s+['"]([^'"]+)['"]/g;
const sideEffectRe = /\bimport\s+['"]([^'"]+)['"]/g;
const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Scans source code and extracts all import/require specifiers.
 *
 * Handles: static imports, dynamic imports, require(), re-exports.
 * Ignores imports inside comments. Imports inside string literals may
 * produce false positives, but unresolvable paths are silently skipped
 * by the resolver.
 */
export function scanImports(code: string): string[] {
  const stripped = stripComments(code);
  const specifiers = new Set<string>();

  for (const m of stripped.matchAll(fromRe)) specifiers.add(m[1]);
  for (const m of stripped.matchAll(sideEffectRe)) specifiers.add(m[1]);
  for (const m of stripped.matchAll(dynamicRe)) specifiers.add(m[1]);
  for (const m of stripped.matchAll(requireRe)) specifiers.add(m[1]);

  return [...specifiers];
}
