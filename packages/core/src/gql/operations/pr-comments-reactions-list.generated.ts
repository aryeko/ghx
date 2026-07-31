/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** Emojis that can be attached to Issues, Pull Requests and Comments. */
export type ReactionContent =
  /** Represents the `:confused:` emoji. */
  | "CONFUSED"
  /** Represents the `:eyes:` emoji. */
  | "EYES"
  /** Represents the `:heart:` emoji. */
  | "HEART"
  /** Represents the `:hooray:` emoji. */
  | "HOORAY"
  /** Represents the `:laugh:` emoji. */
  | "LAUGH"
  /** Represents the `:rocket:` emoji. */
  | "ROCKET"
  /** Represents the `:-1:` emoji. */
  | "THUMBS_DOWN"
  /** Represents the `:+1:` emoji. */
  | "THUMBS_UP"

export type PrCommentsReactionsIssueCommentsPageQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null | undefined
}>

export type PrCommentsReactionsIssueCommentsPageQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      comments: {
        __typename: "IssueCommentConnection"
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
        nodes: Array<{
          __typename: "IssueComment"
          id: string
          url: any
          author:
            | { __typename: "Bot"; login: string }
            | { __typename: "EnterpriseUserAccount"; login: string }
            | { __typename: "Mannequin"; login: string }
            | { __typename: "Organization"; login: string }
            | { __typename: "User"; login: string }
            | null
          reactionGroups: Array<{
            __typename: "ReactionGroup"
            content: Types.ReactionContent
            viewerHasReacted: boolean
            reactors: {
              __typename: "ReactorConnection"
              totalCount: number
              nodes: Array<
                | { __typename: "Bot"; login: string }
                | { __typename: "Mannequin"; login: string }
                | { __typename: "Organization"; login: string }
                | { __typename: "User"; login: string }
                | null
              > | null
            }
          }> | null
        } | null> | null
      }
    } | null
  } | null
}

export type PrCommentsReactionsReviewThreadsPageQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null | undefined
}>

export type PrCommentsReactionsReviewThreadsPageQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      reviewThreads: {
        __typename: "PullRequestReviewThreadConnection"
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
        edges: Array<{
          __typename: "PullRequestReviewThreadEdge"
          cursor: string
          node: {
            __typename: "PullRequestReviewThread"
            id: string
            comments: {
              __typename: "PullRequestReviewCommentConnection"
              pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
              nodes: Array<{
                __typename: "PullRequestReviewComment"
                id: string
                url: any
                author:
                  | { __typename: "Bot"; login: string }
                  | { __typename: "EnterpriseUserAccount"; login: string }
                  | { __typename: "Mannequin"; login: string }
                  | { __typename: "Organization"; login: string }
                  | { __typename: "User"; login: string }
                  | null
                reactionGroups: Array<{
                  __typename: "ReactionGroup"
                  content: Types.ReactionContent
                  viewerHasReacted: boolean
                  reactors: {
                    __typename: "ReactorConnection"
                    totalCount: number
                    nodes: Array<
                      | { __typename: "Bot"; login: string }
                      | { __typename: "Mannequin"; login: string }
                      | { __typename: "Organization"; login: string }
                      | { __typename: "User"; login: string }
                      | null
                    > | null
                  }
                }> | null
              } | null> | null
            }
          } | null
        } | null> | null
      }
    } | null
  } | null
}

export type PrCommentsReactionsThreadCommentsPageQueryVariables = Exact<{
  threadId: string | number
  first: number
  after?: string | null | undefined
}>

