import { describe, bench, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { importree } from '../index.js';
import { createFixture, type Fixture } from './generate-fixtures.js';

const fixtures: Record<string, Fixture> = {};

beforeAll(() => {
  fixtures.small = createFixture('small');
  fixtures.medium = createFixture('medium');
  fixtures.large = createFixture('large');
  fixtures.xlarge = createFixture('xlarge');
});

afterAll(() => {
  for (const f of Object.values(fixtures)) f.cleanup();
});

describe('importree', () => {
  bench('small (10 files)', async () => {
    await importree(fixtures.small.entryFile, {
      rootDir: fixtures.small.rootDir,
      aliases: { '@': join(fixtures.small.rootDir, 'modules') },
    });
  });

  bench('medium (100 files)', async () => {
    await importree(fixtures.medium.entryFile, {
      rootDir: fixtures.medium.rootDir,
      aliases: { '@': join(fixtures.medium.rootDir, 'modules') },
    });
  });

  bench('large (500 files)', async () => {
    await importree(fixtures.large.entryFile, {
      rootDir: fixtures.large.rootDir,
      aliases: { '@': join(fixtures.large.rootDir, 'modules') },
    });
  });

  bench('xlarge (1000 files)', async () => {
    await importree(fixtures.xlarge.entryFile, {
      rootDir: fixtures.xlarge.rootDir,
      aliases: { '@': join(fixtures.xlarge.rootDir, 'modules') },
    });
  });
});
