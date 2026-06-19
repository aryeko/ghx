import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  commandTokens,
  DEFAULT_TIMEOUT_MS,
  jsonFieldsFromCard,
  MAX_WORKFLOW_JOB_LOG_CHARS,
  normalizeWorkflowItem,
  parseCliData,
  parseListFirst,
  parseNonEmptyString,
  parseStrictPositiveInt,
  requireRepo,
  sanitizeCliErrorMessage,
} from "../helpers.js"

const WORKFLOW_PAGE_CURSOR_VERSION = 1

function encodeWorkflowPageCursor(page: number): string {
  return Buffer.from(JSON.stringify({ v: WORKFLOW_PAGE_CURSOR_VERSION, page }), "utf8").toString(
    "base64url",
  )
}

function decodeWorkflowPageCursor(value: unknown, capabilityId: string): number {
  if (value === undefined || value === null || value === "") {
    return 1
  }
  if (typeof value !== "string") {
    throw new Error(`Invalid after cursor for ${capabilityId}`)
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("cursor payload must be an object")
    }
    const payload = parsed as Record<string, unknown>
    if (
      payload.v !== WORKFLOW_PAGE_CURSOR_VERSION ||
      !Number.isInteger(payload.page) ||
      (payload.page as number) < 1
    ) {
      throw new Error("cursor payload is invalid")
    }
    return payload.page as number
  } catch {
    throw new Error(`Invalid after cursor for ${capabilityId}`)
  }
}

function pageInfoFromRestTotal(totalCount: number, first: number, page: number) {
  const hasNextPage = page * first < totalCount
  return {
    hasNextPage,
    endCursor: hasNextPage ? encodeWorkflowPageCursor(page + 1) : null,
  }
}

function restTotalCount(root: Record<string, unknown>, itemCount: number): number {
  return typeof root.total_count === "number" && Number.isFinite(root.total_count)
    ? root.total_count
    : itemCount
}

