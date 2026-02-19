import { handlers } from "@core/core/execution/adapters/cli/domains/pr.js"
import type { CliHandler } from "@core/core/execution/adapters/cli/helpers.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

const h = (id: string): CliHandler => {
  const fn = handlers[id]
  if (fn === undefined) throw new Error(`no handler: ${id}`)
  return fn
}

describe("pr domain handlers", () => {
  describe("pr.view", () => {
    it("returns success with title, body, labels", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "PR_1",
          number: 123,
          title: "Fix bug",
          state: "OPEN",
          url: "https://github.com/owner/repo/pull/123",
          body: "This fixes the bug",
          labels: [
            { id: "L_1", name: "bug" },
            { id: "L_2", name: "urgent" },
          ],
        }),
      )

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        number: 123,
        title: "Fix bug",
        state: "OPEN",
        body: "This fixes the bug",
        labels: ["bug", "urgent"],
      })
      expect(result.meta.capability_id).toBe("pr.view")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "pull request not found")

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("pr.view")
    })
  })

  describe("pr.list", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            id: "PR_1",
            number: 1,
            title: "First PR",
            state: "OPEN",
            url: "https://github.com/owner/repo/pull/1",
          },
          {
            id: "PR_2",
            number: 2,
            title: "Second PR",
            state: "MERGED",
            url: "https://github.com/owner/repo/pull/2",
          },
        ]),
      )

      const result = await h("pr.list")(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { number: 1, title: "First PR", state: "OPEN" },
          { number: 2, title: "Second PR", state: "MERGED" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.list")(runner, { owner: "owner", name: "repo", first: 50 }, undefined)

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "list", "--limit", "50"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.create", () => {
    it("parses URL from stdout and returns success", async () => {
      const runner = mockRunner(0, "https://github.com/owner/repo/pull/42\nPull request created")

      const result = await h("pr.create")(
        runner,
        {
          owner: "owner",
          name: "repo",
          title: "New feature",
          head: "feature-branch",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        number: 42,
        url: "https://github.com/owner/repo/pull/42",
        title: "New feature",
        state: "OPEN",
        draft: false,
      })
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "branch not found")

      const result = await h("pr.create")(
        runner,
        {
          owner: "owner",
          name: "repo",
          title: "New feature",
          head: "missing-branch",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.update", () => {
    it("calls pr edit with title and body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, title: "Updated title", body: "New body" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "pr",
          "edit",
          "123",
          "--title",
          "Updated title",
          "--body",
          "New body",
        ]),
        expect.any(Number),
      )
    })

    it("draft-only path calls pr ready with --undo", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, draft: true },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "ready", "123", "--undo"]),
        expect.any(Number),
      )
    })

    it("with title and draft calls both pr edit and pr ready", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, title: "New title", draft: false },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledTimes(2)
      expect(runSpy).toHaveBeenNthCalledWith(
        1,
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--title", "New title"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenNthCalledWith(
        2,
        "gh",
        expect.arrayContaining(["pr", "ready", "123"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.checks.list", () => {
    it("returns all checks with summary", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            name: "test",
            state: "PASS",
            bucket: "PASS",
            workflow: "test.yml",
            link: "https://...",
          },
          {
            name: "lint",
            state: "FAIL",
            bucket: "FAIL",
            workflow: "lint.yml",
            link: "https://...",
          },
          {
            name: "build",
            state: "PENDING",
            bucket: "PENDING",
            workflow: "build.yml",
            link: "https://...",
          },
        ]),
      )

      const result = await h("pr.checks.list")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "test", state: "PASS", bucket: "PASS" },
          { name: "lint", state: "FAIL", bucket: "FAIL" },
          { name: "build", state: "PENDING", bucket: "PENDING" },
        ],
        summary: { total: 3, failed: 1, pending: 1, passed: 1 },
      })
    })
  })

  describe("pr.checks.failed", () => {
    it("returns only failed checks", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            name: "test",
            state: "PASS",
            bucket: "PASS",
            workflow: "test.yml",
            link: "https://...",
          },
          {
            name: "lint",
            state: "FAIL",
            bucket: "FAIL",
            workflow: "lint.yml",
            link: "https://...",
          },
          {
            name: "build",
            state: "FAIL",
            bucket: "FAIL",
            workflow: "build.yml",
            link: "https://...",
          },
        ]),
      )

      const result = await h("pr.checks.failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "lint", state: "FAIL", bucket: "FAIL" },
          { name: "build", state: "FAIL", bucket: "FAIL" },
        ],
        summary: { total: 3, failed: 2, pending: 0, passed: 1 },
      })
    })
  })

  describe("pr.checks.rerun_failed", () => {
    it("succeeds with mode failed", async () => {
      const runner = mockRunner(0, "", "")

      const result = await h("pr.checks.rerun_failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        runId: 999,
        mode: "failed",
        queued: true,
      })
    })

    it("falls back to rerun_all when stderr contains 'cannot be rerun' and 'cannot be retried'", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "the workflow run cannot be rerun because it cannot be retried",
        })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })

      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.checks.rerun_failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        runId: 999,
        mode: "all",
        queued: true,
      })
      expect(runSpy).toHaveBeenCalledTimes(2)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run not found")

      const result = await h("pr.checks.rerun_failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.checks.rerun_all", () => {
    it("succeeds with mode all", async () => {
      const runner = mockRunner(0, "", "")

      const result = await h("pr.checks.rerun_all")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        runId: 999,
        mode: "all",
        queued: true,
      })
    })
  })

  describe("pr.review.submit", () => {
    it("APPROVE with optional body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.review.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "APPROVE",
          body: "Looks good",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        event: "APPROVE",
        submitted: true,
        body: "Looks good",
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "review", "123", "--approve", "--body", "Looks good"]),
        expect.any(Number),
      )
    })

    it("REQUEST_CHANGES requires body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.review.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "REQUEST_CHANGES",
          body: "Please fix this",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "pr",
          "review",
          "123",
          "--request-changes",
          "--body",
          "Please fix this",
        ]),
        expect.any(Number),
      )
    })

    it("COMMENT requires body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.review.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "COMMENT",
          body: "Nice work",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "review", "123", "--comment", "--body", "Nice work"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.merge", () => {
    it("succeeds with method squash and deleteBranch", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.merge")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          method: "squash",
          deleteBranch: true,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        method: "squash",
        queued: true,
        deleteBranch: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "merge", "123", "--squash", "--delete-branch"]),
        expect.any(Number),
      )
    })

    it("defaults to merge method", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.merge")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "merge", "123", "--merge"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.review.request", () => {
    it("succeeds with reviewers list", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.review.request")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          reviewers: ["alice", "bob"],
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        reviewers: ["alice", "bob"],
        updated: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--add-reviewer", "alice,bob"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.assignees.update", () => {
    it("adds and removes assignees", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.assignees.update")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          add: ["alice"],
          remove: ["bob"],
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        add: ["alice"],
        remove: ["bob"],
        updated: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "pr",
          "edit",
          "123",
          "--add-assignee",
          "alice",
          "--remove-assignee",
          "bob",
        ]),
        expect.any(Number),
      )
    })
  })

  describe("pr.branch.update", () => {
    it("succeeds", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.branch.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        updated: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "update-branch", "123"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.diff.view", () => {
    it("returns raw diff text", async () => {
      const diffText = "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new"
      const runner = mockRunner(0, diffText)

      const result = await h("pr.diff.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        diff: diffText,
      })
    })
  })

  describe("pr.diff.files", () => {
    it("returns files list", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          files: [
            { name: "file1.ts", additions: 10, deletions: 2 },
            { name: "file2.ts", additions: 5, deletions: 1 },
          ],
        }),
      )

      const result = await h("pr.diff.files")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        files: [
          { name: "file1.ts", additions: 10, deletions: 2 },
          { name: "file2.ts", additions: 5, deletions: 1 },
        ],
      })
    })
  })

  describe("check_run.annotations.list", () => {
    it("returns annotations with mapped fields", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            path: "src/main.ts",
            start_line: 10,
            end_line: 15,
            annotation_level: "warning",
            message: "Unused variable",
            title: "Lint warning",
            raw_details: "Details here",
          },
          {
            path: "src/utils.ts",
            start_line: 20,
            end_line: 20,
            annotation_level: "error",
            message: "Syntax error",
            title: "Parse error",
            raw_details: null,
          },
        ]),
      )

      const result = await h("check_run.annotations.list")(
        runner,
        { owner: "owner", name: "repo", checkRunId: 555 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          {
            path: "src/main.ts",
            startLine: 10,
            endLine: 15,
            level: "warning",
            message: "Unused variable",
            title: "Lint warning",
            details: "Details here",
          },
          {
            path: "src/utils.ts",
            startLine: 20,
            endLine: 20,
            level: "error",
            message: "Syntax error",
            title: "Parse error",
            details: null,
          },
        ],
      })
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "check run not found")

      const result = await h("check_run.annotations.list")(
        runner,
        { owner: "owner", name: "repo", checkRunId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("check_run.annotations.list")
    })
  })

  describe("pr.merge.status", () => {
    it("returns merge status fields", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewDecision: "APPROVED",
          isDraft: false,
          state: "OPEN",
        }),
      )

      const result = await h("pr.merge.status")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "APPROVED",
        isDraft: false,
        state: "OPEN",
      })
    })
  })

  describe("error handling", () => {
    it("returns error for pr.view on non-zero exit", async () => {
      const runner = mockRunner(1, "", "authentication failed")

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.code).toBeDefined()
    })

    it("handles JSON parse errors gracefully", async () => {
      const runner = mockRunner(0, "invalid json {")

      const result = await h("pr.list")(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("validates required parameters", async () => {
      const runner = mockRunner(0, "")

      const result = await h("pr.view")(runner, { owner: "owner", name: "repo" }, undefined)

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })
  })
})
