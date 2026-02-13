import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/**",
        "src/runner/**",
        "src/scenario/loader.ts",
        "src/report/**",
        "src/extract/envelope.ts"
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90
      }
    }
  }
})
