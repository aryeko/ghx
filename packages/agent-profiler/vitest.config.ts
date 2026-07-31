import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@profiler": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/e2e/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e:local",
          include: ["test/e2e/**/*.local.e2e.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e:sdk",
          include: ["test/e2e/**/*.sdk.e2e.test.ts"],
        },
      },
    ],
    reporters: ["default", "junit"],
    outputFile: { junit: "test-report.junit.xml" },
    retry: 1,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
