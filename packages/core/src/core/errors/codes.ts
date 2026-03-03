/**
 * All possible error codes returned in {@link ResultError.code}.
 *
 * Retryable codes: `RATE_LIMIT`, `NETWORK`, `SERVER`.
 */
export const errorCodes = {
  Auth: "AUTH",
  NotFound: "NOT_FOUND",
  Validation: "VALIDATION",
  RateLimit: "RATE_LIMIT",
  Network: "NETWORK",
  Server: "SERVER",
  AdapterUnsupported: "ADAPTER_UNSUPPORTED",
  Unknown: "UNKNOWN",
} as const

/** Union of all error code string literals. */
export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes]
