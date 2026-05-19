import { execute } from "@core/core/execute/execute.js"
import { handlers } from "@core/core/execution/adapters/cli/domains/pr.js"
import type { CliHandler } from "@core/core/execution/adapters/cli/helpers.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { validateInput } from "@core/core/registry/schema-validator.js"
import { describe, expect, it, vi } from "vitest"

const handler = (id: string): CliHandler => {
  const fn = handlers[id]
  if (fn === undefined) throw new Error(`no handler: ${id}`)
  return fn
}

function loadPrMergeCard() {
  const card = getOperationCard("pr.merge")
  if (!card) throw new Error("pr.merge card not found")
  return card
}

describe("pr.merge admin/auto card schema", () => {
  it("accepts admin: true on its own", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      admin: true,
    })
    expect(result.ok).toBe(true)
  })

  it("accepts auto: true on its own", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      auto: true,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects admin: true AND auto: true simultaneously", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      admin: true,
      auto: true,
    })
    expect(result.ok).toBe(false)
    const errors = result.ok ? [] : result.errors
    expect(errors.some((e) => e.keyword === "not")).toBe(true)
  })

  it("accepts input with neither admin nor auto", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })
    expect(result.ok).toBe(true)
  })

  it("accepts admin: false and auto: false together (only true+true is forbidden)", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      admin: false,
      auto: false,
    })
    expect(result.ok).toBe(true)
  })

  it("rejects non-boolean admin", () => {
    const card = loadPrMergeCard()
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      admin: "yes",
    })
    expect(result.ok).toBe(false)
  })

  it("rejects non-boolean auto", () => {
    const card = loadPrMergeCard()
    // AJV coerceTypes (issue #6) maps 0/1 → false/true and "true"/"false" → boolean.
    // Use a non-coercible string so the type assertion still fails.
    const result = validateInput(card.input_schema, {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      auto: "maybe",
    })
    expect(result.ok).toBe(false)
  })
})

describe("pr.merge admin/auto routing", () => {
  const alwaysPassPreflight = vi.fn(async () => ({ ok: true as const }))

  it("routes to cli when admin:true", async () => {
    const card = loadPrMergeCard()
    const cli = vi.fn(async () => ({
      ok: true as const,
      data: {
        prNumber: 1,
        method: "merge",
        isMethodAssumed: true,
        queued: true,
        deleteBranch: false,
        admin: true,
      },
      meta: { capability_id: "pr.merge", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true as const,
      data: {},
      meta: { capability_id: "pr.merge", route_used: "graphql" as const },
    }))

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit", prNumber: 1, admin: true },
      preflight: alwaysPassPreflight,
      routes: { graphql, cli, rest: vi.fn() },
    })

    expect(result.ok).toBe(true)
    expect(cli).toHaveBeenCalledTimes(1)
    expect(graphql).not.toHaveBeenCalled()
  })

  it("routes to cli when auto:true", async () => {
    const card = loadPrMergeCard()
    const cli = vi.fn(async () => ({
      ok: true as const,
      data: {
        prNumber: 1,
        method: "merge",
        isMethodAssumed: true,
        queued: true,
        deleteBranch: false,
        auto: true,
      },
      meta: { capability_id: "pr.merge", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true as const,
      data: {},
      meta: { capability_id: "pr.merge", route_used: "graphql" as const },
    }))

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit", prNumber: 1, auto: true },
      preflight: alwaysPassPreflight,
      routes: { graphql, cli, rest: vi.fn() },
    })

    expect(result.ok).toBe(true)
    expect(cli).toHaveBeenCalledTimes(1)
    expect(graphql).not.toHaveBeenCalled()
  })

  it("routes to graphql preferred when neither admin nor auto is set", async () => {
    const card = loadPrMergeCard()
    const cli = vi.fn(async () => ({
      ok: true as const,
      data: {
        prNumber: 1,
        method: "merge",
        isMethodAssumed: true,
        queued: true,
        deleteBranch: false,
      },
      meta: { capability_id: "pr.merge", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true as const,
      data: {
        prNumber: 1,
        method: "merge",
        isMethodAssumed: true,
        queued: true,
        deleteBranch: false,
      },
      meta: { capability_id: "pr.merge", route_used: "graphql" as const },
    }))

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit", prNumber: 1 },
      preflight: alwaysPassPreflight,
      routes: { graphql, cli, rest: vi.fn() },
    })

    expect(result.ok).toBe(true)
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(cli).not.toHaveBeenCalled()
  })

  it("routes to cli when deleteBranch:true", async () => {
    const card = loadPrMergeCard()
    const cli = vi.fn(async () => ({
      ok: true as const,
      data: {
        prNumber: 1,
        method: "merge",
        isMethodAssumed: true,
        queued: true,
        deleteBranch: true,
      },
      meta: { capability_id: "pr.merge", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true as const,
      data: {},
      meta: { capability_id: "pr.merge", route_used: "graphql" as const },
    }))

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit", prNumber: 1, deleteBranch: true },
      preflight: alwaysPassPreflight,
      routes: { graphql, cli, rest: vi.fn() },
    })

    expect(result.ok).toBe(true)
    expect(cli).toHaveBeenCalledTimes(1)
    expect(graphql).not.toHaveBeenCalled()
  })
})

