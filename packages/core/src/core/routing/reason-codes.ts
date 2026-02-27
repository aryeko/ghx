/**
 * All possible reason codes explaining why a particular route was selected.
 *
 * Included in {@link ResultMeta.reason}.
 */
export const routeReasonCodes = [
  "INPUT_VALIDATION",
  "OUTPUT_VALIDATION",
  "CARD_PREFERRED",
  "CARD_FALLBACK",
  "PREFLIGHT_FAILED",
  "ENV_CONSTRAINT",
  "CAPABILITY_LIMIT",
  "DEFAULT_POLICY",
] as const

/** Reason code explaining why a particular route was selected. */
export type RouteReasonCode = (typeof routeReasonCodes)[number]
