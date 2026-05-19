import { getOperationCard } from "@core/core/registry/index.js"
import { validateInput } from "@core/core/registry/schema-validator.js"
import { describe, expect, it, vi } from "vitest"
import { getGraphqlHandler } from "../../../src/gql/capability-registry.js"
import { runSubmitPrReview } from "../../../src/gql/domains/pr-mutations.js"
import type { GraphqlTransport } from "../../../src/gql/transport.js"

// ---------------------------------------------------------------------------
// Card-level enum validation (AJV via validateInput)
// ---------------------------------------------------------------------------

describe("pr.merge card accepts case-insensitive `method`", () => {
  function validate(method: unknown) {
    const card = getOperationCard("pr.merge")
    if (!card) throw new Error("pr.merge card missing")
    return validateInput(card.input_schema, {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      method,
    })
  }

  it("accepts lowercase 'squash'", () => {
    expect(validate("squash").ok).toBe(true)
  })

  it("accepts uppercase 'SQUASH'", () => {
    expect(validate("SQUASH").ok).toBe(true)
  })

  it("accepts lowercase 'merge'", () => {
    expect(validate("merge").ok).toBe(true)
  })

  it("accepts uppercase 'MERGE'", () => {
    expect(validate("MERGE").ok).toBe(true)
  })

  it("rejects mixed-case 'Squash'", () => {
    const result = validate("Squash")
    expect(result.ok).toBe(false)
  })
})

describe("pr.reviews.submit card accepts case-insensitive `event` and comment sides", () => {
  function buildInput(overrides: Record<string, unknown>) {
    return {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      event: "APPROVE",
      ...overrides,
    }
  }

  function validate(input: Record<string, unknown>) {
    const card = getOperationCard("pr.reviews.submit")
    if (!card) throw new Error("pr.reviews.submit card missing")
    return validateInput(card.input_schema, input)
  }

  it("accepts uppercase 'APPROVE'", () => {
    expect(validate(buildInput({ event: "APPROVE" })).ok).toBe(true)
  })

  it("accepts lowercase 'approve'", () => {
    expect(validate(buildInput({ event: "approve" })).ok).toBe(true)
  })

  it("accepts lowercase 'request_changes'", () => {
    expect(validate(buildInput({ event: "request_changes" })).ok).toBe(true)
  })

  it("rejects mixed-case 'Approve'", () => {
    expect(validate(buildInput({ event: "Approve" })).ok).toBe(false)
  })

  it("accepts lowercase comment `side` and `startSide`", () => {
    const result = validate(
      buildInput({
        body: "looks good",
        comments: [
          {
            path: "src/x.ts",
            body: "nit",
            line: 10,
            side: "right",
            startLine: 5,
            startSide: "left",
          },
        ],
      }),
    )
    expect(result.ok).toBe(true)
  })

  it("accepts uppercase comment `side` and `startSide`", () => {
    const result = validate(
      buildInput({
        body: "looks good",
        comments: [
          {
            path: "src/x.ts",
            body: "nit",
            line: 10,
            side: "RIGHT",
            startLine: 5,
            startSide: "LEFT",
          },
        ],
      }),
    )
    expect(result.ok).toBe(true)
  })

  it("rejects mixed-case comment `side`", () => {
    const result = validate(
      buildInput({
        body: "looks good",
        comments: [
          {
            path: "src/x.ts",
            body: "nit",
            line: 10,
            side: "Right",
          },
        ],
      }),
    )
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Handler-level normalization
// ---------------------------------------------------------------------------

describe("pr.merge GraphQL handler normalizes method case", () => {
  function makeMergeClient(mergePr: ReturnType<typeof vi.fn>) {
    return {
      mergePr,
    } as unknown as Parameters<NonNullable<ReturnType<typeof getGraphqlHandler>>>[0]
  }

  it("uppercase 'SQUASH' produces mergeMethod: 'SQUASH'", () => {
    const handler = getGraphqlHandler("pr.merge")
    if (!handler) throw new Error("missing pr.merge handler")
    const mergePr = vi.fn().mockResolvedValue({})
    handler(makeMergeClient(mergePr), {
      owner: "o",
      name: "r",
      prNumber: 1,
      method: "SQUASH",
    })
    expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "SQUASH" }))
  })

  it("lowercase 'squash' also produces mergeMethod: 'SQUASH'", () => {
    const handler = getGraphqlHandler("pr.merge")
    if (!handler) throw new Error("missing pr.merge handler")
    const mergePr = vi.fn().mockResolvedValue({})
    handler(makeMergeClient(mergePr), {
      owner: "o",
      name: "r",
      prNumber: 1,
      method: "squash",
    })
    expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "SQUASH" }))
  })
})

describe("pr.reviews.submit GraphQL handler normalizes event/side case", () => {
  function successMockExecute() {
    return vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: { id: "PRR_abc", state: "APPROVED", body: "" },
        },
      })
  }

  it("lowercase 'approve' is uppercased to 'APPROVE' before the SDK call", async () => {
    const execute = successMockExecute()
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      owner: "acme",
      name: "repo",
      prNumber: 42,
      event: "approve" as never,
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    expect((vars as Record<string, unknown>).event).toBe("APPROVE")
  })

  it("lowercase 'request_changes' is uppercased to 'REQUEST_CHANGES'", async () => {
    const execute = successMockExecute()
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      owner: "acme",
      name: "repo",
      prNumber: 42,
      event: "request_changes" as never,
      body: "needs work",
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    expect((vars as Record<string, unknown>).event).toBe("REQUEST_CHANGES")
  })

  it("uppercase 'APPROVE' is left as 'APPROVE'", async () => {
    const execute = successMockExecute()
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      owner: "acme",
      name: "repo",
      prNumber: 42,
      event: "APPROVE",
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    expect((vars as Record<string, unknown>).event).toBe("APPROVE")
  })

  it("lowercase comment `side`/`startSide` are uppercased to 'RIGHT'/'LEFT'", async () => {
    const execute = successMockExecute()
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      owner: "acme",
      name: "repo",
      prNumber: 42,
      event: "approve" as never,
      comments: [
        {
          path: "src/x.ts",
          body: "nit",
          line: 10,
          side: "right" as never,
          startLine: 5,
          startSide: "left" as never,
        },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    expect((vars as Record<string, unknown>).threads).toMatchObject([
      expect.objectContaining({ side: "RIGHT", startSide: "LEFT" }),
    ])
  })
})
