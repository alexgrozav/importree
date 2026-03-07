import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface Fixture {
  rootDir: string;
  entryFile: string;
  cleanup: () => void;
}

export type FixtureSize = 'small' | 'medium' | 'large' | 'xlarge';

export const SIZES: Record<FixtureSize, { fileCount: number; label: string }> = {
  small: { fileCount: 10, label: 'small (10 files)' },
  medium: { fileCount: 100, label: 'medium (100 files)' },
  large: { fileCount: 500, label: 'large (500 files)' },
  xlarge: { fileCount: 1000, label: 'xlarge (1000 files)' },
};

/**
 * Generates a realistic TypeScript file with the given imports and filler content.
 */
function generateFileContent(index: number, imports: string[], useAlias: boolean): string {
  const lines: string[] = [];

  // JSDoc header
  lines.push(`/**`);
  lines.push(` * Module file-${String(index).padStart(4, '0')}`);
  lines.push(` * Auto-generated benchmark fixture`);
  lines.push(` */`);
  lines.push('');

  // Import statements — mix static, type, and dynamic styles
  for (let i = 0; i < imports.length; i++) {
    const dep = imports[i];
    const prefix = useAlias && Math.random() < 0.1 ? '@/' : './';
    const specifier = `${prefix}${dep}`;

    if (i % 5 === 0 && i > 0) {
      // Dynamic import
      lines.push(`const mod${i} = await import('${specifier}');`);
    } else if (i % 7 === 0) {
      // Type import
      lines.push(`import type { Type${i} } from '${specifier}';`);
    } else if (i % 4 === 0) {
      // Re-export
      lines.push(`export { value${i} } from '${specifier}';`);
    } else {
      // Static import
      lines.push(`import { value${i} } from '${specifier}';`);
    }
  }

  lines.push('');

  // Interface
  lines.push(`interface Config${index} {`);
  lines.push(`  name: string;`);
  lines.push(`  enabled: boolean;`);
  lines.push(`  count: number;`);
  lines.push(`}`);
  lines.push('');

  // Exported function
  lines.push(`/** Process data for module ${index} */`);
  lines.push(`export function process${index}(input: string): string {`);
  lines.push(`  const result = input.toUpperCase();`);
  lines.push(`  return result + '-${index}';`);
  lines.push(`}`);
  lines.push('');

  // Exported constant and type
  lines.push(`export const value${index} = ${index};`);
  lines.push(`export type Type${index} = Config${index} & { id: number };`);
  lines.push('');

  // Filler lines to bring file to realistic size
  for (let f = 0; f < 10 + (index % 20); f++) {
    lines.push(`const _internal${f} = '${index}-${f}';`);
  }

  return lines.join('\n');
}

/**
 * Creates a synthetic project fixture of the given size.
 *
 * Graph patterns:
 * - Chain (~30%): linear file-0 → file-1 → ... → file-N
 * - Diamond (~20%): groups of 4 in diamond pattern
 * - Wide (~20%): single barrel importing many siblings
 * - Standalone (~30%): random 1-3 deps from existing files
 */
