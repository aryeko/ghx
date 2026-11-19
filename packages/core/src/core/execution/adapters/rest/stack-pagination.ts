import { errorCodes } from "@core/core/errors/codes.js"
import { isObject } from "@core/shared/utils.js"
import { GITHUB_REST_ORIGIN, RestError } from "../rest-adapter.js"
import { invalidStackResponse } from "./stack-snapshot.js"

type StackListScope = { repo: string; first: number; prNumber: number | null }

export function encodeStackCursor(scope: StackListScope, page: number) {
  return Buffer.from(JSON.stringify({ ...scope, v: 1, page })).toString("base64url")
}

export function decodeStackCursor(scope: StackListScope, after: string | null | undefined) {
  if (after === undefined || after === null) return 1
  try {
    const decoded: unknown = JSON.parse(Buffer.from(after, "base64url").toString("utf8"))
    if (
      isObject(decoded) &&
      decoded.v === 1 &&
      decoded.repo === scope.repo &&
      decoded.first === scope.first &&
      decoded.prNumber === scope.prNumber &&
      typeof decoded.page === "number" &&
      Number.isSafeInteger(decoded.page) &&
      decoded.page > 1
    ) {
      return decoded.page
    }
  } catch {
    // Invalid JSON and invalid cursor fields share the same validation result.
  }
  throw new RestError({
    code: errorCodes.Validation,
    message: "Invalid stack cursor for this repository, PR filter, or page size",
    retryable: false,
  })
}

export function nextStackPage(link: string | null, page: number): number | null {
  const next = link?.match(/<([^>]+)>;\s*rel="next"/i)?.[1]
  if (next === undefined) return null

  const url = URL.canParse(next) ? new URL(next) : null
  const nextPage = page + 1
  if (
    url?.origin !== GITHUB_REST_ORIGIN ||
    !Number.isSafeInteger(nextPage) ||
    url.searchParams.get("page") !== String(nextPage)
  ) {
    return invalidStackResponse()
  }
  // GitHub can return a numeric repository URL. Only consume the page number.
  return nextPage
}
