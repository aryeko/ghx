# Capabilities Reference

All 70 capabilities in `@ghx-dev/core`, grouped by domain.

## Repository

| Capability ID | Description | Preferred Route |
|---|---|---|
| `repo.view` | Fetch repository metadata | graphql |
| `repo.labels.list` | List repository labels | graphql |
| `repo.issue_types.list` | List repository issue types | graphql |

## Issues (23)

| Capability ID | Description | Preferred Route |
|---|---|---|
| `issue.view` | View issue details | graphql |
| `issue.list` | List issues with filters | graphql |
| `issue.create` | Create a new issue | graphql |
| `issue.update` | Update issue title/body | graphql |
| `issue.close` | Close an issue | graphql |
| `issue.reopen` | Reopen a closed issue | graphql |
| `issue.delete` | Delete an issue | graphql |
| `issue.comments.list` | List issue comments | graphql |
| `issue.comments.create` | Add a comment to an issue | graphql |
| `issue.labels.add` | Add labels to an issue | graphql |
| `issue.labels.remove` | Remove labels from an issue | graphql |
| `issue.labels.set` | Replace all labels on an issue | graphql |
| `issue.assignees.add` | Add assignees to an issue | graphql |
| `issue.assignees.remove` | Remove assignees from an issue | graphql |
| `issue.assignees.set` | Replace all assignees on an issue | graphql |
| `issue.milestone.set` | Set a milestone on an issue | graphql |
| `issue.milestone.clear` | Clear the milestone from an issue | graphql |
| `issue.relations.view` | View issue relationships | graphql |
| `issue.relations.prs.list` | List linked pull requests | graphql |
| `issue.relations.parent.set` | Set parent issue | graphql |
| `issue.relations.parent.remove` | Remove parent issue | graphql |
| `issue.relations.blocked_by.add` | Add blocked-by relationship | graphql |
| `issue.relations.blocked_by.remove` | Remove blocked-by relationship | graphql |

## Pull Requests (21)

| Capability ID | Description | Preferred Route |
|---|---|---|
| `pr.view` | View PR details | graphql |
| `pr.list` | List PRs with filters | graphql |
| `pr.create` | Create a new PR | cli |
| `pr.update` | Update PR title/body | graphql |
| `pr.merge` | Merge a PR | graphql |
| `pr.merge.status` | Check PR merge status | graphql |
| `pr.diff.view` | View raw PR diff | cli |
| `pr.diff.files` | List changed files in a PR | cli |
| `pr.threads.list` | List review threads | graphql |
| `pr.threads.reply` | Reply to a review thread | graphql |
| `pr.threads.resolve` | Resolve a review thread | graphql |
| `pr.threads.unresolve` | Unresolve a review thread | graphql |
| `pr.reviews.list` | List PR reviews | graphql |
| `pr.reviews.submit` | Submit a PR review | graphql |
| `pr.reviews.request` | Request reviewers | graphql |
| `pr.assignees.add` | Add assignees to a PR | graphql |
| `pr.assignees.remove` | Remove assignees from a PR | graphql |
| `pr.checks.list` | List check runs for a PR | graphql |
| `pr.checks.rerun.all` | Rerun all checks | cli |
| `pr.checks.rerun.failed` | Rerun failed checks | cli |
| `pr.branch.update` | Update PR branch from base | graphql |

## Workflows & CI (11)

| Capability ID | Description | Preferred Route |
|---|---|---|
| `workflow.list` | List repository workflows | cli |
| `workflow.view` | View workflow details | cli |
| `workflow.dispatch` | Trigger a workflow dispatch | cli |
| `workflow.runs.list` | List workflow runs | cli |
| `workflow.run.view` | View a specific workflow run | cli |
| `workflow.run.cancel` | Cancel a workflow run | cli |
| `workflow.run.rerun.all` | Rerun all jobs in a run | cli |
| `workflow.run.rerun.failed` | Rerun failed jobs | cli |
| `workflow.run.artifacts.list` | List run artifacts | cli |
| `workflow.job.logs.view` | View job logs (parsed) | cli |
| `workflow.job.logs.raw` | View raw job logs | cli |

## Releases (5)

| Capability ID | Description | Preferred Route |
|---|---|---|
| `release.view` | View release details | graphql |
| `release.list` | List releases | graphql |
| `release.create` | Create a new release | cli |
| `release.update` | Update release metadata | graphql |
| `release.publish` | Publish a draft release | graphql |

## Projects V2 (7)

| Capability ID | Description | Preferred Route |
|---|---|---|
| `project_v2.org.view` | View an organization project | graphql |
| `project_v2.user.view` | View a user project | graphql |
| `project_v2.fields.list` | List project fields | graphql |
| `project_v2.items.list` | List project items | graphql |
| `project_v2.items.issue.add` | Add an issue to a project | graphql |
| `project_v2.items.issue.remove` | Remove an issue from a project | graphql |
| `project_v2.items.field.update` | Update a project item field | graphql |
