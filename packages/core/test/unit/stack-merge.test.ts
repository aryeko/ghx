import { mergeStack, readMergeRequest } from "@core/core/execution/adapters/rest/stack-merge.js"
import { createRestClient } from "@core/core/execution/adapters/rest-adapter.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "example", name: "project" }
const repoPath = "/repos/example/project"
const requestId = "630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42"
const firstSha = "a".repeat(40)
const targetSha = "b".repeat(40)
const commitSha = "c".repeat(40)
const pendingDetails = {
  uuid: requestId,
  expected_head_sha: targetSha,
  merge_method: "default",
  merge_action: "default",
  bypass_rules: false,
  message: "Waiting for GitHub to process the request.",
}

const input = {
  ...repo,
  stackNumber: 9,
  throughPrNumber: 2,
  expectedBaseRefName: "main",
  expectedMembers: [
    { prNumber: 15, headSha: firstSha },
    { prNumber: 2, headSha: targetSha },
  ],
}

function member(number: number, sha: string, ref: string, base: string, merged = false) {
  return {
    number,
    node_id: `PR_${number}`,
    head: { ref, sha },
    base: { ref: base },
    state: merged ? "closed" : "open",
    merged_at: merged ? "2026-11-01T00:00:00Z" : null,
    draft: false,
  }
}

const history = member(42, commitSha, "history", "main", true)
const lower = member(15, firstSha, "schema", "main")
const target = member(2, targetSha, "api", "schema")
const top = member(10, "d".repeat(40), "ui", "api")
const stack = {
  number: 9,
  base: { ref: "main" },
  open: true,
  pull_requests: [history, lower, target, top],
}

function prepare() {
  const fetch = vi.fn<typeof globalThis.fetch>()
  return { fetch, client: createRestClient("example", fetch) }
}

function json(status: number, data: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers })
}

