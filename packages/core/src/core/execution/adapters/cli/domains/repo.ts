import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  commandTokens,
  DEFAULT_TIMEOUT_MS,
  jsonFieldsFromCard,
  parseCliData,
  parseListFirst,
  REPO_ISSUE_TYPES_GRAPHQL_QUERY,
  sanitizeCliErrorMessage,
} from "../helpers.js"

export const handleRepoView: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const args = commandTokens(card, "repo view")
    if (repo) {
      args.push(repo)
    }

    args.push(
      "--json",
      jsonFieldsFromCard(
        card,
        "id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef",
      ),
    )

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "repo.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "repo.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const input =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const defaultBranchRef =
      typeof input.defaultBranchRef === "object" && input.defaultBranchRef !== null
        ? (input.defaultBranchRef as Record<string, unknown>)
        : null

    const normalized = {
      id: input.id,
      name: input.name,
      nameWithOwner: input.nameWithOwner,
      isPrivate: input.isPrivate,
      stargazerCount: input.stargazerCount,
      forkCount: input.forkCount,
      url: input.url,
      defaultBranch: typeof defaultBranchRef?.name === "string" ? defaultBranchRef.name : null,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "repo.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "repo.view", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "repo.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleRepoLabelsList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for repo.labels.list")
    }

    const args = commandTokens(card, "label list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push(
      "--limit",
      String(first),
      "--json",
      jsonFieldsFromCard(card, "id,name,description,color,isDefault"),
    )

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "repo.labels.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "repo.labels.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const labels = Array.isArray(data) ? data : []

    const normalized = {
      items: labels.map((label) => {
        if (typeof label !== "object" || label === null || Array.isArray(label)) {
          return {
            id: null,
            name: null,
            description: null,
            color: null,
            isDefault: null,
          }
        }

        const record = label as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          description: typeof record.description === "string" ? record.description : null,
          color: typeof record.color === "string" ? record.color : null,
          isDefault: typeof record.isDefault === "boolean" ? record.isDefault : null,
        }
      }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "repo.labels.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "repo.labels.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "repo.labels.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleRepoIssueTypesList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for repo.issue_types.list")
    }

    const after = params.after
    if (!(after === undefined || after === null || typeof after === "string")) {
      throw new Error("Invalid after cursor for repo.issue_types.list")
    }

    if (!owner || !name) {
      throw new Error("Missing owner/name for repo.issue_types.list")
    }

    const args = [
      ...commandTokens(card, "api graphql"),
      "-f",
      `query=${REPO_ISSUE_TYPES_GRAPHQL_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `first=${first}`,
    ]

    if (typeof after === "string" && after.length > 0) {
      args.push("-f", `after=${after}`)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "repo.issue_types.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "repo.issue_types.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const payload =
      typeof root.data === "object" && root.data !== null && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : {}
    const repository =
      typeof payload.repository === "object" &&
      payload.repository !== null &&
      !Array.isArray(payload.repository)
        ? (payload.repository as Record<string, unknown>)
        : {}
    const connection =
      typeof repository.issueTypes === "object" &&
      repository.issueTypes !== null &&
      !Array.isArray(repository.issueTypes)
        ? (repository.issueTypes as Record<string, unknown>)
        : {}
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : []
    const pageInfo =
      typeof connection.pageInfo === "object" &&
      connection.pageInfo !== null &&
      !Array.isArray(connection.pageInfo)
        ? (connection.pageInfo as Record<string, unknown>)
        : {}

    const normalized = {
      items: nodes.map((node) => {
        if (typeof node !== "object" || node === null || Array.isArray(node)) {
          return {
            id: null,
            name: null,
            color: null,
            isEnabled: null,
          }
        }

        const record = node as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          color: typeof record.color === "string" ? record.color : null,
          isEnabled: typeof record.isEnabled === "boolean" ? record.isEnabled : null,
        }
      }),
      pageInfo: {
        hasNextPage: typeof pageInfo.hasNextPage === "boolean" ? pageInfo.hasNextPage : false,
        endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
      },
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "repo.issue_types.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "repo.issue_types.list", reason: "CARD_FALLBACK" },
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid after cursor")) {
      return normalizeError(
        {
          code: errorCodes.Validation,
          message: error.message,
          retryable: false,
        },
        "cli",
        { capabilityId: "repo.issue_types.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "repo.issue_types.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "repo.view": handleRepoView,
  "repo.labels.list": handleRepoLabelsList,
  "repo.issue_types.list": handleRepoIssueTypesList,
}
