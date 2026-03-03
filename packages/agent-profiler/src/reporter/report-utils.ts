/** Values treated as "zero" when filtering non-differentiating rows across modes. */
export const ZERO_VALUES: ReadonlySet<string> = new Set(["0", "0%", "0.0%", "0 tok", "-", ""])

/**
 * Returns true when the formatted metric values differ meaningfully across modes.
 * Filters out rows where all modes have the same value or all are zero/empty.
 */
export function isDifferentiating(
  values: ReadonlyMap<string, string>,
  modes: readonly string[],
): boolean {
  const vals = modes.map((m) => values.get(m) ?? "-")
  const allSame = vals.every((v) => v === vals[0])
  const allZero = vals.every((v) => ZERO_VALUES.has(v))
  return !allSame && !allZero
}
