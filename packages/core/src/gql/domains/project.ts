import {
  assertNonEmptyString,
  assertProjectInput,
  assertProjectOrgInput,
  assertProjectUserInput,
} from "../assertions.js"
import type * as Types from "../operations/base-types.js"
import { ProjectV2FieldsListDocument } from "../operations/project-v2-fields-list.generated.js"
import { ProjectV2IssueNodeIdDocument } from "../operations/project-v2-issue-node-id.generated.js"
import { AddProjectV2ItemDocument } from "../operations/project-v2-item-add.generated.js"
import { UpdateProjectV2ItemFieldDocument } from "../operations/project-v2-item-field-update.generated.js"
import { RemoveProjectV2ItemDocument } from "../operations/project-v2-item-remove.generated.js"
import { ProjectV2ItemsListDocument } from "../operations/project-v2-items-list.generated.js"
import type { ProjectV2OrgViewQuery } from "../operations/project-v2-org-view.generated.js"
import { ProjectV2OrgViewDocument } from "../operations/project-v2-org-view.generated.js"
import { ProjectV2OwnerIdDocument } from "../operations/project-v2-owner-id.generated.js"
import type { ProjectV2UserViewQuery } from "../operations/project-v2-user-view.generated.js"
import { ProjectV2UserViewDocument } from "../operations/project-v2-user-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { executeTypedDocument } from "../transport.js"
import type {
  ProjectV2FieldItemData,
  ProjectV2FieldsListData,
  ProjectV2FieldsListInput,
  ProjectV2ItemAddData,
  ProjectV2ItemAddInput,
  ProjectV2ItemData,
  ProjectV2ItemFieldUpdateData,
  ProjectV2ItemFieldUpdateInput,
  ProjectV2ItemRemoveData,
  ProjectV2ItemRemoveInput,
  ProjectV2ItemsListData,
  ProjectV2ItemsListInput,
  ProjectV2OrgViewData,
  ProjectV2OrgViewInput,
  ProjectV2UserViewData,
  ProjectV2UserViewInput,
} from "../types.js"

async function resolveProjectId(
  transport: GraphqlTransport,
  owner: string,
  projectNumber: number,
): Promise<string> {
  const result = await executeTypedDocument(transport, ProjectV2OwnerIdDocument, {
    owner,
    projectNumber,
  })
  if (result.repositoryOwner?.projectV2?.id) {
    return result.repositoryOwner.projectV2.id
  }

  throw new Error(`Project #${projectNumber} not found for owner "${owner}"`)
}

async function resolveIssueNodeId(transport: GraphqlTransport, issueUrl: string): Promise<string> {
  const result = await executeTypedDocument(transport, ProjectV2IssueNodeIdDocument, {
    url: issueUrl as Types.Scalars["URI"]["input"],
  })
  const resource = result.resource
  if (resource && "__typename" in resource && resource.__typename === "Issue" && "id" in resource) {
    return resource.id
  }
  throw new Error(`Issue not found at URL "${issueUrl}"`)
}

export function buildFieldValue(input: ProjectV2ItemFieldUpdateInput): Types.ProjectV2FieldValue {
  if (
    input.clear === true &&
    (input.valueText !== undefined ||
      input.valueNumber !== undefined ||
      input.valueDate !== undefined ||
      input.valueSingleSelectOptionId !== undefined ||
      input.valueIterationId !== undefined)
  ) {
    throw new Error("Cannot set clear and a value field simultaneously")
  }
  if (input.clear) return {}
  if (input.valueText !== undefined) return { text: input.valueText }
  if (input.valueNumber !== undefined) return { number: input.valueNumber }
  if (input.valueDate !== undefined) return { date: input.valueDate }
  if (input.valueSingleSelectOptionId !== undefined) {
    return { singleSelectOptionId: input.valueSingleSelectOptionId }
  }
  if (input.valueIterationId !== undefined) return { iterationId: input.valueIterationId }
  throw new Error("At least one value field must be provided")
}

export function normalizeProjectV2OrgViewResult(
  result: unknown,
  input: ProjectV2OrgViewInput,
): ProjectV2OrgViewData {
  const project = (result as ProjectV2OrgViewQuery).organization?.projectV2
  if (!project) {
    throw new Error(`Project ${input.projectNumber} not found for org ${input.org}`)
  }
  return {
    id: project.id ?? null,
    title: project.title ?? null,
    shortDescription: project.shortDescription ?? null,
    public: project.public ?? null,
    closed: project.closed ?? null,
    url: project.url != null ? String(project.url) : null,
  }
}

export function normalizeProjectV2UserViewResult(
  result: unknown,
  input: ProjectV2UserViewInput,
): ProjectV2UserViewData {
  const project = (result as ProjectV2UserViewQuery).user?.projectV2
  if (!project) {
    throw new Error(`Project ${input.projectNumber} not found for user ${input.user}`)
  }
  return {
    id: project.id ?? null,
    title: project.title ?? null,
    shortDescription: project.shortDescription ?? null,
    public: project.public ?? null,
    closed: project.closed ?? null,
    url: project.url != null ? String(project.url) : null,
  }
}

export async function runProjectV2OrgView(
  transport: GraphqlTransport,
  input: ProjectV2OrgViewInput,
): Promise<ProjectV2OrgViewData> {
  assertProjectOrgInput(input)
  const result = await executeTypedDocument(transport, ProjectV2OrgViewDocument, input)
  return normalizeProjectV2OrgViewResult(result, input)
}

