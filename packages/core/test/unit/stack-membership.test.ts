import {
  addToStack,
  createStack,
  unstack,
} from "@core/core/execution/adapters/rest/stack-membership.js"
import { createRestClient } from "@core/core/execution/adapters/rest-adapter.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "Acme", name: "Widget" }
const repoPath = "/repos/Acme/Widget"
const branchRepo = { id: 123, full_name: "acme/widget" }
const pr = (number: number, base: string, head: string) => ({
  number,
  state: "open",
  merged_at: null,
  draft: false,
  node_id: `PR_${number}`,
  base: { ref: base, repo: branchRepo },
  head: { ref: head, repo: branchRepo, sha: "a".repeat(40) },
})

const schema = pr(30, "main", "schema")
const api = pr(12, "schema", "api")
const ui = pr(25, "api", "ui")
const stack = {
  number: 42,
  base: { ref: "main" },
  open: true,
  pull_requests: [schema, api],
}

function transport({
  pullRequests = [schema, api, ui],
  existingStack = Response.json(stack),
  lookupMembership = () => Response.json([]),
  respondToWrite = () => Response.json(stack, { status: 201 }),
}: {
  pullRequests?: (typeof schema)[]
  existingStack?: Response
  lookupMembership?: (prNumber: number) => Response
  respondToWrite?: () => Response
} = {}) {
  const write = vi.fn<(url: URL, options: RequestInit) => Response>(respondToWrite)
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, options) => {
    const parsed = new URL(String(url))
    if (options?.method === "POST") return write(parsed, options)
    if (parsed.pathname === `${repoPath}/stacks/42`) return existingStack
    if (parsed.pathname === `${repoPath}/stacks`) {
      return lookupMembership(Number(parsed.searchParams.get("pull_request")))
    }
    const pull = pullRequests.find(
      ({ number }) => parsed.pathname === `${repoPath}/pulls/${number}`,
    )
    return pull ? Response.json(pull) : new Response(null, { status: 404 })
  })
  return { client: createRestClient("test-token", fetch), fetch, write }
}

