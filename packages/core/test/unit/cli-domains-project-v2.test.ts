import { handlers } from "@core/core/execution/adapters/cli/domains/project-v2.js"
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

describe("project-v2 domain handlers", () => {
  describe("project_v2.org.get", () => {
    it("returns success with normalized summary", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "PVT_1",
          title: "Q1 Roadmap",
          shortDescription: "Q1 planning and priorities",
          public: true,
          closed: false,
          url: "https://github.com/orgs/myorg/projects/1",
        }),
      )

      const result = await h("project_v2.org.get")(
        runner,
        {
          org: "myorg",
          projectNumber: 1,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: "PVT_1",
        title: "Q1 Roadmap",
        shortDescription: "Q1 planning and priorities",
        public: true,
        closed: false,
        url: "https://github.com/orgs/myorg/projects/1",
      })
      expect(result.meta.capability_id).toBe("project_v2.org.get")
      expect(result.meta.route_used).toBe("cli")
    })

    it("verifies call includes correct args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          id: "PVT_1",
          title: "Test",
          shortDescription: null,
          public: false,
          closed: false,
          url: "https://test.com",
        }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.org.get")(
        runner,
        {
          org: "testorg",
          projectNumber: 42,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["project", "view", "42", "--owner", "testorg", "--format", "json"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "permission denied")

      const result = await h("project_v2.org.get")(
        runner,
        {
          org: "myorg",
          projectNumber: 1,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("project_v2.org.get")
    })

    it("throws error for missing org", async () => {
      const runner = mockRunner(0, "{}")

      const result = await h("project_v2.org.get")(
        runner,
        {
          org: "",
          projectNumber: 1,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("org")
    })

    it("throws error for missing projectNumber", async () => {
      const runner = mockRunner(0, "{}")

      const result = await h("project_v2.org.get")(
        runner,
        {
          org: "myorg",
          projectNumber: 0,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("projectNumber")
    })
  })

  describe("project_v2.user.get", () => {
    it("returns success with normalized summary", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "PVT_2",
          title: "My Project",
          shortDescription: "Personal project",
          public: false,
          closed: false,
          url: "https://github.com/users/myuser/projects/5",
        }),
      )

      const result = await h("project_v2.user.get")(
        runner,
        {
          user: "myuser",
          projectNumber: 5,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: "PVT_2",
        title: "My Project",
        public: false,
      })
      expect(result.meta.capability_id).toBe("project_v2.user.get")
    })

    it("verifies call includes correct args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          id: "PVT_2",
          title: "Test",
          shortDescription: null,
          public: false,
          closed: false,
          url: "https://test.com",
        }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.user.get")(
        runner,
        {
          user: "testuser",
          projectNumber: 10,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "view",
          "10",
          "--owner",
          "testuser",
          "--format",
          "json",
        ]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "not found")

      const result = await h("project_v2.user.get")(
        runner,
        {
          user: "nonexistent",
          projectNumber: 99,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("project_v2.fields.list", () => {
    it("returns success with fields array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          fields: [
            { id: "F_1", name: "Status", dataType: "SINGLE_SELECT" },
            { id: "F_2", name: "Priority", dataType: "SINGLE_SELECT" },
            { id: "F_3", name: "Due Date", dataType: "DATE" },
          ],
        }),
      )

      const result = await h("project_v2.fields.list")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { id: "F_1", name: "Status", dataType: "SINGLE_SELECT" },
          { id: "F_2", name: "Priority", dataType: "SINGLE_SELECT" },
          { id: "F_3", name: "Due Date", dataType: "DATE" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("project_v2.fields.list")
    })

    it("verifies call includes correct args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ fields: [] }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.fields.list")(
        runner,
        {
          projectNumber: 42,
          owner: "testorg",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "field-list",
          "42",
          "--owner",
          "testorg",
          "--format",
          "json",
        ]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "failed to fetch fields")

      const result = await h("project_v2.fields.list")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("project_v2.items.list", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          items: [
            {
              id: "I_1",
              content: { type: "ISSUE", number: 42, title: "Fix bug" },
            },
            {
              id: "I_2",
              content: { type: "PULL_REQUEST", number: 12, title: "Add feature" },
            },
            {
              id: "I_3",
              content: { type: "DRAFT_ISSUE", number: 0, title: "Draft item" },
            },
          ],
        }),
      )

      const result = await h("project_v2.items.list")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          first: 30,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { id: "I_1", contentType: "ISSUE", contentNumber: 42, contentTitle: "Fix bug" },
          {
            id: "I_2",
            contentType: "PULL_REQUEST",
            contentNumber: 12,
            contentTitle: "Add feature",
          },
          { id: "I_3", contentType: "DRAFT_ISSUE", contentNumber: 0, contentTitle: "Draft item" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("project_v2.items.list")
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ items: [] }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.items.list")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          first: 50,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "item-list",
          "1",
          "--owner",
          "myorg",
          "--format",
          "json",
          "--limit",
          "50",
        ]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "failed to fetch items")

      const result = await h("project_v2.items.list")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          first: 30,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("project_v2.item.add_issue", () => {
    it("returns success with added item", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "PVT_I_1",
          title: "Issue added to project",
        }),
      )

      const result = await h("project_v2.item.add_issue")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          issueUrl: "https://github.com/myorg/repo/issues/42",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        itemId: "PVT_I_1",
        added: true,
      })
      expect(result.meta.capability_id).toBe("project_v2.item.add_issue")
    })

    it("verifies call includes correct args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ id: "PVT_I_1" }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.item.add_issue")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          issueUrl: "https://github.com/myorg/repo/issues/42",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "item-add",
          "1",
          "--owner",
          "myorg",
          "--url",
          "https://github.com/myorg/repo/issues/42",
          "--format",
          "json",
        ]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "issue not found")

      const result = await h("project_v2.item.add_issue")(
        runner,
        {
          projectNumber: 1,
          owner: "myorg",
          issueUrl: "https://github.com/myorg/repo/issues/99",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("project_v2.item.field.update", () => {
    it("returns success with valueText", async () => {
      const runner = mockRunner(0, JSON.stringify({}))

      const result = await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_1",
          valueText: "In Progress",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        itemId: "PVT_I_1",
        updated: true,
      })
      expect(result.meta.capability_id).toBe("project_v2.item.field.update")
    })

    it("includes valueText in args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_1",
          valueText: "In Progress",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "item-edit",
          "--project-id",
          "PVT_1",
          "--id",
          "PVT_I_1",
          "--field-id",
          "F_1",
          "--text",
          "In Progress",
        ]),
        expect.any(Number),
      )
    })

    it("returns success with valueNumber", async () => {
      const runner = mockRunner(0, JSON.stringify({}))

      const result = await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_2",
          valueNumber: 5,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        itemId: "PVT_I_1",
        updated: true,
      })
    })

    it("includes valueNumber in args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_2",
          valueNumber: 42,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "item-edit",
          "--project-id",
          "PVT_1",
          "--id",
          "PVT_I_1",
          "--field-id",
          "F_2",
          "--number",
          "42",
        ]),
        expect.any(Number),
      )
    })

    it("returns success with clear=true", async () => {
      const runner = mockRunner(0, JSON.stringify({}))

      const result = await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_3",
          clear: true,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        itemId: "PVT_I_1",
        updated: true,
      })
    })

    it("includes clear flag in args", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_3",
          clear: true,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "project",
          "item-edit",
          "--project-id",
          "PVT_1",
          "--id",
          "PVT_I_1",
          "--field-id",
          "F_3",
          "--clear",
        ]),
        expect.any(Number),
      )
    })

    it("returns error when no field value provided", async () => {
      const runner = mockRunner(0, JSON.stringify({}))

      const result = await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_1",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Missing field value update")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "failed to update field")

      const result = await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_1",
          valueText: "Updated",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("prioritizes valueText over valueNumber", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "{}",
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("project_v2.item.field.update")(
        runner,
        {
          projectId: "PVT_1",
          itemId: "PVT_I_1",
          fieldId: "F_1",
          valueText: "High",
          valueNumber: 999,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--text", "High"]),
        expect.any(Number),
      )
    })
  })
})
