import type { ResultEnvelope } from "../../core/contracts/envelope.js"

type ExecuteTaskFn = (request: { task: string; input: Record<string, unknown> }) => Promise<ResultEnvelope>

export function createExecuteTool(deps: { executeTask: ExecuteTaskFn }) {
  return {
    execute(capabilityId: string, params: Record<string, unknown>): Promise<ResultEnvelope> {
      return deps.executeTask({
        task: capabilityId,
        input: params
      })
    }
  }
}
