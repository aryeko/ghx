import { mergeStack, readMergeRequest } from "@core/core/execution/adapters/rest/stack-merge.js"
import { createRestClient, type RestClient } from "@core/core/execution/adapters/rest-adapter.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "example", name: "project" }
const repoPath = "/repos/example/project"
const prNumber = 21
const lookup = {
  ...repo,
  prNumber,
  requestId: "630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42",
}
const headSha = "a".repeat(40)
const pendingDetails = {
  uuid: lookup.requestId,
  expected_head_sha: headSha,
  merge_action: "default",
  merge_method: "default",
}

describe("native stack merge reconciliation", () => {
  it.each([
    ["direct_merge", "merge"],
    ["direct_merge", "squash"],
    ["direct_merge", "rebase"],
    ["merge_queue", "default"],
  ])("preserves the pending %s action and %s method", async (mergeAction, method) => {
    const restFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        status: "pending",
        details: {
          ...pendingDetails,
          uuid: lookup.requestId.toUpperCase(),
          merge_action: mergeAction,
          merge_method: method,
        },
      }),
    )

    await expect(
      readMergeRequest(createRestClient("test-token", restFetch), repoPath, lookup),
    ).resolves.toEqual({
      status: "pending",
      requestId: lookup.requestId,
      expectedHeadSha: headSha,
      mergeAction,
      method,
    })
  })

  it.each([
    ["non-object response", null],
    ["missing details", { status: "pending" }],
    ["missing UUID", { status: "pending", details: { ...pendingDetails, uuid: undefined } }],
    [
      "unsupported method",
      { status: "pending", details: { ...pendingDetails, merge_method: "fast-forward" } },
    ],
    [
      "unsupported action",
      { status: "pending", details: { ...pendingDetails, merge_action: "retry" } },
    ],
    [
      "short expected head",
      { status: "pending", details: { ...pendingDetails, expected_head_sha: "abcd" } },
    ],
  ])("rejects an invalid merge result with %s", async (_, upstream) => {
    const restFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(upstream))

    await expect(
      readMergeRequest(createRestClient("test-token", restFetch), repoPath, lookup),
    ).rejects.toMatchObject({
      result: {
        code: "SERVER",
        message: "GitHub returned an invalid asynchronous merge result",
        retryable: false,
        details: lookup,
      },
    })
  })

  it("rejects an invalid lookup UUID before issuing a REST request", async () => {
    const restFetch = vi.fn<typeof fetch>()

    await expect(
      readMergeRequest(createRestClient("test-token", restFetch), repoPath, {
        ...lookup,
        requestId: "../21",
      }),
    ).rejects.toMatchObject({
      result: { code: "VALIDATION", message: "requestId must be a merge request UUID" },
    })
    expect(restFetch).not.toHaveBeenCalled()
  })

  it("preserves an authorization failure during request lookup", async () => {
    const restFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 403 }))

    await expect(
      readMergeRequest(createRestClient("test-token", restFetch), repoPath, lookup),
    ).rejects.toMatchObject({
      result: { code: "AUTH", retryable: false, details: { status: 403 } },
    })
  })

  it("keeps the selected scope when the write client rejects unexpectedly", async () => {
    const stackNumber = 9
    const restFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        number: stackNumber,
        base: { ref: "main" },
        open: true,
        pull_requests: [
          {
            number: prNumber,
            node_id: "PR_21",
            head: { ref: "feature", sha: headSha },
            base: { ref: "main" },
            state: "open",
            merged_at: null,
            draft: false,
          },
        ],
      }),
    )
    const request = vi
      .fn<RestClient["request"]>()
      .mockRejectedValueOnce(new Error("write interrupted"))
    const client = { ...createRestClient("test-token", restFetch), request }

    await expect(
      mergeStack(client, repoPath, {
        ...repo,
        stackNumber,
        throughPrNumber: prNumber,
        expectedBaseRefName: "main",
        expectedMembers: [{ prNumber, headSha }],
      }),
    ).rejects.toMatchObject({
      result: {
        code: "SERVER",
        retryable: false,
        details: {
          ...repo,
          stackNumber,
          throughPrNumber: prNumber,
          prNumbers: [prNumber],
          submissionOutcome: "unknown",
        },
      },
    })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