export async function runProjectV2UserView(
  transport: GraphqlTransport,
  input: ProjectV2UserViewInput,
): Promise<ProjectV2UserViewData> {
  assertProjectUserInput(input)
  const result = await executeTypedDocument(transport, ProjectV2UserViewDocument, input)
  return normalizeProjectV2UserViewResult(result, input)
}

export async function runProjectV2FieldsList(
  transport: GraphqlTransport,
  input: ProjectV2FieldsListInput,
): Promise<ProjectV2FieldsListData> {
  assertProjectInput(input)
  const first = input.first ?? 30

  const result = await executeTypedDocument(transport, ProjectV2FieldsListDocument, {
    owner: input.owner,
    projectNumber: input.projectNumber,
    first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  const conn = result.repositoryOwner?.projectV2?.fields

  if (!conn) {
    throw new Error(`Project #${input.projectNumber} not found for owner "${input.owner}"`)
  }

  return {
    items: (conn.nodes ?? []).map(
      (n): ProjectV2FieldItemData => ({
        id: n?.id ?? null,
        name: n?.name ?? null,
        dataType: n != null ? String(n.dataType) : null,
        options:
          n != null && "__typename" in n && n.__typename === "ProjectV2SingleSelectField"
            ? n.options.map((option) => ({ id: option.id, name: option.name }))
            : null,
      }),
    ),
    pageInfo: {
      hasNextPage: conn.pageInfo.hasNextPage ?? false,
      endCursor: conn.pageInfo.endCursor ?? null,
    },
  }
}

export async function runProjectV2ItemsList(
  transport: GraphqlTransport,
  input: ProjectV2ItemsListInput,
): Promise<ProjectV2ItemsListData> {
  assertProjectInput(input)
  const first = input.first ?? 30

  const result = await executeTypedDocument(transport, ProjectV2ItemsListDocument, {
    owner: input.owner,
    projectNumber: input.projectNumber,
    first,
    ...(input.after !== undefined ? { after: input.after } : {}),
  })

  const conn = result.repositoryOwner?.projectV2?.items

  if (!conn) {
    throw new Error(`Project #${input.projectNumber} not found for owner "${input.owner}"`)
  }

  return {
    items: (conn.nodes ?? []).map((n): ProjectV2ItemData => {
      const content = n?.content ?? null
      return {
        id: n?.id ?? null,
        contentType: n != null ? String(n.type) : null,
        contentNumber: content != null && "number" in content ? content.number : null,
        contentTitle: content?.title ?? null,
      }
    }),
    pageInfo: {
      hasNextPage: conn.pageInfo.hasNextPage ?? false,
      endCursor: conn.pageInfo.endCursor ?? null,
    },
  }
}

export async function runProjectV2ItemAdd(
  transport: GraphqlTransport,
  input: ProjectV2ItemAddInput,
): Promise<ProjectV2ItemAddData> {
  assertProjectInput(input)
  if (!input.issueUrl || input.issueUrl.trim().length === 0) {
    throw new Error("issueUrl is required")
  }

  const projectId = await resolveProjectId(transport, input.owner, input.projectNumber)
  const contentId = await resolveIssueNodeId(transport, input.issueUrl)

  const result = await executeTypedDocument(transport, AddProjectV2ItemDocument, {
    projectId,
    contentId,
  })

  const item = result.addProjectV2ItemById?.item
  if (!item) {
    throw new Error("Failed to add item to project")
  }

  return {
    itemId: item.id,
    itemType: item.type != null ? String(item.type) : null,
  }
}

export async function runProjectV2ItemRemove(
  transport: GraphqlTransport,
  input: ProjectV2ItemRemoveInput,
): Promise<ProjectV2ItemRemoveData> {
  assertProjectInput(input)
  if (!input.itemId || input.itemId.trim().length === 0) {
    throw new Error("itemId is required")
  }

  const projectId = await resolveProjectId(transport, input.owner, input.projectNumber)

  const result = await executeTypedDocument(transport, RemoveProjectV2ItemDocument, {
    projectId,
    itemId: input.itemId,
  })

  const deletedItemId = result.deleteProjectV2Item?.deletedItemId
  if (!deletedItemId) {
    throw new Error("Failed to remove item from project")
  }

  return {
    deletedItemId,
  }
}

export async function runProjectV2ItemFieldUpdate(
  transport: GraphqlTransport,
  input: ProjectV2ItemFieldUpdateInput,
): Promise<ProjectV2ItemFieldUpdateData> {
  assertNonEmptyString(input.projectId, "projectId")
  assertNonEmptyString(input.itemId, "itemId")
  assertNonEmptyString(input.fieldId, "fieldId")

  const value = buildFieldValue(input)

  const result = await executeTypedDocument(transport, UpdateProjectV2ItemFieldDocument, {
    projectId: input.projectId,
    itemId: input.itemId,
    fieldId: input.fieldId,
    value,
  })

  const projectV2Item = result.updateProjectV2ItemFieldValue?.projectV2Item
  if (!projectV2Item) {
    throw new Error("Failed to update project item field")
  }

  return {
    itemId: projectV2Item.id,
  }
}
