import type { ErrorCode } from "../errors/codes.js"
import type { RouteReasonCode } from "../routing/reason-codes.js"

/** The transport route used to execute a capability. */
export type RouteSource = "cli" | "rest" | "graphql"

/**
 * Structured error returned inside a {@link ResultEnvelope} when `ok` is `false`.
 *
 * @see {@link ErrorCode} for the full list of error codes.
 */
export interface ResultError {
  code: ErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

/**
 * Records a single route attempt during execution.
 *
 * The routing engine may try multiple routes (preferred → fallback).
 * Each attempt is logged here regardless of outcome.
 */
export interface AttemptMeta {
  route: RouteSource
  status: "success" | "error" | "skipped"
  error_code?: ErrorCode
  duration_ms?: number
}

/**
 * Metadata attached to every {@link ResultEnvelope}.
 *
 * Provides observability into which route was used, why, how long it took,
 * and the full list of route attempts.
 */
export interface ResultMeta {
  capability_id: string
  route_used?: RouteSource
  reason?: RouteReasonCode
  attempts?: AttemptMeta[]
  pagination?: {
    has_next_page?: boolean
    end_cursor?: string
    next?: unknown
  }
  timings?: {
    total_ms?: number
    adapter_ms?: number
  }
  cost?: {
    tokens_in?: number
    tokens_out?: number
  }
}

/**
 * The universal response contract for all ghx operations.
 *
 * Every call to {@link executeTask} returns a `ResultEnvelope` — it never throws.
 * Check `ok` to distinguish success from failure; `data` and `error` are exclusive.
 *
 * @typeParam TData - The shape of the success payload, varies per capability.
 */
export interface ResultEnvelope<TData = unknown> {
  ok: boolean
  data?: TData
  error?: ResultError
  meta: ResultMeta
}

/** Aggregate outcome of a batch execution via {@link executeTasks}. */
export type ChainStatus = "success" | "partial" | "failed"

/** Result of a single step within a chain execution. */
export interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}

/**
 * Response envelope for batch operations via {@link executeTasks}.
 *
 * Contains per-step results and aggregate metadata
 * (total, succeeded, failed counts).
 */
export interface ChainResultEnvelope {
  status: ChainStatus
  results: ChainStepResult[]
  meta: {
    route_used: RouteSource
    total: number
    succeeded: number
    failed: number
  }
}
