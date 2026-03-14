import { getSeeder, hasSeeder, registerSeeder } from "@eval/fixture/seeders/index.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"
import { describe, expect, it } from "vitest"

function createFakeSeeder(type: string): FixtureSeeder {
  return {
    type,
    seed: async (options: SeedOptions) => ({
      type,
      number: 1,
      repo: options.repo,
      metadata: {},
    }),
  }
}

describe("fixture seeder registry", () => {
  it("round-trips registerSeeder + getSeeder", () => {
    const seeder = createFakeSeeder("pr")
    registerSeeder(seeder)

    const retrieved = getSeeder("pr")
    expect(retrieved).toBe(seeder)
  })

  it("throws for unregistered type", () => {
    expect(() => getSeeder("nonexistent")).toThrow('No seeder registered for type "nonexistent"')
  })

  it("registers and retrieves multiple seeders independently", () => {
    const issueSeeder = createFakeSeeder("issue")
    const discussionSeeder = createFakeSeeder("discussion")

    registerSeeder(issueSeeder)
    registerSeeder(discussionSeeder)

    expect(getSeeder("issue")).toBe(issueSeeder)
    expect(getSeeder("discussion")).toBe(discussionSeeder)
  })

  it("auto-registers issue_for_triage seeder", () => {
    expect(hasSeeder("issue_for_triage")).toBe(true)
    expect(getSeeder("issue_for_triage").type).toBe("issue_for_triage")
  })

  it("auto-registers issue_bug_to_close seeder", () => {
    expect(hasSeeder("issue_bug_to_close")).toBe(true)
    expect(getSeeder("issue_bug_to_close").type).toBe("issue_bug_to_close")
  })

  it("auto-registers issue_with_branch seeder", () => {
    expect(hasSeeder("issue_with_branch")).toBe(true)
    expect(getSeeder("issue_with_branch").type).toBe("issue_with_branch")
  })
})
