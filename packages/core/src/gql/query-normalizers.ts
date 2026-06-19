import {
  normalizeIssueLinkedPrsListResult,
  normalizeIssueRelationsGetResult,
} from "./domains/issue-mutations.js"
import {
  normalizeIssueCommentsListResult,
  normalizeIssueViewResult,
} from "./domains/issue-queries.js"
import {
  normalizePrDiffListFilesResult,
  normalizePrMergeStatusResult,
  normalizePrReactionsListResult,
  normalizePrReviewsListResult,
  normalizePrViewResult,
} from "./domains/pr-queries.js"
import {
  normalizeProjectV2OrgViewResult,
  normalizeProjectV2UserViewResult,
} from "./domains/project.js"
import { normalizeReleaseListResult, normalizeReleaseViewResult } from "./domains/release.js"
import {
  normalizeRepoIssueTypesListResult,
  normalizeRepoLabelsListResult,
  normalizeRepoViewResult,
} from "./domains/repo.js"
import type {
  IssueCommentsListInput,
  IssueLinkedPrsListInput,
  IssueRelationsGetInput,
  IssueViewInput,
  PrDiffListFilesInput,
  PrMergeStatusInput,
  ProjectV2OrgViewInput,
  ProjectV2UserViewInput,
  PrReactionsListInput,
  PrReviewsListInput,
  PrViewInput,
  ReleaseListInput,
  ReleaseViewInput,
  RepoIssueTypesListInput,
  RepoLabelsListInput,
  RepoViewInput,
} from "./types.js"

type NormalizerEntry = {
  rootField: string
  normalize: (result: unknown, input: Record<string, unknown>) => unknown
}

const QUERY_NORMALIZERS = new Map<string, NormalizerEntry>([
  [
    "repo.view",
    {
      rootField: "repository",
      normalize: (r, i) => normalizeRepoViewResult(r, i as unknown as RepoViewInput),
    },
  ],
  [
    "repo.labels.list",
    {
      rootField: "repository",
      normalize: (r, i) => normalizeRepoLabelsListResult(r, i as unknown as RepoLabelsListInput),
    },
  ],
  [
    "repo.issue_types.list",
    {
      rootField: "repository",
      normalize: (r, i) =>
        normalizeRepoIssueTypesListResult(r, i as unknown as RepoIssueTypesListInput),
    },
  ],
  [
    "issue.view",
    {
      rootField: "repository",
      normalize: (r, i) => normalizeIssueViewResult(r, i as unknown as IssueViewInput),
    },
  ],
  [
    "issue.comments.list",
    {
      rootField: "repository",
      normalize: (r, i) =>
        normalizeIssueCommentsListResult(r, i as unknown as IssueCommentsListInput),
    },
  ],
  [
    "issue.relations.prs.list",
    {
      rootField: "repository",
      normalize: (r, i) =>
        normalizeIssueLinkedPrsListResult(r, i as unknown as IssueLinkedPrsListInput),
    },
  ],
  [
    "issue.relations.view",
    {
      rootField: "repository",
      normalize: (r, i) =>
        normalizeIssueRelationsGetResult(r, i as unknown as IssueRelationsGetInput),
    },
  ],
  [
    "pr.view",
    {
      rootField: "repository",
      normalize: (r, i) => normalizePrViewResult(r, i as unknown as PrViewInput),
    },
  ],
  [
    "pr.reviews.list",
    {
      rootField: "repository",
      normalize: (r, i) => normalizePrReviewsListResult(r, i as unknown as PrReviewsListInput),
    },
  ],
  [
    "pr.reactions.list",
    {
      rootField: "repository",
      normalize: (r, i) => normalizePrReactionsListResult(r, i as unknown as PrReactionsListInput),
    },
  ],
  [
    "pr.diff.files",
    {
      rootField: "repository",
      normalize: (r, i) => normalizePrDiffListFilesResult(r, i as unknown as PrDiffListFilesInput),
    },
  ],
  [
    "pr.merge.status",
    {
      rootField: "repository",
      normalize: (r, i) => normalizePrMergeStatusResult(r, i as unknown as PrMergeStatusInput),
    },
  ],
  [
    "release.view",
    {
      rootField: "repository",
      normalize: (r, i) => normalizeReleaseViewResult(r, i as unknown as ReleaseViewInput),
    },
  ],
  [
    "release.list",
    {
      rootField: "repository",
      normalize: (r, i) => normalizeReleaseListResult(r, i as unknown as ReleaseListInput),
    },
  ],
  [
    "project_v2.org.view",
    {
      rootField: "organization",
      normalize: (r, i) =>
        normalizeProjectV2OrgViewResult(r, i as unknown as ProjectV2OrgViewInput),
    },
  ],
  [
    "project_v2.user.view",
    {
      rootField: "user",
      normalize: (r, i) =>
        normalizeProjectV2UserViewResult(r, i as unknown as ProjectV2UserViewInput),
    },
  ],
])

export function getQueryNormalizer(task: string): NormalizerEntry | undefined {
  return QUERY_NORMALIZERS.get(task)
}