export function createFixture(size: FixtureSize): Fixture {
  const { fileCount } = SIZES[size];
  const rootDir = mkdtempSync(join(tmpdir(), 'importree-bench-'));
  const modulesDir = join(rootDir, 'modules');
  mkdirSync(modulesDir, { recursive: true });

  const chainCount = Math.floor(fileCount * 0.3);
  const diamondCount = Math.floor(fileCount * 0.2);
  const wideCount = Math.floor(fileCount * 0.2);
  const standaloneCount = fileCount - chainCount - diamondCount - wideCount;

  const pad = (n: number) => String(n).padStart(4, '0');
  let fileIndex = 0;

  // Chain: file-0 → file-1 → ... → file-(chainCount-1)
  for (let i = 0; i < chainCount; i++) {
    const deps = i < chainCount - 1 ? [`file-${pad(fileIndex + 1)}`] : [];
    const content = generateFileContent(fileIndex, deps, size !== 'small');
    writeFileSync(join(modulesDir, `file-${pad(fileIndex)}.ts`), content);
    fileIndex++;
  }

  // Diamond: groups of 4 → a imports b,c → b,c import d
  const diamondGroups = Math.floor(diamondCount / 4);
  for (let g = 0; g < diamondGroups; g++) {
    const a = fileIndex;
    const b = fileIndex + 1;
    const c = fileIndex + 2;
    const d = fileIndex + 3;

    writeFileSync(join(modulesDir, `file-${pad(a)}.ts`),
      generateFileContent(a, [`file-${pad(b)}`, `file-${pad(c)}`], false));
    writeFileSync(join(modulesDir, `file-${pad(b)}.ts`),
      generateFileContent(b, [`file-${pad(d)}`], false));
    writeFileSync(join(modulesDir, `file-${pad(c)}.ts`),
      generateFileContent(c, [`file-${pad(d)}`], false));
    writeFileSync(join(modulesDir, `file-${pad(d)}.ts`),
      generateFileContent(d, [], false));

    fileIndex += 4;
  }
  // Remaining diamond files (< 4) become standalone
  const diamondRemainder = diamondCount - diamondGroups * 4;

  // Wide: barrel file imports all wide siblings
  const wideStart = fileIndex;
  for (let i = 0; i < wideCount; i++) {
    writeFileSync(join(modulesDir, `file-${pad(fileIndex)}.ts`),
      generateFileContent(fileIndex, [], false));
    fileIndex++;
  }
  // Barrel file
  const barrelImports = Array.from({ length: wideCount }, (_, i) => `file-${pad(wideStart + i)}`);
  writeFileSync(join(modulesDir, `barrel.ts`),
    generateFileContent(9999, barrelImports, false));

  // Standalone: random 1-3 deps from already created files
  const totalStandalone = standaloneCount + diamondRemainder;
  for (let i = 0; i < totalStandalone; i++) {
    const depCount = 1 + (i % 3);
    const deps: string[] = [];
    for (let d = 0; d < depCount; d++) {
      const depIdx = (i * 7 + d * 13) % fileIndex; // deterministic pseudo-random
      deps.push(`file-${pad(depIdx)}`);
    }
    writeFileSync(join(modulesDir, `file-${pad(fileIndex)}.ts`),
      generateFileContent(fileIndex, deps, size !== 'small'));
    fileIndex++;
  }

  // Entry file: imports chain head, barrel, first diamond root, a few standalone files
  const entryImports: string[] = [];
  if (chainCount > 0) entryImports.push('file-0000');
  entryImports.push('barrel');
  if (diamondGroups > 0) entryImports.push(`file-${pad(chainCount)}`); // first diamond root
  // A few standalone files
  for (let i = 0; i < Math.min(3, totalStandalone); i++) {
    entryImports.push(`file-${pad(fileIndex - totalStandalone + i)}`);
  }

  const entryLines: string[] = [
    '/**',
    ' * Entry point - benchmark fixture',
    ' */',
    '',
    ...entryImports.map((dep, i) => `import { value${i} } from './modules/${dep}';`),
    '',
    `export const main = 'entry';`,
  ];
  writeFileSync(join(rootDir, 'index.ts'), entryLines.join('\n'));

  return {
    rootDir,
    entryFile: join(rootDir, 'index.ts'),
    cleanup: () => rmSync(rootDir, { recursive: true, force: true }),
  };
}

/**
 * Generates a file with heavy comment content for benchmarking stripComments.
 */
export function generateHeavyCommentFile(lineCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    if (i % 5 === 0) {
      lines.push(`/** JSDoc comment for item ${i} @param x - the value */`);
    } else if (i % 5 === 1) {
      lines.push(`// Single-line comment describing line ${i}`);
    } else if (i % 5 === 2) {
      lines.push(`/* Block comment ${i} */ const x${i} = ${i};`);
    } else if (i % 5 === 3) {
      lines.push(`const str${i} = "not // a comment ${i}";`);
    } else {
      lines.push(`import { thing${i} } from './module-${i}';`);
    }
  }
  return lines.join('\n');
}

/**
 * Generates a file with many mixed import patterns for benchmarking scanImports.
 */
export function generateMixedImportFile(importCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < importCount; i++) {
    if (i % 5 === 0) {
      lines.push(`import { item${i} } from './static-${i}';`);
    } else if (i % 5 === 1) {
      lines.push(`import type { Type${i} } from './type-${i}';`);
    } else if (i % 5 === 2) {
      lines.push(`const mod${i} = await import('./dynamic-${i}');`);
    } else if (i % 5 === 3) {
      lines.push(`const req${i} = require('./cjs-${i}');`);
    } else {
      lines.push(`export { val${i} } from './reexport-${i}';`);
    }
  }
  // Add filler
  lines.push('');
  lines.push('export const main = true;');
  return lines.join('\n');
}
