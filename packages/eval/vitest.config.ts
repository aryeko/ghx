import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@eval": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/e2e/**"],
        },
      },
    ],
    reporters: ["default", "junit"],
    outputFile: { junit: "test-report.junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        // SDK-dependent provider — integration tested only, no unit test
        "src/provider/opencode-provider.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        // Vitest 4's AST-based V8 remapping removes the false-positive branch coverage from v3.
        branches: 80,
        statements: 90,
      },
    },
  },
})