describe("pr.merge CLI handler --admin and --auto flags", () => {
  it("appends --admin when admin:true", async () => {
    const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
    const runner = { run: runSpy } as unknown as CliCommandRunner

    const result = await handler("pr.merge")(
      runner,
      {
        owner: "owner",
        name: "repo",
        prNumber: 123,
        admin: true,
      },
      undefined,
    )

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      prNumber: 123,
      method: "merge",
      isMethodAssumed: true,
      queued: true,
      deleteBranch: false,
      admin: true,
    })
    expect(result.data).not.toHaveProperty("auto")
    expect(runSpy).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["pr", "merge", "123", "--merge", "--admin"]),
      expect.any(Number),
    )
  })

  it("appends --auto when auto:true", async () => {
    const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
    const runner = { run: runSpy } as unknown as CliCommandRunner

    const result = await handler("pr.merge")(
      runner,
      {
        owner: "owner",
        name: "repo",
        prNumber: 123,
        method: "squash",
        auto: true,
      },
      undefined,
    )

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      prNumber: 123,
      method: "squash",
      isMethodAssumed: false,
      queued: true,
      deleteBranch: false,
      auto: true,
    })
    expect(result.data).not.toHaveProperty("admin")
    expect(runSpy).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["pr", "merge", "123", "--squash", "--auto"]),
      expect.any(Number),
    )
  })

  it("does not append flags when admin/auto are false or undefined", async () => {
    const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
    const runner = { run: runSpy } as unknown as CliCommandRunner

    const result = await handler("pr.merge")(
      runner,
      {
        owner: "owner",
        name: "repo",
        prNumber: 123,
        admin: false,
        auto: false,
      },
      undefined,
    )

    expect(result.ok).toBe(true)
    expect(result.data).not.toHaveProperty("admin")
    expect(result.data).not.toHaveProperty("auto")
    const args = runSpy.mock.calls[0]?.[1] as string[]
    expect(args).not.toContain("--admin")
    expect(args).not.toContain("--auto")
  })

  it("returns validation error for non-boolean admin", async () => {
    const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
    const runner = { run: runSpy } as unknown as CliCommandRunner

    const result = await handler("pr.merge")(
      runner,
      {
        owner: "owner",
        name: "repo",
        prNumber: 123,
        admin: "yes",
      },
      undefined,
    )

    expect(result.ok).toBe(false)
    expect(runSpy).not.toHaveBeenCalled()
  })

  it("returns validation error for non-boolean auto", async () => {
    const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
    const runner = { run: runSpy } as unknown as CliCommandRunner

    const result = await handler("pr.merge")(
      runner,
      {
        owner: "owner",
        name: "repo",
        prNumber: 123,
        auto: 1,
      },
      undefined,
    )

    expect(result.ok).toBe(false)
    expect(runSpy).not.toHaveBeenCalled()
  })
})
