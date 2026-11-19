import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { normalizeError, normalizeResult } from "../normalizer.js"
import { readStack } from "./rest/read-stack.js"
import { addToStack, createStack, unstack } from "./rest/stack-membership.js"
import { decodeStackCursor, encodeStackCursor, nextStackPage } from "./rest/stack-pagination.js"
import { parseStackList, publicStackSnapshot } from "./rest/stack-snapshot.js"
import { readStackStatus } from "./rest/stack-status.js"
import { createRestClient, RestError, type RestReader } from "./rest-adapter.js"

type RepoInput = { owner: string; name: string }

async function listStacks(
  read: RestReader,
  path: string,
  input: RepoInput & { first: number; after?: string | null; prNumber?: number },
) {
  const { owner, name, first, after, prNumber = null } = input
  const scope = { repo: `${owner}/${name}`.toLowerCase(), first, prNumber }
  const page = decodeStackCursor(scope, after)
  const search = new URLSearchParams({ per_page: String(first), page: String(page) })
  if (prNumber !== null) search.set("pull_request", String(prNumber))
  const { data, headers } = await read(path, search)
  const next = nextStackPage(headers.get("link"), page)
  return {
    items: parseStackList(data),
    pageInfo: {
      hasNextPage: next !== null,
      endCursor: next === null ? null : encodeStackCursor(scope, next),
    },
  }
}

export async function runRestCapability(
  task: string,
  params: Record<string, unknown>,
  token: string,
  restFetch: typeof fetch,
  github: GithubClient,
): Promise<ResultEnvelope> {
  const meta = { capabilityId: task, reason: "CARD_PREFERRED" as const }
  const client = createRestClient(token, restFetch)
  const { read } = client
  const { owner, name } = params as RepoInput
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  const { stackNumber, throughPrNumber } = params as {
    stackNumber: number
    throughPrNumber?: number
  }
  const getStack = () => readStack(read, repoPath, stackNumber)

  try {
    switch (task) {
      case "pr.stack.list":
        return normalizeResult(
          await listStacks(read, `${repoPath}/stacks`, params as Parameters<typeof listStacks>[2]),
          "rest",
          meta,
        )
      case "pr.stack.view":
        return normalizeResult(publicStackSnapshot(await getStack()), "rest", meta)
      case "pr.stack.status":
        return normalizeResult(
          await readStackStatus(getStack, github, throughPrNumber),
          "rest",
          meta,
        )
      case "pr.stack.create":
        return normalizeResult(
          await createStack(client, repoPath, params as Parameters<typeof createStack>[2]),
          "rest",
          meta,
        )
      case "pr.stack.add":
        return normalizeResult(
          await addToStack(client, repoPath, params as Parameters<typeof addToStack>[2]),
          "rest",
          meta,
        )
      case "pr.stack.unstack":
        return normalizeResult(
          await unstack(client, repoPath, params as Parameters<typeof unstack>[2]),
          "rest",
          meta,
        )
      default:
        return normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: "Unsupported REST task",
            retryable: false,
          },
          "rest",
          meta,
        )
    }
  } catch (error) {
    return normalizeError(
      error instanceof RestError
        ? error.result
        : {
            code: errorCodes.Server,
            message: "Could not process GitHub REST response",
            retryable: false,
          },
      "rest",
      meta,
    )
  }
}
