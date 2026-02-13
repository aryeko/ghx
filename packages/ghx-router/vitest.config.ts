import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/gql/generated/**",
        "src/gql/operations/*.generated.ts",
        "src/cli/**",
        "src/agent-interface/prompt/**",
        "src/agent-interface/tools/explain-tool.ts",
        "src/shared/**",
        "src/core/contracts/tasks/**",
        "src/core/execute/execute.ts",
        "src/core/execution/adapters/cli-adapter.ts",
        "src/core/execution/adapters/cli-capability-adapter.ts",
        "src/core/execution/adapters/rest-adapter.ts",
        "src/core/registry/index.ts",
        "src/core/routing/reason-codes.ts",
        "src/gql/client.ts"
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
