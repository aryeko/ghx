import { routePreferenceOrder } from "./policy.js"
import { capabilityRegistry } from "./capability-registry.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { TaskRequest } from "../contracts/task.js"
import { issueListTask } from "../contracts/tasks/issue.list.js"
import { issueViewTask } from "../contracts/tasks/issue.view.js"
import { prListTask } from "../contracts/tasks/pr.list.js"
import { prViewTask } from "../contracts/tasks/pr.view.js"
import { repoViewTask } from "../contracts/tasks/repo.view.js"
import { mapErrorToCode } from "../errors/map-error.js"
import { errorCodes } from "../errors/codes.js"
import { isRetryableErrorCode } from "../errors/retryability.js"
import type {
  GithubClient,
  IssueListInput,
  IssueViewInput,
  PrListInput,
  PrViewInput,
  RepoViewInput
} from "../../gql/client.js"
import type { RouteReasonCode } from "./reason-codes.js"
import { preflightCheck } from "../execution/preflight.js"
import { normalizeError, normalizeResult } from "../execution/normalizer.js"
import { execute } from "../execute/execute.js"
import { getOperationCard } from "../registry/index.js"

export function chooseRoute(): (typeof routePreferenceOrder)[number] {
  return routePreferenceOrder[0]
}

function resolveRoutesForTask(task: string): RouteSource[] {
  const capability = capabilityRegistry.find((entry) => entry.task === task)
  const ordered = new Set<RouteSource>()

  if (capability) {
    ordered.add(capability.defaultRoute)
    for (const fallbackRoute of capability.fallbackRoutes) {
      ordered.add(fallbackRoute)
    }
  }

  for (const route of routePreferenceOrder) {
    ordered.add(route)
  }

  return [...ordered]
}

type ExecutionDeps = {
  githubClient: Pick<
    GithubClient,
    "fetchRepoView" | "fetchIssueList" | "fetchIssueView" | "fetchPrList" | "fetchPrView"
  >
  githubToken?: string | null
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "DEFAULT_POLICY"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const card = getOperationCard(request.task)
  if (!card) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported task: ${request.task}`,
        retryable: false
      },
      chooseRoute(),
      { capabilityId: request.task, reason }
    )
  }

  return execute({
    card,
    params: request.input as Record<string, unknown>,
    retry: {
      maxAttemptsPerRoute: 2
    },
    preflight: async (route: RouteSource) => {
      const preflightInput: Parameters<typeof preflightCheck>[0] = { route }
      if (deps.githubToken !== undefined) {
        preflightInput.githubToken = deps.githubToken
      }
      if (deps.ghCliAvailable !== undefined) {
        preflightInput.ghCliAvailable = deps.ghCliAvailable
      }
      if (deps.ghAuthenticated !== undefined) {
        preflightInput.ghAuthenticated = deps.ghAuthenticated
      }

      return preflightCheck(preflightInput)
    },
    routes: {
      graphql: async () => {
        try {
          if (request.task === repoViewTask.id) {
            const data = await deps.githubClient.fetchRepoView(request.input as RepoViewInput)
            return normalizeResult(data, "graphql", { capabilityId: request.task, reason })
          }

          if (request.task === issueViewTask.id) {
            const data = await deps.githubClient.fetchIssueView(request.input as IssueViewInput)
            return normalizeResult(data, "graphql", { capabilityId: request.task, reason })
          }

          if (request.task === issueListTask.id) {
            const data = await deps.githubClient.fetchIssueList(request.input as IssueListInput)
            return normalizeResult(data, "graphql", { capabilityId: request.task, reason })
          }

          if (request.task === prViewTask.id) {
            const data = await deps.githubClient.fetchPrView(request.input as PrViewInput)
            return normalizeResult(data, "graphql", { capabilityId: request.task, reason })
          }

          if (request.task === prListTask.id) {
            const data = await deps.githubClient.fetchPrList(request.input as PrListInput)
            return normalizeResult(data, "graphql", { capabilityId: request.task, reason })
          }

          return normalizeError(
            {
              code: errorCodes.Validation,
              message: `Unsupported task: ${request.task}`,
              retryable: false
            },
            "graphql",
            { capabilityId: request.task, reason }
          )
        } catch (error: unknown) {
          const code = mapErrorToCode(error)
          return normalizeError(
            {
              code,
              message: error instanceof Error ? error.message : String(error),
              retryable: isRetryableErrorCode(code)
            },
            "graphql",
            { capabilityId: request.task, reason }
          )
        }
      },
      cli: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'cli' is not implemented for task '${request.task}'`,
            retryable: false,
            details: { route: "cli", task: request.task }
          },
          "cli",
          { capabilityId: request.task, reason }
        ),
      rest: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'rest' is not implemented for task '${request.task}'`,
            retryable: false,
            details: { route: "rest", task: request.task }
          },
          "rest",
          { capabilityId: request.task, reason }
        )
    }
  })
}
