import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    benchmark: {
      include: ["src/**/*.bench.ts"],
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/__tests__/**",
        "src/__benchmarks__/**",
        "src/types.ts",
      ],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 95,
        statements: 99,
      },
    },
  },
});
