import { assertRepoAndPaginationInput, assertRepoInput } from "../assertions.js"
import type { RepoIssueTypesListQuery } from "../operations/repo-issue-types-list.generated.js"
import { getSdk as getRepoIssueTypesListSdk } from "../operations/repo-issue-types-list.generated.js"
import type { RepoLabelsListQuery } from "../operations/repo-labels-list.generated.js"
import { getSdk as getRepoLabelsListSdk } from "../operations/repo-labels-list.generated.js"
import type { RepoViewQuery } from "../operations/repo-view.generated.js"
import { getSdk } from "../operations/repo-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  RepoIssueTypesListData,
  RepoIssueTypesListInput,
  RepoLabelsListData,
  RepoLabelsListInput,
  RepoViewData,
  RepoViewInput,
} from "../types.js"

export function normalizeRepoViewResult(result: unknown, _input: RepoViewInput): RepoViewData {
  const repo = (result as RepoViewQuery).repository
  if (!repo) {
    throw new Error("Repository not found")
  }
  return {
    id: repo.id,
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    isPrivate: repo.isPrivate,
    stargazerCount: repo.stargazerCount,
    forkCount: repo.forkCount,
    url: repo.url,
    defaultBranch: repo.defaultBranchRef?.name ?? null,
  }
}

export function normalizeRepoLabelsListResult(
  result: unknown,
  input: RepoLabelsListInput,
): RepoLabelsListData {
  const repo = (result as RepoLabelsListQuery).repository
  if (!repo) {
    throw new Error(`Repository ${input.owner}/${input.name} not found`)
  }
  const conn = repo.labels
  return {
    items: (conn?.nodes ?? []).map((n) => ({
      id: n?.id ?? null,
      name: n?.name ?? null,
      description: n?.description ?? null,
      color: n?.color ?? null,
      isDefault: n?.isDefault ?? null,
    })),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}

export function normalizeRepoIssueTypesListResult(
  result: unknown,
  input: RepoIssueTypesListInput,
): RepoIssueTypesListData {
  const repo = (result as RepoIssueTypesListQuery).repository
  if (!repo) {
    throw new Error(`Repository ${input.owner}/${input.name} not found`)
  }
  const conn = repo.issueTypes
  return {
    items: (conn?.nodes ?? []).map((n) => ({
      id: n?.id ?? null,
      name: n?.name ?? null,
      color: n?.color != null ? String(n.color) : null,
      isEnabled: n?.isEnabled ?? null,
    })),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}

export async function runRepoView(
  transport: GraphqlTransport,
  input: RepoViewInput,
): Promise<RepoViewData> {
  assertRepoInput(input)
  const sdk = getSdk(createGraphqlRequestClient(transport))
  const result: RepoViewQuery = await sdk.RepoView(input)
  return normalizeRepoViewResult(result, input)
}

export async function runRepoLabelsList(
  transport: GraphqlTransport,
  input: RepoLabelsListInput,
): Promise<RepoLabelsListData> {
  assertRepoAndPaginationInput(input)
  const sdk = getRepoLabelsListSdk(createGraphqlRequestClient(transport))
  const result: RepoLabelsListQuery = await sdk.RepoLabelsList(input)
  return normalizeRepoLabelsListResult(result, input)
}

export async function runRepoIssueTypesList(
  transport: GraphqlTransport,
  input: RepoIssueTypesListInput,
): Promise<RepoIssueTypesListData> {
  assertRepoAndPaginationInput(input)
  const sdk = getRepoIssueTypesListSdk(createGraphqlRequestClient(transport))
  const result: RepoIssueTypesListQuery = await sdk.RepoIssueTypesList(input)
  return normalizeRepoIssueTypesListResult(result, input)
}
