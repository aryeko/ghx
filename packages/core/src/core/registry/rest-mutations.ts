const restMutations = new Set([
  "pr.stack.create",
  "pr.stack.add",
  "pr.stack.unstack",
  "pr.stack.merge",
])

/** These capabilities are dispatched once through the single-task execution path. */
export function isRestMutation(task: string): boolean {
  return restMutations.has(task)
}
