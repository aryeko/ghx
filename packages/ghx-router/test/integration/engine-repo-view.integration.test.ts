import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { capabilityRegistry } from "../../src/core/routing/capability-registry.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask repo.view", () => {
  it("returns cli envelope when cli preflight passes", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      ghCliAvailable: true,
      ghAuthenticated: true,
      cliRunner: {
        run: async () => ({
          stdout: JSON.stringify({
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" }
          }),
          stderr: "",
          exitCode: 0
        })
      }
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

  it("auto-detects cli availability and uses cli route", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      cliRunner: {
        run: async (_command, args) => {
          if (args[0] === "--version") {
            return { stdout: "gh version 2.x", stderr: "", exitCode: 0 }
          }

          if (args[0] === "auth" && args[1] === "status") {
            return { stdout: "authenticated", stderr: "", exitCode: 0 }
          }

          return {
            stdout: JSON.stringify({
              id: "repo-id",
              name: "modkit",
              nameWithOwner: "go-modkit/modkit",
              isPrivate: false,
              stargazerCount: 10,
              forkCount: 2,
              url: "https://github.com/go-modkit/modkit",
              defaultBranchRef: { name: "main" }
            }),
            stderr: "",
            exitCode: 0
          }
        }
      }
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

  it("returns graphql envelope for repo.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query RepoView")) {
          return {
            repository: {
              id: "repo-id",
              name: "modkit",
              nameWithOwner: "go-modkit/modkit",
              isPrivate: false,
              stargazerCount: 10,
              forkCount: 2,
              url: "https://github.com/go-modkit/modkit",
              defaultBranchRef: { name: "main" }
            }
          } as TData
        }

        throw new Error("Unexpected query")
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.meta.reason).toBe("CARD_PREFERRED")
    expect(result.data).toEqual(
      expect.objectContaining({
        nameWithOwner: "go-modkit/modkit",
        defaultBranch: "main"
      })
    )
  })

  it("returns validation error envelope for invalid repo input", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.route_used).toBe("cli")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("returns validation error envelope for unsupported task", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.delete",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("Unsupported task")
  })

  it("returns auth error when graphql token is missing", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "",
      ghCliAvailable: false,
      ghAuthenticated: false
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.message).toContain("token")
  })

  it("falls back from cli to graphql when cli execution fails", async () => {
    const capability = capabilityRegistry.find((entry) => entry.task === "repo.view")
    if (!capability) {
      throw new Error("repo.view capability missing")
    }

    const originalDefaultRoute = capability.defaultRoute
    const originalFallbackRoutes = [...capability.fallbackRoutes]

    capability.defaultRoute = "cli"
    capability.fallbackRoutes = ["graphql"]

    try {
      const githubClient = createGithubClient({
        async execute<TData>(query: string): Promise<TData> {
          if (query.includes("query RepoView")) {
            return {
              repository: {
                id: "repo-id",
                name: "modkit",
                nameWithOwner: "go-modkit/modkit",
                isPrivate: false,
                stargazerCount: 10,
                forkCount: 2,
                url: "https://github.com/go-modkit/modkit",
                defaultBranchRef: { name: "main" }
              }
            } as TData
          }

          throw new Error("Unexpected query")
        }
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" }
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: true,
        ghAuthenticated: true,
        cliRunner: {
          run: async () => ({ stdout: "", stderr: "network error", exitCode: 1 })
        }
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
    } finally {
      capability.defaultRoute = originalDefaultRoute
      capability.fallbackRoutes = originalFallbackRoutes
    }
  })

  it("continues to graphql when cli preflight fails and fallback exists", async () => {
    const capability = capabilityRegistry.find((entry) => entry.task === "repo.view")
    if (!capability) {
      throw new Error("repo.view capability missing")
    }

    const originalDefaultRoute = capability.defaultRoute
    const originalFallbackRoutes = [...capability.fallbackRoutes]

    capability.defaultRoute = "cli"
    capability.fallbackRoutes = ["graphql"]

    try {
      const githubClient = createGithubClient({
        async execute<TData>(query: string): Promise<TData> {
          if (query.includes("query RepoView")) {
            return {
              repository: {
                id: "repo-id",
                name: "modkit",
                nameWithOwner: "go-modkit/modkit",
                isPrivate: false,
                stargazerCount: 10,
                forkCount: 2,
                url: "https://github.com/go-modkit/modkit",
                defaultBranchRef: { name: "main" }
              }
            } as TData
          }

          throw new Error("Unexpected query")
        }
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" }
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: false,
        ghAuthenticated: false
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
    } finally {
      capability.defaultRoute = originalDefaultRoute
      capability.fallbackRoutes = originalFallbackRoutes
    }
  })
})
