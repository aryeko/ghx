import { assertRepoAndPaginationInput, assertRepoInput } from "../assertions.js"
import type { RepoIssueTypesListQuery } from "../operations/repo-issue-types-list.generated.js"
import { RepoIssueTypesListDocument } from "../operations/repo-issue-types-list.generated.js"
import type { RepoLabelsListQuery } from "../operations/repo-labels-list.generated.js"
import { RepoLabelsListDocument } from "../operations/repo-labels-list.generated.js"
import type { RepoViewQuery } from "../operations/repo-view.generated.js"
import { RepoViewDocument } from "../operations/repo-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { executeTypedDocument } from "../transport.js"
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
  const result = await executeTypedDocument(transport, RepoViewDocument, input)
  return normalizeRepoViewResult(result, input)
}

export async function runRepoLabelsList(
  transport: GraphqlTransport,
  input: RepoLabelsListInput,
): Promise<RepoLabelsListData> {
  assertRepoAndPaginationInput(input)
  const result = await executeTypedDocument(transport, RepoLabelsListDocument, input)
  return normalizeRepoLabelsListResult(result, input)
}

export async function runRepoIssueTypesList(
  transport: GraphqlTransport,
  input: RepoIssueTypesListInput,
): Promise<RepoIssueTypesListData> {
  assertRepoAndPaginationInput(input)
  const result = await executeTypedDocument(transport, RepoIssueTypesListDocument, input)
  return normalizeRepoIssueTypesListResult(result, input)
}
