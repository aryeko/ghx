import { createStack } from "@core/core/execution/adapters/rest/stack-membership.js"
import type { RestClient } from "@core/core/execution/adapters/rest-adapter.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "Acme", name: "Widget" }
const repoPath = "/repos/Acme/Widget"

describe("native stack membership client boundaries", () => {
  it.each([[30], [30, 0], [30, 1.5]].map((prNumbers) => ({ prNumbers })))(
    "rejects invalid PR numbers before fetching data ($prNumbers)",
    async ({ prNumbers }) => {
      const read = vi.fn<RestClient["read"]>()
      const request = vi.fn<RestClient["request"]>()

      await expect(
        createStack({ read, request }, repoPath, { ...repo, prNumbers }),
      ).rejects.toMatchObject({
        result: { code: "VALIDATION", retryable: false },
      })
      expect(read).not.toHaveBeenCalled()
      expect(request).not.toHaveBeenCalled()
    },
  )

  it("treats an unclassified transport exception as an unknown outcome", async () => {
    const target = { id: 123, full_name: "acme/widget" }
    const branch = (ref: string) => ({ ref, repo: target })
    const headers = new Headers()
    const read = vi.fn<RestClient["read"]>().mockImplementation(async (path) => {
      if (path === `${repoPath}/stacks`) return { status: 200, data: [], headers }
      const number = Number(path.split("/").at(-1))
      const [base, head] = number === 30 ? ["main", "schema"] : ["schema", "api"]
      return {
        status: 200,
        data: { number, state: "open", base: branch(base), head: branch(head) },
        headers,
      }
    })
    const request = vi.fn<RestClient["request"]>().mockRejectedValue(new TypeError("raw failure"))

    await expect(
      createStack({ read, request }, repoPath, { ...repo, prNumbers: [30, 12] }),
    ).rejects.toMatchObject({
      result: {
        code: "SERVER",
        retryable: false,
        details: { submissionOutcome: "unknown", repo: "Acme/Widget", prNumbers: [30, 12] },
      },
    })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
