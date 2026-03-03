import type { ResultEnvelope } from "../contracts/envelope.js"

type ExecuteTaskFn = (request: {
  task: string
  input: Record<string, unknown>
  options?: Record<string, unknown>
}) => Promise<ResultEnvelope>

/**
 * Creates an execute tool suitable for wiring into an AI agent's tool loop.
 *
 * Wraps the execution engine into a simple `{ execute(capabilityId, params) }` shape.
 *
 * @example
 * ```ts
 * const tool = createExecuteTool({
 *   executeTask: (req) => executeTask(req, deps),
 * })
 * const result = await tool.execute("repo.view", { owner: "aryeko", name: "ghx" })
 * ```
 */
export function createExecuteTool(deps: { executeTask: ExecuteTaskFn }) {
  return {
    execute(
      capabilityId: string,
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<ResultEnvelope> {
      const request = {
        task: capabilityId,
        input: params,
        ...(options ? { options } : {}),
      }

      return deps.executeTask(request)
    },
  }
}
