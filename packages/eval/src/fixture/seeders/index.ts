import { createBugIssueSeeder } from "./bug-issue-seeder.js"
import { createIssueBranchSeeder } from "./issue-branch-seeder.js"
import { createIssueSeeder } from "./issue-seeder.js"
import { createMixedThreadsSeeder } from "./mixed-threads-seeder.js"
import { createPrSeeder } from "./pr-seeder.js"
import { createTriageIssueSeeder } from "./triage-issue-seeder.js"
import type { FixtureSeeder } from "./types.js"

const registry = new Map<string, FixtureSeeder>()

export function registerSeeder(seeder: FixtureSeeder): void {
  registry.set(seeder.type, seeder)
}

export function hasSeeder(type: string): boolean {
  return registry.has(type)
}

export function getSeeder(type: string): FixtureSeeder {
  const seeder = registry.get(type)
  if (!seeder) {
    throw new Error(`No seeder registered for type "${type}"`)
  }
  return seeder
}

// Auto-register built-in seeders
registerSeeder(createPrSeeder())
registerSeeder(createIssueSeeder())
registerSeeder(createTriageIssueSeeder())
registerSeeder(createBugIssueSeeder())
registerSeeder(createIssueBranchSeeder())
registerSeeder(createMixedThreadsSeeder())

export type { FixtureSeeder, SeedOptions } from "./types.js"
