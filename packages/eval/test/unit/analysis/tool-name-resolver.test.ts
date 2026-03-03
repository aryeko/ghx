import { resolveEvalToolName } from "@eval/analysis/tool-name-resolver.js"
import { describe, expect, it } from "vitest"

describe("resolveEvalToolName", () => {
  it("returns raw name for non-bash tools", () => {
    expect(resolveEvalToolName("read_file", "f.ts")).toBe("read_file")
    expect(resolveEvalToolName("write_file", { path: "f.ts" })).toBe("write_file")
    expect(resolveEvalToolName("github_create_issue", { title: "bug" })).toBe("github_create_issue")
  })

  it("extracts ghx capability from ghx run commands", () => {
    expect(resolveEvalToolName("bash", { command: "ghx run pr-review-submit --input '{}'" })).toBe(
      "ghx:pr-review-submit",
    )
    expect(resolveEvalToolName("bash", { command: "ghx run issue-close" })).toBe("ghx:issue-close")
    expect(resolveEvalToolName("bash", "ghx run pr-list")).toBe("ghx:pr-list")
  })

  it("falls back to generic enrichment for gh commands", () => {
    expect(resolveEvalToolName("bash", { command: "gh api /repos/owner/repo/pulls" })).toBe(
      "gh api",
    )
    expect(resolveEvalToolName("bash", { command: "gh pr list" })).toBe("gh pr")
    expect(resolveEvalToolName("bash", { command: "gh issue create --title bug" })).toBe("gh issue")
  })

  it("falls back to generic enrichment for git commands", () => {
    expect(resolveEvalToolName("bash", { command: "git push origin main" })).toBe("git push")
    expect(resolveEvalToolName("bash", { command: "git commit -m 'msg'" })).toBe("git commit")
  })

  it("falls back to generic enrichment for other programs", () => {
    expect(resolveEvalToolName("bash", { command: "curl https://example.com" })).toBe("curl")
    expect(resolveEvalToolName("bash", { command: "npm test" })).toBe("npm test")
  })

  it("returns raw name when input is null/undefined", () => {
    expect(resolveEvalToolName("bash", null)).toBe("bash")
    expect(resolveEvalToolName("bash", undefined)).toBe("bash")
  })

  it("returns raw name when command is empty", () => {
    expect(resolveEvalToolName("bash", { command: "" })).toBe("bash")
    expect(resolveEvalToolName("bash", "")).toBe("bash")
  })

  it("handles ghx run with env vars prefix", () => {
    expect(resolveEvalToolName("bash", "GH_TOKEN=xxx ghx run pr-review-submit")).toBe(
      "ghx:pr-review-submit",
    )
  })
})