describe("native stack merge", () => {
  it("preflights the ordered open prefix and submits the target's SHA to merge-async", async () => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(json(202, { status: "pending", details: pendingDetails }))

    await expect(mergeStack(client, repoPath, input)).resolves.toEqual({
      status: "pending",
      requestId,
      expectedHeadSha: targetSha,
      method: "default",
      mergeAction: "default",
      bypassRules: false,
      message: pendingDetails.message,
      previewPrNumbers: [15, 2],
    })
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      `https://api.github.com${repoPath}/stacks/9`,
      `https://api.github.com${repoPath}/pulls/2/merge-async`,
    ])
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ sha: targetSha, merge_action: "default" }),
    })
  })

  it.each([
    ["changed trunk", { ...stack, base: { ref: "release" } }, input],
    ["target missing", { ...stack, pull_requests: [history, lower] }, input],
    [
      "target already merged",
      {
        ...stack,
        pull_requests: [
          history,
          lower,
          { ...target, state: "closed", merged_at: "2026-11-01T00:00:00Z" },
        ],
      },
      input,
    ],
    [
      "closed predecessor",
      { ...stack, pull_requests: [history, { ...lower, state: "closed" }, target] },
      input,
    ],
    [
      "new predecessor",
      {
        ...stack,
        pull_requests: [
          history,
          lower,
          { ...top, base: { ref: "schema" } },
          { ...target, base: { ref: "ui" } },
        ],
      },
      input,
    ],
    [
      "changed predecessor head",
      {
        ...stack,
        pull_requests: [history, { ...lower, head: { ...lower.head, sha: commitSha } }, target],
      },
      input,
    ],
    [
      "changed target head",
      {
        ...stack,
        pull_requests: [history, lower, { ...target, head: { ...target.head, sha: commitSha } }],
      },
      input,
    ],
    [
      "reordered preview",
      stack,
      { ...input, expectedMembers: [...input.expectedMembers].reverse() },
    ],
  ] as const)("rejects a preview with %s before submitting", async (_, latest, selected) => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(json(200, latest))

    await expect(mergeStack(client, repoPath, selected)).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("requires direct merge when specifying a merge method", async () => {
    const { client, fetch } = prepare()
    await expect(
      mergeStack(client, repoPath, { ...input, method: "squash" }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects an incomplete stack snapshot before submitting", async () => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(
      json(200, stack, { link: `<https://api.github.com${repoPath}/stacks/9?page=2>; rel="next"` }),
    )
    await expect(mergeStack(client, repoPath, input)).rejects.toMatchObject({
      result: { code: "SERVER", retryable: false },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("sends a direct merge method and accepts an immediate merge without a UUID", async () => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(
        json(200, { status: "merged", details: { sha: commitSha, message: "Merged" } }),
      )

    await expect(
      mergeStack(client, repoPath, { ...input, mergeAction: "direct_merge", method: "squash" }),
    ).resolves.toEqual({
      status: "merged",
      mergeCommitSha: commitSha,
      message: "Merged",
      previewPrNumbers: [15, 2],
    })
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({
      sha: targetSha,
      merge_action: "direct_merge",
      merge_method: "squash",
    })
  })

  it("accepts an immediate queue outcome with no merge SHA", async () => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(
        json(200, { status: "enqueued", details: { message: "Already in the queue" } }),
      )

    await expect(
      mergeStack(client, repoPath, { ...input, mergeAction: "merge_queue" }),
    ).resolves.toEqual({
      status: "enqueued",
      message: "Already in the queue",
      previewPrNumbers: [15, 2],
    })
  })

  it("returns the conflicting UUID even when the existing request options match", async () => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(json(409, { status: "pending", details: pendingDetails }))
    await expect(mergeStack(client, repoPath, input)).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false, details: { status: 409, requestId } },
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("returns a definitive conflict with an unreadable upstream body", async () => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(new Response("not JSON", { status: 409 }))

    const pending = mergeStack(client, repoPath, input)
    await expect(pending).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false, details: { status: 409 } },
    })
    await expect(pending).rejects.not.toHaveProperty("result.details.requestId")
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([400, 422])("leaves a definitive HTTP %s rejection as validation", async (status) => {
    const { client, fetch } = prepare()
    fetch
      .mockResolvedValueOnce(json(200, stack))
      .mockResolvedValueOnce(
        json(status, { status: "failed", details: { message: "Upstream-only text" } }),
      )
    await expect(mergeStack(client, repoPath, input)).rejects.toMatchObject({
      result: { code: "VALIDATION", retryable: false, details: { status } },
    })
  })

  it.each([
    ["network failure", () => Promise.reject(new Error("transport error")), {}],
    ["invalid JSON", async () => new Response("no JSON", { status: 202 }), {}],
    [
      "server failure",
      async () => json(503, {}, { "x-github-request-id": "1A2B:3C4D:5E6F" }),
      { status: 503, githubRequestId: "1A2B:3C4D:5E6F" },
    ],
    [
      "wrong state",
      async () =>
        json(
          202,
          { status: "accepted", details: pendingDetails },
          { "x-github-request-id": "1A2B:3C4D:5E6F" },
        ),
      { requestId, githubRequestId: "1A2B:3C4D:5E6F" },
    ],
    [
      "unexpected request head",
      async () =>
        json(202, {
          status: "pending",
          details: { ...pendingDetails, expected_head_sha: firstSha },
        }),
      { requestId },
    ],
    [
      "unsafe request ID",
      async () =>
        json(202, { status: "pending", details: { ...pendingDetails, uuid: "../wrong" } }),
      {},
    ],
    ["merged with no commit SHA", async () => json(200, { status: "merged", details: {} }), {}],
  ] as const)("reports an unknown write outcome on %s", async (_, reply, safeDetails) => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(json(200, stack)).mockImplementationOnce(reply)
    const result = mergeStack(client, repoPath, input)
    await expect(result).rejects.toMatchObject({
      result: {
        code: "SERVER",
        retryable: false,
        details: {
          ...repo,
          stackNumber: 9,
          throughPrNumber: 2,
          prNumbers: [15, 2],
          submissionOutcome: "unknown",
          ...safeDetails,
        },
      },
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe("native stack merge request lookup", () => {
  it.each([
    [
      "pending",
      pendingDetails,
      { expectedHeadSha: targetSha, mergeAction: "default", method: "default", bypassRules: false },
    ],
    ["merged", { sha: commitSha, message: "Merged" }, { mergeCommitSha: commitSha }],
    ["enqueued", { message: "Waiting in merge queue" }, {}],
    ["failed", { message: "Merge conflict; update branches" }, {}],
  ] as const)("normalizes a %s lookup", async (status, details, expected) => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(json(200, { status, details }))
    await expect(
      readMergeRequest(client, repoPath, { ...repo, prNumber: 2, requestId }),
    ).resolves.toEqual({
      status,
      requestId,
      message: details.message,
      ...expected,
    })
    expect(fetch.mock.calls[0]?.[0].toString()).toBe(
      `https://api.github.com${repoPath}/pulls/2/merge-async/${requestId}`,
    )
  })

  it("rejects a pending response whose UUID does not match the lookup", async () => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(
      json(200, {
        status: "pending",
        details: { ...pendingDetails, uuid: "92132716-821c-496f-be52-9e112ccd9be9" },
      }),
    )
    await expect(
      readMergeRequest(client, repoPath, { ...repo, prNumber: 2, requestId }),
    ).rejects.toMatchObject({
      result: { code: "SERVER", retryable: false },
    })
  })

  it("omits sensitive upstream text from a failed request", async () => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(
      json(200, {
        status: "failed",
        details: { message: "Merge rule rejected token=example-value" },
      }),
    )
    await expect(
      readMergeRequest(client, repoPath, { ...repo, prNumber: 2, requestId }),
    ).resolves.toEqual({
      status: "failed",
      requestId,
    })
  })

  it("reports possible expiration on HTTP 404 and directs the caller to PR state", async () => {
    const { client, fetch } = prepare()
    fetch.mockResolvedValueOnce(json(404, { message: "Not Found" }))
    await expect(
      readMergeRequest(client, repoPath, { ...repo, prNumber: 2, requestId }),
    ).rejects.toMatchObject({
      result: {
        code: "NOT_FOUND",
        retryable: false,
        message: expect.stringMatching(/24 hours.*pr\.view/),
        details: { ...repo, status: 404, prNumber: 2, requestId },
      },
    })
  })
})