describe("native stack membership writes", () => {
  it("creates a stack in caller order using existing open same-repository PRs", async () => {
    const { client, write } = transport()
    const result = await createStack(client, repoPath, { ...repo, prNumbers: [30, 12] })

    expect(result).toMatchObject({
      stackNumber: 42,
      baseRefName: "main",
      members: [
        { prNumber: 30, position: 1, state: "OPEN" },
        { prNumber: 12, position: 2, state: "OPEN" },
      ],
    })
    expect(write).toHaveBeenCalledTimes(1)
    const call = write.mock.calls[0]
    expect(call?.[0].pathname).toBe(`${repoPath}/stacks`)
    expect(call?.[1].body).toBe(JSON.stringify({ pull_requests: [30, 12] }))
  })

  it.each([
    { name: "out-of-order PRs", prNumbers: [12, 30] },
    { name: "duplicate PRs", prNumbers: [30, 30] },
    { name: "a closed PR", prNumbers: [30, 12], replacement: { ...api, state: "closed" } },
    {
      name: "the same ref in a fork",
      prNumbers: [30, 12],
      replacement: { ...api, head: { ...api.head, repo: { ...branchRepo, id: 999 } } },
    },
    {
      name: "a different repo name",
      prNumbers: [30, 12],
      replacement: {
        ...api,
        base: { ...api.base, repo: { ...branchRepo, full_name: "other/widget" } },
      },
    },
  ])("rejects $name before submitting create", async ({ prNumbers, replacement }) => {
    const { client, write } = transport({ pullRequests: [schema, replacement ?? api] })

    await expect(createStack(client, repoPath, { ...repo, prNumbers })).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects existing membership from a PR-filtered lookup", async () => {
    const lookupMembership = (number: number) => Response.json(number === 12 ? [stack] : [])
    const { client, write } = transport({ lookupMembership })

    await expect(
      createStack(client, repoPath, { ...repo, prNumbers: [30, 12] }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", details: { prNumber: 12, stackNumber: 42 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("appends only new PRs after the current top", async () => {
    const top = pr(6, "ui", "test")
    const { client, fetch, write } = transport({
      pullRequests: [schema, api, ui, top],
      respondToWrite: () => Response.json({ ...stack, pull_requests: [schema, api, ui, top] }),
    })
    const result = await addToStack(client, repoPath, {
      ...repo,
      stackNumber: 42,
      expectedTopPrNumber: 12,
      prNumbers: [25, 6],
    })

    expect(result.members.map(({ prNumber }) => prNumber)).toEqual([30, 12, 25, 6])
    const call = write.mock.calls[0]
    expect(call?.[0].pathname).toBe(`${repoPath}/stacks/42/add`)
    expect(call?.[1].body).toBe(JSON.stringify({ pull_requests: [25, 6] }))
    expect(String(fetch.mock.calls.at(-2)?.[0])).toBe(`https://api.github.com${repoPath}/stacks/42`)
  })

  it("rejects an append when the observed top differs", async () => {
    const { client, write } = transport()

    await expect(
      addToStack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedTopPrNumber: 30,
        prNumbers: [25],
      }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", details: { expectedTopPrNumber: 30, actualTopPrNumber: 12 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects an append with fresh top but mismatched base ref", async () => {
    const { client, write } = transport({ pullRequests: [pr(25, "other", "ui")] })

    await expect(
      addToStack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedTopPrNumber: 12,
        prNumbers: [25],
      }),
    ).rejects.toMatchObject({ result: { code: "VALIDATION" } })
    expect(write).not.toHaveBeenCalled()
  })

  it.each(["main", "schema"])("rejects appending a PR that revisits %s", async (head) => {
    const { client, write } = transport({ pullRequests: [pr(25, "api", head)] })

    await expect(
      addToStack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedTopPrNumber: 12,
        prNumbers: [25],
      }),
    ).rejects.toMatchObject({ result: { code: "VALIDATION" } })
    expect(write).not.toHaveBeenCalled()
  })

  it("refuses to unstack a snapshot that advertises more members", async () => {
    const { client, write } = transport({
      existingStack: Response.json(stack, {
        headers: {
          link: `<https://api.github.com${repoPath}/stacks/42?page=2>; rel="next"`,
        },
      }),
    })

    await expect(
      unstack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedPrNumbers: [30, 12],
      }),
    ).rejects.toMatchObject({ result: { code: "SERVER" } })
    expect(write).not.toHaveBeenCalled()
  })

  it("does not unstack stale membership, including an order-only mismatch", async () => {
    const { client, write } = transport()

    await expect(
      unstack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedPrNumbers: [12, 30],
      }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", details: { actualPrNumbers: [30, 12] } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("reports retained members when GitHub returns 200 without selecting a subset to unstack", async () => {
    const { client, write } = transport({
      respondToWrite: () => Response.json({ ...stack, pull_requests: [schema] }),
    })
    const result = await unstack(client, repoPath, {
      ...repo,
      stackNumber: 42,
      expectedPrNumbers: [30, 12],
    })

    expect(result).toMatchObject({
      dissolved: false,
      remainingPrNumbers: [30],
      stack: { stackNumber: 42, members: [{ prNumber: 30, position: 1 }] },
    })
    const call = write.mock.calls[0]
    expect(call?.[0].pathname).toBe(`${repoPath}/stacks/42/unstack`)
    expect(call?.[1].body).toBeUndefined()
  })

  it("reports dissolution when GitHub returns 204", async () => {
    const { client } = transport({ respondToWrite: () => new Response(null, { status: 204 }) })

    await expect(
      unstack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedPrNumbers: [30, 12],
      }),
    ).resolves.toEqual({ dissolved: true, remainingPrNumbers: [] })
  })

  it.each([409, 422])("preserves a definitive %s rejection without replay", async (status) => {
    const { client, write } = transport({
      respondToWrite: () => new Response("private response", { status }),
    })
    await expect(
      addToStack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedTopPrNumber: 12,
        prNumbers: [25],
      }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false, details: { status } },
    })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it("returns an unknown outcome after dispatch fails and supplies identifiers for reconciliation", async () => {
    const { client, write } = transport({
      respondToWrite: () => {
        throw new DOMException("timed out", "TimeoutError")
      },
    })
    await expect(
      addToStack(client, repoPath, {
        ...repo,
        stackNumber: 42,
        expectedTopPrNumber: 12,
        prNumbers: [25],
      }),
    ).rejects.toMatchObject({
      result: {
        retryable: false,
        details: {
          submissionOutcome: "unknown",
          repo: "Acme/Widget",
          stackNumber: 42,
          prNumbers: [25],
          expectedPrNumbers: [30, 12, 25],
        },
      },
    })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it("returns an unknown outcome for a malformed successful response and includes a known stack number", async () => {
    const { client, write } = transport({
      respondToWrite: () =>
        Response.json(
          { number: 42 },
          { status: 201, headers: { "x-github-request-id": "AB:1234" } },
        ),
    })
    await expect(
      createStack(client, repoPath, {
        ...repo,
        prNumbers: [30, 12],
      }),
    ).rejects.toMatchObject({
      result: {
        retryable: false,
        details: {
          submissionOutcome: "unknown",
          repo: "Acme/Widget",
          stackNumber: 42,
          prNumbers: [30, 12],
          status: 201,
          githubRequestId: "AB:1234",
        },
      },
    })
    expect(write).toHaveBeenCalledTimes(1)
  })
})
