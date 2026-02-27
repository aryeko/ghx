/**
 * Cache for Phase 1 resolution lookups in batch execution.
 *
 * Avoids redundant GraphQL lookups when the same entity is referenced
 * by multiple steps in a chain.
 */
export interface ResolutionCache {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
  clear(): void
  /** Current store size; may include expired entries due to lazy eviction. */
  readonly size: number
}

export interface ResolutionCacheOptions {
  /** Time-to-live in milliseconds. Default: 60 000 (1 min). */
  ttlMs?: number
  /** Maximum number of cached entries. Default: 200. */
  maxEntries?: number
}

const DEFAULT_TTL_MS = 60_000
const DEFAULT_MAX_ENTRIES = 200

/**
 * Create an in-memory resolution cache with TTL and FIFO eviction.
 *
 * Pass to `ExecutionDeps.resolutionCache` for batch operations.
 */
export function createResolutionCache(opts?: ResolutionCacheOptions): ResolutionCache {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES
  const store = new Map<string, { value: unknown; expiresAt: number }>()

  return {
    get(key: string): unknown | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },

    set(key: string, value: unknown): void {
      if (!store.has(key) && store.size >= maxEntries) {
        // Sweep expired entries before falling back to FIFO eviction
        const now = Date.now()
        const expired: string[] = []
        for (const [k, entry] of store) {
          if (now > entry.expiresAt) expired.push(k)
        }
        for (const k of expired) store.delete(k)
        // FIFO eviction if still at capacity after sweep
        if (store.size >= maxEntries) {
          const oldest = store.keys().next()
          if (!oldest.done) {
            store.delete(oldest.value)
          }
        }
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },

    clear(): void {
      store.clear()
    },

    get size(): number {
      return store.size
    },
  }
}

/** Build a deterministic cache key from an operation name and variables. */
export function buildCacheKey(operationName: string, variables: Record<string, unknown>): string {
  const sortedKeys = Object.keys(variables).sort()
  const sorted: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    sorted[k] = variables[k]
  }
  return `${operationName}:${JSON.stringify(sorted)}`
}
