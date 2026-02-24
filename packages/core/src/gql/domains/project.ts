import { assertProjectInput, assertProjectOrgInput, assertProjectUserInput } from "../assertions.js"
import type { ProjectV2FieldsListQuery } from "../operations/project-v2-fields-list.generated.js"
import { getSdk as getProjectV2FieldsListSdk } from "../operations/project-v2-fields-list.generated.js"
import type { ProjectV2ItemsListQuery } from "../operations/project-v2-items-list.generated.js"
import { getSdk as getProjectV2ItemsListSdk } from "../operations/project-v2-items-list.generated.js"
import type { ProjectV2OrgViewQuery } from "../operations/project-v2-org-view.generated.js"
import { getSdk as getProjectV2OrgViewSdk } from "../operations/project-v2-org-view.generated.js"
import type { ProjectV2UserViewQuery } from "../operations/project-v2-user-view.generated.js"
import { getSdk as getProjectV2UserViewSdk } from "../operations/project-v2-user-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  ProjectV2FieldItemData,
  ProjectV2FieldsListData,
  ProjectV2FieldsListInput,
  ProjectV2ItemData,
  ProjectV2ItemsListData,
  ProjectV2ItemsListInput,
  ProjectV2OrgViewData,
  ProjectV2OrgViewInput,
  ProjectV2UserViewData,
  ProjectV2UserViewInput,
} from "../types.js"

export async function runProjectV2OrgView(
  transport: GraphqlTransport,
  input: ProjectV2OrgViewInput,
): Promise<ProjectV2OrgViewData> {
  assertProjectOrgInput(input)
  const sdk = getProjectV2OrgViewSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2OrgViewQuery = await sdk.ProjectV2OrgView(input)
  const project = result.organization?.projectV2
  return {
    id: project?.id ?? null,
    title: project?.title ?? null,
    shortDescription: project?.shortDescription ?? null,
    public: project?.public ?? null,
    closed: project?.closed ?? null,
    url: project != null ? String(project.url) : null,
  }
}

export async function runProjectV2UserView(
  transport: GraphqlTransport,
  input: ProjectV2UserViewInput,
): Promise<ProjectV2UserViewData> {
  assertProjectUserInput(input)
  const sdk = getProjectV2UserViewSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2UserViewQuery = await sdk.ProjectV2UserView(input)
  const project = result.user?.projectV2
  return {
    id: project?.id ?? null,
    title: project?.title ?? null,
    shortDescription: project?.shortDescription ?? null,
    public: project?.public ?? null,
    closed: project?.closed ?? null,
    url: project != null ? String(project.url) : null,
  }
}

export async function runProjectV2FieldsList(
  transport: GraphqlTransport,
  input: ProjectV2FieldsListInput,
): Promise<ProjectV2FieldsListData> {
  assertProjectInput(input)
  const sdk = getProjectV2FieldsListSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2FieldsListQuery = await sdk.ProjectV2FieldsList(input)
  const conn = result.organization?.projectV2?.fields ?? result.user?.projectV2?.fields
  return {
    items: (conn?.nodes ?? []).map(
      (n): ProjectV2FieldItemData => ({
        id: n?.id ?? null,
        name: n?.name ?? null,
        dataType: n != null ? String(n.dataType) : null,
      }),
    ),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}

export async function runProjectV2ItemsList(
  transport: GraphqlTransport,
  input: ProjectV2ItemsListInput,
): Promise<ProjectV2ItemsListData> {
  assertProjectInput(input)
  const sdk = getProjectV2ItemsListSdk(createGraphqlRequestClient(transport))
  const result: ProjectV2ItemsListQuery = await sdk.ProjectV2ItemsList(input)
  const conn = result.organization?.projectV2?.items ?? result.user?.projectV2?.items
  return {
    items: (conn?.nodes ?? []).map((n): ProjectV2ItemData => {
      const content = n?.content ?? null
      return {
        id: n?.id ?? null,
        contentType: n != null ? String(n.type) : null,
        contentNumber: content != null && "number" in content ? content.number : null,
        contentTitle: content?.title ?? null,
      }
    }),
    pageInfo: {
      hasNextPage: conn?.pageInfo.hasNextPage ?? false,
      endCursor: conn?.pageInfo.endCursor ?? null,
    },
  }
}
