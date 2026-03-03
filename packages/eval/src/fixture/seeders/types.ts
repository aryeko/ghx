import type { FixtureResource } from "@eval/fixture/manifest.js"

/** Options passed to a seeder when creating a fixture resource. */
export interface SeedOptions {
  /** Target repo in "owner/repo" format. */
  readonly repo: string
  /** Fixture name (key in the manifest), e.g. "pr_with_mixed_threads". */
  readonly name: string
  /** Labels to apply to the created resource. */
  readonly labels: readonly string[]
  /**
   * Optional GitHub token for a secondary identity (e.g. a bot account).
   * Seeders use this for operations that must come from a different user,
   * such as opening a PR as the bot so the main agent can request changes on it,
   * or posting review comments as the bot.
   */
  readonly botToken?: string
}

/** Creates a specific type of GitHub fixture resource. */
export interface FixtureSeeder {
  /** Resource type this seeder handles, e.g. "pr" or "issue". */
  readonly type: string
  /** Create a fixture resource and return its manifest entry. */
  seed(options: SeedOptions): Promise<FixtureResource>
}