export const handleWorkflowRunsList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    if (!repo) {
      throw new Error("Missing owner/name for workflow.runs.list")
    }

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for workflow.runs.list")
    }
    const page = decodeWorkflowPageCursor(params.after, "workflow.runs.list")

    const args = commandTokens(card, "api")
    args.push(`repos/${owner}/${name}/actions/runs`, "--method", "GET")
    args.push("-f", `per_page=${String(first)}`, "-f", `page=${String(page)}`)

    const branch = parseNonEmptyString(params.branch)
    if (branch) {
      args.push("-f", `branch=${branch}`)
    }

    const event = parseNonEmptyString(params.event)
    if (event) {
      args.push("-f", `event=${event}`)
    }

    const status = parseNonEmptyString(params.status)
    if (status) {
      args.push("-f", `status=${status}`)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.runs.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.runs.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const runs = Array.isArray(root.workflow_runs) ? root.workflow_runs : []
    const totalCount = restTotalCount(root, runs.length)

    const normalized = {
      items: runs.map((run) => {
        if (typeof run !== "object" || run === null || Array.isArray(run)) {
          return {
            id: 0,
            workflowName: null,
            status: null,
            conclusion: null,
            headBranch: null,
            url: null,
          }
        }

        const input = run as Record<string, unknown>
        return {
          id:
            typeof input.databaseId === "number"
              ? input.databaseId
              : typeof input.id === "number"
                ? input.id
                : 0,
          workflowName:
            typeof input.workflowName === "string"
              ? input.workflowName
              : typeof input.name === "string"
                ? input.name
                : null,
          status: typeof input.status === "string" ? input.status : null,
          conclusion: typeof input.conclusion === "string" ? input.conclusion : null,
          headBranch:
            typeof input.headBranch === "string"
              ? input.headBranch
              : typeof input.head_branch === "string"
                ? input.head_branch
                : null,
          url:
            typeof input.url === "string"
              ? input.url
              : typeof input.html_url === "string"
                ? input.html_url
                : null,
        }
      }),
      pageInfo: pageInfoFromRestTotal(totalCount, first, page),
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.runs.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "workflow.runs.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.runs.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowJobLogsRaw: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const jobId = parseStrictPositiveInt(params.jobId)
    if (jobId === null) {
      throw new Error("Missing or invalid jobId for workflow.job.logs.raw")
    }

    const args = commandTokens(card, "run view")
    args.push("--job", String(jobId), "--log")

    if (repo) {
      args.push("--repo", repo)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.job.logs.raw", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.job.logs.raw", reason: "CARD_FALLBACK" },
      )
    }

    const rawLog = result.stdout
    const truncated = rawLog.length > MAX_WORKFLOW_JOB_LOG_CHARS
    const logContent = rawLog.slice(0, MAX_WORKFLOW_JOB_LOG_CHARS)

    const normalized = {
      jobId,
      log: logContent,
      truncated,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.job.logs.raw",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.job.logs.raw", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowJobLogsGet: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const jobId = parseStrictPositiveInt(params.jobId)
    if (jobId === null) {
      throw new Error("Missing or invalid jobId for workflow.job.logs.view")
    }

    const args = commandTokens(card, "run view")
    args.push("--job", String(jobId), "--log")

    if (repo) {
      args.push("--repo", repo)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.job.logs.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.job.logs.view", reason: "CARD_FALLBACK" },
      )
    }

    const rawLog = result.stdout
    const truncated = rawLog.length > MAX_WORKFLOW_JOB_LOG_CHARS
    const logContent = rawLog.slice(0, MAX_WORKFLOW_JOB_LOG_CHARS)

    const lines = logContent.split(/\r?\n/)
    const errorLines: string[] = []
    const warningLines: string[] = []
    let totalErrorCount = 0
    let totalWarningCount = 0

    for (const line of lines) {
      if (/\berror\b/i.test(line)) {
        totalErrorCount++
        if (errorLines.length < 10) {
          errorLines.push(line)
        }
      }
      if (/\bwarn(ing)?\b/i.test(line)) {
        totalWarningCount++
        if (warningLines.length < 10) {
          warningLines.push(line)
        }
      }
    }

    const normalized = {
      jobId,
      truncated,
      summary: {
        errorCount: totalErrorCount,
        warningCount: totalWarningCount,
        topErrorLines: errorLines.slice(0, 10),
      },
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.job.logs.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.job.logs.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    if (!repo) {
      throw new Error("Missing owner/name for workflow.list")
    }

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for workflow.list")
    }
    const page = decodeWorkflowPageCursor(params.after, "workflow.list")

    const args = commandTokens(card, "api")
    args.push(`repos/${owner}/${name}/actions/workflows`, "--method", "GET")
    args.push("-f", `per_page=${String(first)}`, "-f", `page=${String(page)}`)

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const workflows = Array.isArray(root.workflows) ? root.workflows : []
    const totalCount = restTotalCount(root, workflows.length)

    const normalized = {
      items: workflows.map((workflow) => normalizeWorkflowItem(workflow)),
      pageInfo: pageInfoFromRestTotal(totalCount, first, page),
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "workflow.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowGet: CliHandler = async (runner, params, card) => {
  try {
    const workflowId =
      parseNonEmptyString(params.workflowId) ??
      (typeof params.workflowId === "number" ? String(params.workflowId) : null)

    if (!workflowId) {
      throw new Error("Missing or invalid workflowId for workflow.view")
    }

    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const args = commandTokens(card, "workflow view")
    args.push(workflowId)

    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,name,path,state,url"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}

    const item = normalizeWorkflowItem(root)
    const normalized = {
      ...item,
      url: typeof root.url === "string" ? root.url : null,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "workflow.view", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowRunView: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow.run.view")
    }

    const args = commandTokens(card, "run view")
    args.push(String(runId))

    if (repo) {
      args.push("--repo", repo)
    }

    args.push(
      "--json",
      jsonFieldsFromCard(
        card,
        "databaseId,workflowName,status,conclusion,headBranch,headSha,url,event,createdAt,updatedAt,startedAt,jobs",
      ),
    )

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.run.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.run.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}

    const jobsArray = Array.isArray(root.jobs) ? root.jobs : []

    const normalized = {
      id: typeof root.databaseId === "number" ? root.databaseId : 0,
      workflowName: typeof root.workflowName === "string" ? root.workflowName : null,
      status: typeof root.status === "string" ? root.status : null,
      conclusion: typeof root.conclusion === "string" ? root.conclusion : null,
      headBranch: typeof root.headBranch === "string" ? root.headBranch : null,
      headSha: typeof root.headSha === "string" ? root.headSha : null,
      event: typeof root.event === "string" ? root.event : null,
      createdAt: typeof root.createdAt === "string" ? root.createdAt : null,
      updatedAt: typeof root.updatedAt === "string" ? root.updatedAt : null,
      startedAt: typeof root.startedAt === "string" ? root.startedAt : null,
      url: typeof root.url === "string" ? root.url : null,
      attempt: typeof root.attempt === "number" ? root.attempt : 1,
      jobs: jobsArray.map((job) => {
        if (typeof job !== "object" || job === null || Array.isArray(job)) {
          return {
            id: 0,
            name: null,
            status: null,
            conclusion: null,
            startedAt: null,
            completedAt: null,
            url: null,
          }
        }

        const input = job as Record<string, unknown>
        return {
          id: typeof input.databaseId === "number" ? input.databaseId : 0,
          name: typeof input.name === "string" ? input.name : null,
          status: typeof input.status === "string" ? input.status : null,
          conclusion: typeof input.conclusion === "string" ? input.conclusion : null,
          startedAt: typeof input.startedAt === "string" ? input.startedAt : null,
          completedAt: typeof input.completedAt === "string" ? input.completedAt : null,
          url: typeof input.url === "string" ? input.url : null,
        }
      }),
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.run.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "workflow.run.view", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.run.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowRunRerunAll: CliHandler = async (runner, params, card) => {
  try {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow.run.rerun.all")
    }

    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const args = commandTokens(card, "run rerun")
    args.push(String(runId))

    if (repo) {
      args.push("--repo", repo)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.run.rerun.all", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.run.rerun.all", reason: "CARD_FALLBACK" },
      )
    }

    const normalized = {
      runId,
      queued: true,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.run.rerun.all",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.run.rerun.all", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowRunCancel: CliHandler = async (runner, params, card) => {
  try {
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow.run.cancel")
    }

    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const args = commandTokens(card, "run cancel")
    args.push(String(runId))

    if (repo) {
      args.push("--repo", repo)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.run.cancel", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.run.cancel", reason: "CARD_FALLBACK" },
      )
    }

    const normalized = {
      runId,
      status: "cancel_requested",
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.run.cancel",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.run.cancel", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowRunArtifactsList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow.run.artifacts.list")
    }
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for workflow.run.artifacts.list")
    }
    const page = decodeWorkflowPageCursor(params.after, "workflow.run.artifacts.list")

    requireRepo(owner, name, "workflow.run.artifacts.list")

    const args = commandTokens(card, "api")
    args.push(`repos/${owner}/${name}/actions/runs/${String(runId)}/artifacts`, "--method", "GET")
    args.push("-f", `per_page=${String(first)}`, "-f", `page=${String(page)}`)

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.run.artifacts.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.run.artifacts.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}

    const artifactsArray = Array.isArray(root.artifacts) ? root.artifacts : []
    const totalCount = restTotalCount(root, artifactsArray.length)

    const normalized = {
      items: artifactsArray.map((artifact) => {
        if (typeof artifact !== "object" || artifact === null || Array.isArray(artifact)) {
          return {
            id: null,
            name: null,
            sizeInBytes: null,
            archiveDownloadUrl: null,
          }
        }

        const input = artifact as Record<string, unknown>
        return {
          id: typeof input.id === "string" || typeof input.id === "number" ? input.id : null,
          name: typeof input.name === "string" ? input.name : null,
          sizeInBytes:
            typeof input.sizeInBytes === "number"
              ? input.sizeInBytes
              : typeof input.size_in_bytes === "number"
                ? input.size_in_bytes
                : null,
          archiveDownloadUrl:
            typeof input.archiveDownloadUrl === "string"
              ? input.archiveDownloadUrl
              : typeof input.archive_download_url === "string"
                ? input.archive_download_url
                : null,
        }
      }),
      pageInfo: pageInfoFromRestTotal(totalCount, first, page),
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.run.artifacts.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false,
        },
        "cli",
        { capabilityId: "workflow.run.artifacts.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.run.artifacts.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowDispatchRun: CliHandler = async (runner, params, card) => {
  try {
    const workflowId = parseNonEmptyString(params.workflowId)
    if (!workflowId) {
      throw new Error("Missing or invalid workflowId for workflow.dispatch")
    }

    const ref = parseNonEmptyString(params.ref)
    if (!ref) {
      throw new Error("Missing or invalid ref for workflow.dispatch")
    }

    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "workflow.dispatch")

    const encodedWorkflowId = encodeURIComponent(workflowId)
    const args = commandTokens(card, "api")
    args.push(`repos/${owner}/${name}/actions/workflows/${encodedWorkflowId}/dispatches`)
    args.push("--method", "POST")
    args.push("-f", `ref=${ref}`)

    if (params.inputs !== undefined) {
      const inputs = params.inputs
      if (typeof inputs !== "object" || inputs === null || Array.isArray(inputs)) {
        throw new Error("Missing or invalid inputs for workflow.dispatch")
      }
      const inputsObj = inputs as Record<string, unknown>
      for (const [key, value] of Object.entries(inputsObj)) {
        if (key.trim() === "") {
          throw new Error("Missing or invalid inputs for workflow.dispatch")
        }
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
          throw new Error("Missing or invalid inputs for workflow.dispatch")
        }
        args.push("-f", `inputs[${key}]=${String(value)}`)
      }
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.dispatch", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.dispatch", reason: "CARD_FALLBACK" },
      )
    }

    const normalized = {
      workflowId: String(workflowId),
      ref: String(ref),
      dispatched: true,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.dispatch",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.dispatch", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleWorkflowRunRerunFailed: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "workflow.run.rerun.failed")

    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) {
      throw new Error("Missing or invalid runId for workflow.run.rerun.failed")
    }

    const args = commandTokens(card, "api")
    args.push(`repos/${owner}/${name}/actions/runs/${runId}/rerun-failed-jobs`)
    args.push("--method", "POST")

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "workflow.run.rerun.failed", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "workflow.run.rerun.failed", reason: "CARD_FALLBACK" },
      )
    }

    const normalized = {
      runId,
      queued: true,
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "workflow.run.rerun.failed",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "workflow.run.rerun.failed", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "workflow.runs.list": handleWorkflowRunsList,
  "workflow.job.logs.raw": handleWorkflowJobLogsRaw,
  "workflow.job.logs.view": handleWorkflowJobLogsGet,
  "workflow.list": handleWorkflowList,
  "workflow.view": handleWorkflowGet,
  "workflow.run.view": handleWorkflowRunView,
  "workflow.run.rerun.all": handleWorkflowRunRerunAll,
  "workflow.run.cancel": handleWorkflowRunCancel,
  "workflow.run.artifacts.list": handleWorkflowRunArtifactsList,
  "workflow.dispatch": handleWorkflowDispatchRun,
  "workflow.run.rerun.failed": handleWorkflowRunRerunFailed,
}