export type PrCommentsReactionsThreadCommentsPageQuery = {
  __typename: "Query"
  node:
    | { __typename: "AddedToMergeQueueEvent" }
    | { __typename: "AddedToProjectEvent" }
    | { __typename: "AddedToProjectV2Event" }
    | { __typename: "App" }
    | { __typename: "AssignedEvent" }
    | { __typename: "AutoMergeDisabledEvent" }
    | { __typename: "AutoMergeEnabledEvent" }
    | { __typename: "AutoRebaseEnabledEvent" }
    | { __typename: "AutoSquashEnabledEvent" }
    | { __typename: "AutomaticBaseChangeFailedEvent" }
    | { __typename: "AutomaticBaseChangeSucceededEvent" }
    | { __typename: "BaseRefChangedEvent" }
    | { __typename: "BaseRefDeletedEvent" }
    | { __typename: "BaseRefForcePushedEvent" }
    | { __typename: "Blob" }
    | { __typename: "BlockedByAddedEvent" }
    | { __typename: "BlockedByRemovedEvent" }
    | { __typename: "BlockingAddedEvent" }
    | { __typename: "BlockingRemovedEvent" }
    | { __typename: "Bot" }
    | { __typename: "BranchProtectionRule" }
    | { __typename: "BypassForcePushAllowance" }
    | { __typename: "BypassPullRequestAllowance" }
    | { __typename: "CWE" }
    | { __typename: "CheckRun" }
    | { __typename: "CheckSuite" }
    | { __typename: "ClosedEvent" }
    | { __typename: "CodeOfConduct" }
    | { __typename: "CommentDeletedEvent" }
    | { __typename: "Commit" }
    | { __typename: "CommitComment" }
    | { __typename: "CommitCommentThread" }
    | { __typename: "Comparison" }
    | { __typename: "ConnectedEvent" }
    | { __typename: "ConvertToDraftEvent" }
    | { __typename: "ConvertedFromDraftEvent" }
    | { __typename: "ConvertedNoteToIssueEvent" }
    | { __typename: "ConvertedToDiscussionEvent" }
    | { __typename: "CrossReferencedEvent" }
    | { __typename: "DemilestonedEvent" }
    | { __typename: "DependencyGraphManifest" }
    | { __typename: "DeployKey" }
    | { __typename: "DeployedEvent" }
    | { __typename: "Deployment" }
    | { __typename: "DeploymentEnvironmentChangedEvent" }
    | { __typename: "DeploymentReview" }
    | { __typename: "DeploymentStatus" }
    | { __typename: "DisconnectedEvent" }
    | { __typename: "Discussion" }
    | { __typename: "DiscussionCategory" }
    | { __typename: "DiscussionComment" }
    | { __typename: "DiscussionPoll" }
    | { __typename: "DiscussionPollOption" }
    | { __typename: "DraftIssue" }
    | { __typename: "Enterprise" }
    | { __typename: "EnterpriseAdministratorInvitation" }
    | { __typename: "EnterpriseIdentityProvider" }
    | { __typename: "EnterpriseMemberInvitation" }
    | { __typename: "EnterpriseRepositoryInfo" }
    | { __typename: "EnterpriseServerInstallation" }
    | { __typename: "EnterpriseServerUserAccount" }
    | { __typename: "EnterpriseServerUserAccountEmail" }
    | { __typename: "EnterpriseServerUserAccountsUpload" }
    | { __typename: "EnterpriseUserAccount" }
    | { __typename: "Environment" }
    | { __typename: "ExternalIdentity" }
    | { __typename: "Gist" }
    | { __typename: "GistComment" }
    | { __typename: "HeadRefDeletedEvent" }
    | { __typename: "HeadRefForcePushedEvent" }
    | { __typename: "HeadRefRestoredEvent" }
    | { __typename: "IpAllowListEntry" }
    | { __typename: "Issue" }
    | { __typename: "IssueComment" }
    | { __typename: "IssueType" }
    | { __typename: "IssueTypeAddedEvent" }
    | { __typename: "IssueTypeChangedEvent" }
    | { __typename: "IssueTypeRemovedEvent" }
    | { __typename: "Label" }
    | { __typename: "LabeledEvent" }
    | { __typename: "Language" }
    | { __typename: "License" }
    | { __typename: "LinkedBranch" }
    | { __typename: "LockedEvent" }
    | { __typename: "Mannequin" }
    | { __typename: "MarkedAsDuplicateEvent" }
    | { __typename: "MarketplaceCategory" }
    | { __typename: "MarketplaceListing" }
    | { __typename: "MemberFeatureRequestNotification" }
    | { __typename: "MembersCanDeleteReposClearAuditEntry" }
    | { __typename: "MembersCanDeleteReposDisableAuditEntry" }
    | { __typename: "MembersCanDeleteReposEnableAuditEntry" }
    | { __typename: "MentionedEvent" }
    | { __typename: "MergeQueue" }
    | { __typename: "MergeQueueEntry" }
    | { __typename: "MergedEvent" }
    | { __typename: "MigrationSource" }
    | { __typename: "Milestone" }
    | { __typename: "MilestonedEvent" }
    | { __typename: "MovedColumnsInProjectEvent" }
    | { __typename: "NotificationThread" }
    | { __typename: "OIDCProvider" }
    | { __typename: "OauthApplicationCreateAuditEntry" }
    | { __typename: "OrgAddBillingManagerAuditEntry" }
    | { __typename: "OrgAddMemberAuditEntry" }
    | { __typename: "OrgBlockUserAuditEntry" }
    | { __typename: "OrgConfigDisableCollaboratorsOnlyAuditEntry" }
    | { __typename: "OrgConfigEnableCollaboratorsOnlyAuditEntry" }
    | { __typename: "OrgCreateAuditEntry" }
    | { __typename: "OrgDisableOauthAppRestrictionsAuditEntry" }
    | { __typename: "OrgDisableSamlAuditEntry" }
    | { __typename: "OrgDisableTwoFactorRequirementAuditEntry" }
    | { __typename: "OrgEnableOauthAppRestrictionsAuditEntry" }
    | { __typename: "OrgEnableSamlAuditEntry" }
    | { __typename: "OrgEnableTwoFactorRequirementAuditEntry" }
    | { __typename: "OrgInviteMemberAuditEntry" }
    | { __typename: "OrgInviteToBusinessAuditEntry" }
    | { __typename: "OrgOauthAppAccessApprovedAuditEntry" }
    | { __typename: "OrgOauthAppAccessBlockedAuditEntry" }
    | { __typename: "OrgOauthAppAccessDeniedAuditEntry" }
    | { __typename: "OrgOauthAppAccessRequestedAuditEntry" }
    | { __typename: "OrgOauthAppAccessUnblockedAuditEntry" }
    | { __typename: "OrgRemoveBillingManagerAuditEntry" }
    | { __typename: "OrgRemoveMemberAuditEntry" }
    | { __typename: "OrgRemoveOutsideCollaboratorAuditEntry" }
    | { __typename: "OrgRestoreMemberAuditEntry" }
    | { __typename: "OrgUnblockUserAuditEntry" }
    | { __typename: "OrgUpdateDefaultRepositoryPermissionAuditEntry" }
    | { __typename: "OrgUpdateMemberAuditEntry" }
    | { __typename: "OrgUpdateMemberRepositoryCreationPermissionAuditEntry" }
    | { __typename: "OrgUpdateMemberRepositoryInvitationPermissionAuditEntry" }
    | { __typename: "Organization" }
    | { __typename: "OrganizationIdentityProvider" }
    | { __typename: "OrganizationInvitation" }
    | { __typename: "OrganizationMigration" }
    | { __typename: "Package" }
    | { __typename: "PackageFile" }
    | { __typename: "PackageTag" }
    | { __typename: "PackageVersion" }
    | { __typename: "ParentIssueAddedEvent" }
    | { __typename: "ParentIssueRemovedEvent" }
    | { __typename: "PinnedDiscussion" }
    | { __typename: "PinnedEnvironment" }
    | { __typename: "PinnedEvent" }
    | { __typename: "PinnedIssue" }
    | { __typename: "PrivateRepositoryForkingDisableAuditEntry" }
    | { __typename: "PrivateRepositoryForkingEnableAuditEntry" }
    | { __typename: "Project" }
    | { __typename: "ProjectCard" }
    | { __typename: "ProjectColumn" }
    | { __typename: "ProjectV2" }
    | { __typename: "ProjectV2Field" }
    | { __typename: "ProjectV2Item" }
    | { __typename: "ProjectV2ItemFieldDateValue" }
    | { __typename: "ProjectV2ItemFieldIterationValue" }
    | { __typename: "ProjectV2ItemFieldNumberValue" }
    | { __typename: "ProjectV2ItemFieldSingleSelectValue" }
    | { __typename: "ProjectV2ItemFieldTextValue" }
    | { __typename: "ProjectV2ItemStatusChangedEvent" }
    | { __typename: "ProjectV2IterationField" }
    | { __typename: "ProjectV2SingleSelectField" }
    | { __typename: "ProjectV2StatusUpdate" }
    | { __typename: "ProjectV2View" }
    | { __typename: "ProjectV2Workflow" }
    | { __typename: "PublicKey" }
    | { __typename: "PullRequest" }
    | { __typename: "PullRequestCommit" }
    | { __typename: "PullRequestCommitCommentThread" }
    | { __typename: "PullRequestReview" }
    | { __typename: "PullRequestReviewComment" }
    | {
        __typename: "PullRequestReviewThread"
        comments: {
          __typename: "PullRequestReviewCommentConnection"
          pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
          nodes: Array<{
            __typename: "PullRequestReviewComment"
            id: string
            url: any
            author:
              | { __typename: "Bot"; login: string }
              | { __typename: "EnterpriseUserAccount"; login: string }
              | { __typename: "Mannequin"; login: string }
              | { __typename: "Organization"; login: string }
              | { __typename: "User"; login: string }
              | null
            reactionGroups: Array<{
              __typename: "ReactionGroup"
              content: Types.ReactionContent
              viewerHasReacted: boolean
              reactors: {
                __typename: "ReactorConnection"
                totalCount: number
                nodes: Array<
                  | { __typename: "Bot"; login: string }
                  | { __typename: "Mannequin"; login: string }
                  | { __typename: "Organization"; login: string }
                  | { __typename: "User"; login: string }
                  | null
                > | null
              }
            }> | null
          } | null> | null
        }
      }
    | { __typename: "PullRequestThread" }
    | { __typename: "Push" }
    | { __typename: "PushAllowance" }
    | { __typename: "Query" }
    | { __typename: "Reaction" }
    | { __typename: "ReadyForReviewEvent" }
    | { __typename: "Ref" }
    | { __typename: "ReferencedEvent" }
    | { __typename: "Release" }
    | { __typename: "ReleaseAsset" }
    | { __typename: "RemovedFromMergeQueueEvent" }
    | { __typename: "RemovedFromProjectEvent" }
    | { __typename: "RemovedFromProjectV2Event" }
    | { __typename: "RenamedTitleEvent" }
    | { __typename: "ReopenedEvent" }
    | { __typename: "RepoAccessAuditEntry" }
    | { __typename: "RepoAddMemberAuditEntry" }
    | { __typename: "RepoAddTopicAuditEntry" }
    | { __typename: "RepoArchivedAuditEntry" }
    | { __typename: "RepoChangeMergeSettingAuditEntry" }
    | { __typename: "RepoConfigDisableAnonymousGitAccessAuditEntry" }
    | { __typename: "RepoConfigDisableCollaboratorsOnlyAuditEntry" }
    | { __typename: "RepoConfigDisableContributorsOnlyAuditEntry" }
    | { __typename: "RepoConfigDisableSockpuppetDisallowedAuditEntry" }
    | { __typename: "RepoConfigEnableAnonymousGitAccessAuditEntry" }
    | { __typename: "RepoConfigEnableCollaboratorsOnlyAuditEntry" }
    | { __typename: "RepoConfigEnableContributorsOnlyAuditEntry" }
    | { __typename: "RepoConfigEnableSockpuppetDisallowedAuditEntry" }
    | { __typename: "RepoConfigLockAnonymousGitAccessAuditEntry" }
    | { __typename: "RepoConfigUnlockAnonymousGitAccessAuditEntry" }
    | { __typename: "RepoCreateAuditEntry" }
    | { __typename: "RepoDestroyAuditEntry" }
    | { __typename: "RepoRemoveMemberAuditEntry" }
    | { __typename: "RepoRemoveTopicAuditEntry" }
    | { __typename: "Repository" }
    | { __typename: "RepositoryCustomProperty" }
    | { __typename: "RepositoryDependabotAlertsThread" }
    | { __typename: "RepositoryInvitation" }
    | { __typename: "RepositoryMigration" }
    | { __typename: "RepositoryRule" }
    | { __typename: "RepositoryRuleset" }
    | { __typename: "RepositoryRulesetBypassActor" }
    | { __typename: "RepositoryTopic" }
    | { __typename: "RepositoryVisibilityChangeDisableAuditEntry" }
    | { __typename: "RepositoryVisibilityChangeEnableAuditEntry" }
    | { __typename: "RepositoryVulnerabilityAlert" }
    | { __typename: "ReviewDismissalAllowance" }
    | { __typename: "ReviewDismissedEvent" }
    | { __typename: "ReviewRequest" }
    | { __typename: "ReviewRequestRemovedEvent" }
    | { __typename: "ReviewRequestedEvent" }
    | { __typename: "SavedReply" }
    | { __typename: "SecurityAdvisory" }
    | { __typename: "SponsorsActivity" }
    | { __typename: "SponsorsListing" }
    | { __typename: "SponsorsListingFeaturedItem" }
    | { __typename: "SponsorsTier" }
    | { __typename: "Sponsorship" }
    | { __typename: "SponsorshipNewsletter" }
    | { __typename: "Status" }
    | { __typename: "StatusCheckRollup" }
    | { __typename: "StatusContext" }
    | { __typename: "SubIssueAddedEvent" }
    | { __typename: "SubIssueRemovedEvent" }
    | { __typename: "SubscribedEvent" }
    | { __typename: "Tag" }
    | { __typename: "Team" }
    | { __typename: "TeamAddMemberAuditEntry" }
    | { __typename: "TeamAddRepositoryAuditEntry" }
    | { __typename: "TeamChangeParentTeamAuditEntry" }
    | { __typename: "TeamRemoveMemberAuditEntry" }
    | { __typename: "TeamRemoveRepositoryAuditEntry" }
    | { __typename: "Topic" }
    | { __typename: "TransferredEvent" }
    | { __typename: "Tree" }
    | { __typename: "UnassignedEvent" }
    | { __typename: "UnlabeledEvent" }
    | { __typename: "UnlockedEvent" }
    | { __typename: "UnmarkedAsDuplicateEvent" }
    | { __typename: "UnpinnedEvent" }
    | { __typename: "UnsubscribedEvent" }
    | { __typename: "User" }
    | { __typename: "UserBlockedEvent" }
    | { __typename: "UserContentEdit" }
    | { __typename: "UserList" }
    | { __typename: "UserNamespaceRepository" }
    | { __typename: "UserStatus" }
    | { __typename: "VerifiableDomain" }
    | { __typename: "Workflow" }
    | { __typename: "WorkflowRun" }
    | { __typename: "WorkflowRunFile" }
    | null
}

export const PrCommentsReactionsIssueCommentsPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PrCommentsReactionsIssueCommentsPage" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "owner" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "name" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "repository" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "owner" },
                value: { kind: "Variable", name: { kind: "Name", value: "owner" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "name" },
                value: { kind: "Variable", name: { kind: "Name", value: "name" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pullRequest" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "number" },
                      value: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "comments" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "Variable", name: { kind: "Name", value: "first" } },
                          },
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "after" },
                            value: { kind: "Variable", name: { kind: "Name", value: "after" } },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "pageInfo" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  {
                                    kind: "FragmentSpread",
                                    name: { kind: "Name", value: "PageInfoFields" },
                                  },
                                ],
                              },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "nodes" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  { kind: "Field", name: { kind: "Name", value: "id" } },
                                  { kind: "Field", name: { kind: "Name", value: "url" } },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "author" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        { kind: "Field", name: { kind: "Name", value: "login" } },
                                      ],
                                    },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "reactionGroups" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        {
                                          kind: "FragmentSpread",
                                          name: { kind: "Name", value: "ReactionGroupFields" },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PageInfoFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "PageInfo" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "endCursor" } },
          { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "ReactionGroupFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "ReactionGroup" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "content" } },
          { kind: "Field", name: { kind: "Name", value: "viewerHasReacted" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "reactors" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "100" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "nodes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "User" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Bot" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Organization" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Mannequin" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  PrCommentsReactionsIssueCommentsPageQuery,
  PrCommentsReactionsIssueCommentsPageQueryVariables
>
export const PrCommentsReactionsReviewThreadsPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PrCommentsReactionsReviewThreadsPage" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "owner" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "name" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "repository" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "owner" },
                value: { kind: "Variable", name: { kind: "Name", value: "owner" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "name" },
                value: { kind: "Variable", name: { kind: "Name", value: "name" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pullRequest" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "number" },
                      value: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "reviewThreads" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "Variable", name: { kind: "Name", value: "first" } },
                          },
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "after" },
                            value: { kind: "Variable", name: { kind: "Name", value: "after" } },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "pageInfo" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  {
                                    kind: "FragmentSpread",
                                    name: { kind: "Name", value: "PageInfoFields" },
                                  },
                                ],
                              },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "edges" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  { kind: "Field", name: { kind: "Name", value: "cursor" } },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "node" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        { kind: "Field", name: { kind: "Name", value: "id" } },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "comments" },
                                          arguments: [
                                            {
                                              kind: "Argument",
                                              name: { kind: "Name", value: "first" },
                                              value: {
                                                kind: "Variable",
                                                name: { kind: "Name", value: "first" },
                                              },
                                            },
                                          ],
                                          selectionSet: {
                                            kind: "SelectionSet",
                                            selections: [
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "__typename" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "pageInfo" },
                                                selectionSet: {
                                                  kind: "SelectionSet",
                                                  selections: [
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "__typename" },
                                                    },
                                                    {
                                                      kind: "FragmentSpread",
                                                      name: {
                                                        kind: "Name",
                                                        value: "PageInfoFields",
                                                      },
                                                    },
                                                  ],
                                                },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "nodes" },
                                                selectionSet: {
                                                  kind: "SelectionSet",
                                                  selections: [
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "__typename" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "id" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "url" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "author" },
                                                      selectionSet: {
                                                        kind: "SelectionSet",
                                                        selections: [
                                                          {
                                                            kind: "Field",
                                                            name: {
                                                              kind: "Name",
                                                              value: "__typename",
                                                            },
                                                          },
                                                          {
                                                            kind: "Field",
                                                            name: { kind: "Name", value: "login" },
                                                          },
                                                        ],
                                                      },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: {
                                                        kind: "Name",
                                                        value: "reactionGroups",
                                                      },
                                                      selectionSet: {
                                                        kind: "SelectionSet",
                                                        selections: [
                                                          {
                                                            kind: "Field",
                                                            name: {
                                                              kind: "Name",
                                                              value: "__typename",
                                                            },
                                                          },
                                                          {
                                                            kind: "FragmentSpread",
                                                            name: {
                                                              kind: "Name",
                                                              value: "ReactionGroupFields",
                                                            },
                                                          },
                                                        ],
                                                      },
                                                    },
                                                  ],
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PageInfoFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "PageInfo" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "endCursor" } },
          { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "ReactionGroupFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "ReactionGroup" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "content" } },
          { kind: "Field", name: { kind: "Name", value: "viewerHasReacted" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "reactors" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "100" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "nodes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "User" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Bot" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Organization" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Mannequin" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  PrCommentsReactionsReviewThreadsPageQuery,
  PrCommentsReactionsReviewThreadsPageQueryVariables
>
export const PrCommentsReactionsThreadCommentsPageDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PrCommentsReactionsThreadCommentsPage" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "threadId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "node" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "threadId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "InlineFragment",
                  typeCondition: {
                    kind: "NamedType",
                    name: { kind: "Name", value: "PullRequestReviewThread" },
                  },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "comments" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "Variable", name: { kind: "Name", value: "first" } },
                          },
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "after" },
                            value: { kind: "Variable", name: { kind: "Name", value: "after" } },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "pageInfo" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  {
                                    kind: "FragmentSpread",
                                    name: { kind: "Name", value: "PageInfoFields" },
                                  },
                                ],
                              },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "nodes" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  { kind: "Field", name: { kind: "Name", value: "id" } },
                                  { kind: "Field", name: { kind: "Name", value: "url" } },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "author" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        { kind: "Field", name: { kind: "Name", value: "login" } },
                                      ],
                                    },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "reactionGroups" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        {
                                          kind: "FragmentSpread",
                                          name: { kind: "Name", value: "ReactionGroupFields" },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PageInfoFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "PageInfo" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "endCursor" } },
          { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "ReactionGroupFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "ReactionGroup" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "content" } },
          { kind: "Field", name: { kind: "Name", value: "viewerHasReacted" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "reactors" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "first" },
                value: { kind: "IntValue", value: "100" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "nodes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "User" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Bot" } },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Organization" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: { kind: "Name", value: "Mannequin" },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [{ kind: "Field", name: { kind: "Name", value: "login" } }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  PrCommentsReactionsThreadCommentsPageQuery,
  PrCommentsReactionsThreadCommentsPageQueryVariables
>
