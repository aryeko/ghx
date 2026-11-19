import type { RestReader } from "../rest-adapter.js"
import { nextStackPage } from "./stack-pagination.js"
import { invalidStackResponse, parseStackSnapshot } from "./stack-snapshot.js"

export async function readStack(read: RestReader, repoPath: string, stackNumber: number) {
  const { data, headers } = await read(`${repoPath}/stacks/${stackNumber}`)
  if (nextStackPage(headers.get("link"), 1) !== null) return invalidStackResponse()
  return parseStackSnapshot(data, stackNumber)
}
