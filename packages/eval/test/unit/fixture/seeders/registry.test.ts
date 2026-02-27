import { getSeeder, registerSeeder } from "@eval/fixture/seeders/index.js"
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
})
