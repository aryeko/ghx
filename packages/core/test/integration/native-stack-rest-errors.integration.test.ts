import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const githubClient = createGithubClient({
  async execute<T>(): Promise<T> {
    throw new Error("Unexpected GraphQL request")
  },
})
const request = { task: "pr.stack.list", input: { owner: "acme", name: "widget" } }

async function listWith(response: Response) {
  const restFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
  const result = await executeTask(request, {
    githubClient,
    githubToken: "test-token",
    githubHost: "github.com",
    restFetch,
  })
  expect(restFetch).toHaveBeenCalledTimes(1)
  return result
}

describe("REST stack read errors", () => {
  it("recognizes a secondary rate limit without retry headers", async () => {
    const result = await listWith(
      Response.json(
        { message: "You have exceeded a secondary rate limit. Private response text" },
        { status: 403, headers: { "x-ratelimit-remaining": "50" } },
      ),
    )
    expect(result.error).toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
      details: { status: 403, retryAfterSeconds: 60 },
    })
    expect(JSON.stringify(result)).not.toContain("Private response text")
  })

  it("distinguishes an ordinary forbidden response from throttling", async () => {
    const result = await listWith(Response.json({ message: "Resource forbidden" }, { status: 403 }))
    expect(result.error).toMatchObject({ code: "AUTH", retryable: false })
    expect(result.error?.details).not.toHaveProperty("retryAfterSeconds")
  })

  it("honors reset time for an exhausted primary rate limit", async () => {
    const result = await listWith(
      new Response(null, {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1760000000" },
      }),
    )
    expect(result.error).toMatchObject({
      code: "RATE_LIMIT",
      details: { rateLimitReset: 1760000000 },
    })
    expect(result.error?.details).not.toHaveProperty("retryAfterSeconds")
  })

  it("uses the minimum backoff for a 429 without timing headers", async () => {
    const result = await listWith(new Response(null, { status: 429 }))
    expect(result.error).toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
      details: { retryAfterSeconds: 60 },
    })
  })

  it("classifies interrupted 200 response bodies as retryable network failures", async () => {
    const interrupted = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError("Private transfer error"))
        },
      }),
    )
    const result = await listWith(interrupted)
    expect(result.error).toMatchObject({ code: "NETWORK", retryable: true })
    expect(JSON.stringify(result)).not.toContain("Private transfer error")
  })
})
