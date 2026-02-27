/** A dotted capability identifier (e.g. `"pr.view"`, `"issue.labels.add"`). */
export type TaskId = string

/**
 * A request to execute a single ghx capability.
 *
 * @typeParam TInput - The shape of the input payload, varies per capability.
 */
export interface TaskRequest<TInput = Record<string, unknown>> {
  task: TaskId
  input: TInput
}
