import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import type { RouteReasonCode } from "@core/core/routing/reason-codes.js"
import type { GraphqlClient, GraphqlVariables } from "@core/gql/client.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export interface GraphqlAdapterRequest {
  query: string
  variables?: GraphqlVariables
  capabilityId?: string
  reason?: RouteReasonCode
}

export async function runGraphqlAdapter<TData>(
  client: GraphqlClient,
  request: GraphqlAdapterRequest,
): Promise<ResultEnvelope<TData>> {
  try {
    const data = await client.query<TData>(request.query, request.variables)

    return normalizeResult(data, "graphql", {
      capabilityId: request.capabilityId ?? "unknown",
      reason: request.reason,
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    const message = error instanceof Error ? error.message : String(error)

    return normalizeError(
      {
        code,
        message,
        details: {
          adapter: "graphql",
        },
        retryable: isRetryableErrorCode(code),
      },
      "graphql",
      {
        capabilityId: request.capabilityId ?? "unknown",
        reason: request.reason,
      },
    )
  }
}
