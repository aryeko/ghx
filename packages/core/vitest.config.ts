import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src", import.meta.url)),
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
          include: ["test/e2e/setup-install-verify.e2e.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e:sdk",
          include: ["test/e2e/setup-opencode-skill.e2e.test.ts"],
        },
      },
    ],
    reporters: ["default", "junit"],
    outputFile: { junit: "test-report.junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/gql/generated/**", "src/**/*.generated.ts"],
    },
  },
})
