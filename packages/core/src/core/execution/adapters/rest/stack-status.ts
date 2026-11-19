import { isDeepStrictEqual } from "node:util"
import { errorCodes } from "@core/core/errors/codes.js"
import type { GithubClient } from "@core/gql/github-client.js"
import {
  PrStackSignalsDocument,
  type PrStackSignalsQuery,
  type PrStackSignalsQueryVariables,
} from "@core/gql/operations/pr-stack-signals.generated.js"
import { RestError } from "../rest-adapter.js"
import { publicStackSnapshot, type StackSnapshot } from "./stack-snapshot.js"

const SIGNAL_BATCH_SIZE = 20

type Signal = Extract<
  NonNullable<PrStackSignalsQuery["nodes"][number]>,
  {
    __typename: "PullRequest"
  }
>

async function readSignals(github: GithubClient, ids: string[]): Promise<Signal[]> {
  try {
    const { data } = await github.queryRaw<PrStackSignalsQuery, PrStackSignalsQueryVariables>(
      PrStackSignalsDocument,
      { ids },
    )
    return (data?.nodes ?? []).filter((node): node is Signal => node?.__typename === "PullRequest")
  } catch {
    // The topology is still useful when GitHub cannot provide review or CI signals.
    return []
  }
}

export async function readStackStatus(
  getStack: () => Promise<StackSnapshot>,
  github: GithubClient,
  throughPrNumber: number | undefined,
) {
  const stack = await getStack()
  const snapshot = publicStackSnapshot(stack)
  const target = stack.members.find((member) => member.prNumber === throughPrNumber)
  if (throughPrNumber !== undefined && (target === undefined || target.state !== "OPEN")) {
    throw new RestError({
      code: errorCodes.Validation,
      message: "throughPrNumber must select an open PR in this stack",
      retryable: false,
    })
  }

  const openMembers = stack.members.filter((member) => member.state === "OPEN")
  const signals = new Map<string, Signal>()
  for (let i = 0; i < openMembers.length; i += SIGNAL_BATCH_SIZE) {
    const ids = openMembers.slice(i, i + SIGNAL_BATCH_SIZE).map((member) => member.nodeId)
    for (const signal of await readSignals(github, ids)) signals.set(signal.id, signal)
  }

  const changedHead = openMembers.some((member) => {
    const signal = signals.get(member.nodeId)
    return signal !== undefined && signal.headRefOid !== member.headSha
  })
  const latest = await getStack()
  const stale = changedHead || !isDeepStrictEqual(stack, latest)
  const prefix = target === undefined ? [] : snapshot.members.slice(0, target.position)
  const mergePreview =
    !stale && target !== undefined && prefix.every((member) => member.state !== "CLOSED")
      ? {
          stackNumber: stack.stackNumber,
          throughPrNumber: target.prNumber,
          expectedBaseRefName: stack.baseRefName,
          expectedMembers: prefix
            .filter((member) => member.state === "OPEN")
            .map(({ prNumber, headSha }) => ({ prNumber, headSha })),
        }
      : null

  return {
    ...snapshot,
    snapshotStatus: stale ? "stale" : "current",
    members: snapshot.members.map((member, position) => {
      const corresponding = stack.members[position]
      const signal = corresponding === undefined ? undefined : signals.get(corresponding.nodeId)
      const current = signal?.headRefOid === member.headSha ? signal : undefined
      return {
        ...member,
        reviewDecision: current?.reviewDecision ?? null,
        mergeStateStatus: current?.mergeStateStatus ?? null,
        checksState: current?.statusCheckRollup?.state ?? null,
        signalsAvailable: current !== undefined,
      }
    }),
    mergePreview,
  }
}
