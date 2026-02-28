import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mintFixtureAppToken } from "./app-auth.js"
import {
  type FixtureManifest,
  type FixtureResource,
  loadFixtureManifest,
  writeFixtureManifest,
} from "./manifest.js"
import { getSeeder, hasSeeder } from "./seeders/index.js"

const execFileAsync = promisify(execFile)

export interface FixtureManagerOptions {
  /** GitHub repo containing fixture resources in `"owner/repo"` format. */
  readonly repo: string
  /** Path to the fixture manifest JSON file (absolute or relative to CWD). */
  readonly manifest: string
  /** When `true`, auto-seed fixtures if the manifest file is not found. */
  readonly seedIfMissing?: boolean
  /** Identifier written into the manifest's `seedId` field. Defaults to `"default"`. */
  readonly seedId?: string
}

export interface FixtureStatus {
  readonly ok: readonly string[]
  readonly missing: readonly string[]
}

/**
 * Manages the lifecycle of GitHub fixture resources used by eval scenarios.
 *
 * Fixtures are PRs and issues in a dedicated GitHub repo with a known initial
 * state, tracked via a manifest file. The manager can check status, reset
 * branches to their original SHAs between iterations, and clean up resources
 * after a run.
 *
 * @example
 * ```typescript
 * import { FixtureManager } from "@ghx-dev/eval"
 *
 * const manager = new FixtureManager({
 *   repo: "owner/ghx-bench-fixtures",
 *   manifest: "fixtures/latest.json",
 * })
 * const { ok, missing } = await manager.status()
 * if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`)
 * ```
 */
export class FixtureManager {
  constructor(private readonly options: FixtureManagerOptions) {}

  async status(): Promise<FixtureStatus> {
    let manifest: FixtureManifest
    try {
      manifest = await loadFixtureManifest(this.options.manifest)
    } catch {
      return { ok: [], missing: [] }
    }

    const ok: string[] = []
    const missing: string[] = []

    for (const [fixtureType, resource] of Object.entries(manifest.fixtures)) {
      const exists = await this.checkResourceExists(resource)
      if (exists) {
        ok.push(fixtureType)
      } else {
        missing.push(fixtureType)
      }
    }

    return { ok, missing }
  }

  async reset(requires: readonly string[]): Promise<void> {
    const manifest = await loadFixtureManifest(this.options.manifest)

    for (const fixtureType of requires) {
      const resource = manifest.fixtures[fixtureType]
      if (!resource) {
        throw new Error(`Fixture type "${fixtureType}" not found in manifest`)
      }
      await this.resetFixture(resource)
    }
  }

  /**
   * Seeds all unique fixture names required by the given scenarios, writes a
   * new manifest file, and returns the manifest.
   *
   * The seeder type is resolved from the fixture name prefix (e.g. `pr_*` → `pr`).
   *
   * @param scenarios - Array of objects with optional `fixture.requires` arrays
   */
  async seed(
    scenarios: ReadonlyArray<{
      fixture?: {
        requires: readonly string[]
        repo?: string
        bindings?: Record<string, string>
        reseedPerIteration?: boolean
      }
    }>,
  ): Promise<void> {
    const uniqueNames = [...new Set(scenarios.flatMap((s) => s.fixture?.requires ?? []))]

    const fixtures: Record<string, FixtureResource> = {}
    for (const fixtureName of uniqueNames) {
      const resource = await this.seedOne(fixtureName)
      fixtures[fixtureName] = resource
    }

    const manifest: FixtureManifest = {
      seedId: this.options.seedId ?? "default",
      createdAt: new Date().toISOString(),
      repo: this.options.repo,
      fixtures,
    }

    await writeFixtureManifest(this.options.manifest, manifest)
  }

  /**
   * Seeds a single fixture by name and returns the created {@link FixtureResource}.
   *
   * The seeder type is resolved from the fixture name prefix (e.g. `pr_*` → `pr`,
   * `issue_*` → `issue`).
   *
   * Unlike {@link seed}, this method does **not** update the manifest file — it is
   * intended for ephemeral per-iteration fixtures where the resource is used once
   * and cleaned up automatically via the `@ghx-dev/eval` label.
   *
   * @param fixtureName - Fixture key name, e.g. `"pr_with_changes"`
   */
  async seedOne(fixtureName: string): Promise<FixtureResource> {
    // Prefer a seeder registered under the full fixture name (e.g. "pr_with_mixed_threads"),
    // falling back to the name prefix (e.g. "pr" for "pr_with_changes").
    const type = hasSeeder(fixtureName) ? fixtureName : (fixtureName.split("_")[0] ?? "pr")
    const seeder = getSeeder(type)
    const botToken = await mintFixtureAppToken()
    await this.ensureLabel(this.options.repo, "@ghx-dev/eval")
    return seeder.seed({
      repo: this.options.repo,
      name: fixtureName,
      labels: ["@ghx-dev/eval"],
      ...(botToken !== null ? { botToken } : {}),
    })
  }

  /** Creates the label on GitHub if it does not already exist (idempotent via --force). */
  private async ensureLabel(repo: string, label: string): Promise<void> {
    await this.runGh(["label", "create", label, "--repo", repo, "--force"])
  }

  /**
   * Closes a single fixture resource (PR or issue) on GitHub.
   *
   * Used by eval hooks to clean up per-iteration seeded fixtures after each
   * scenario iteration completes.
   */
  async closeResource(resource: FixtureResource): Promise<void> {
    const command = resource.type === "pr" ? "pr" : "issue"
    await this.runGh([command, "close", String(resource.number), "--repo", resource.repo])
  }

  async cleanup(options?: { all?: boolean }): Promise<void> {
    const parts = this.options.repo.split("/")
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repo format: ${this.options.repo}`)
    }

    if (options?.all) {
      const prs = await this.listLabeledResources("pr", "@ghx-dev/eval")
      const issues = await this.listLabeledResources("issue", "@ghx-dev/eval")

      for (const pr of prs) {
        await this.runGh(["pr", "close", String(pr), "--repo", this.options.repo])
      }
      for (const issue of issues) {
        await this.runGh(["issue", "close", String(issue), "--repo", this.options.repo])
      }
    } else {
      const manifest = await loadFixtureManifest(this.options.manifest)
      for (const resource of Object.values(manifest.fixtures)) {
        if (resource.type === "pr") {
          await this.runGh(["pr", "close", String(resource.number), "--repo", resource.repo])
        } else {
          await this.runGh(["issue", "close", String(resource.number), "--repo", resource.repo])
        }
      }
    }
  }

  private async checkResourceExists(resource: FixtureResource): Promise<boolean> {
    try {
      if (resource.type === "pr") {
        await this.runGh([
          "pr",
          "view",
          String(resource.number),
          "--repo",
          resource.repo,
          "--json",
          "number",
        ])
      } else {
        await this.runGh([
          "issue",
          "view",
          String(resource.number),
          "--repo",
          resource.repo,
          "--json",
          "number",
        ])
      }
      return true
    } catch {
      return false
    }
  }

  private async resetFixture(resource: FixtureResource): Promise<void> {
    const branch = resource.branch
    if (!branch) return

    const repoParts = resource.repo.split("/")
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) return

    const originalSha = resource.metadata["originalSha"]
    if (typeof originalSha !== "string" || !originalSha) return

    // Force-push with retry (up to 3 attempts, 1s delay between retries)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.runGh([
          "api",
          `repos/${resource.repo}/git/refs/heads/${branch}`,
          "--method",
          "PATCH",
          "--field",
          `sha=${originalSha}`,
          "--field",
          "force=true",
        ])
        break
      } catch (error) {
        if (attempt === 3) throw error
        await sleep(1000)
      }
    }

    // Poll to verify the force-push took effect (up to 5 polls, 500ms apart)
    for (let poll = 0; poll < 5; poll++) {
      await sleep(500)
      const refData = await this.runGh(["api", `repos/${resource.repo}/git/refs/heads/${branch}`])
      const parsed = JSON.parse(refData) as { object?: { sha?: string } }
      if (parsed.object?.sha === originalSha) {
        return
      }
    }

    throw new Error(`Fixture reset for branch "${branch}" could not be verified after polling`)
  }

  private async listLabeledResources(
    resourceType: "pr" | "issue",
    label: string,
  ): Promise<number[]> {
    try {
      const output = await this.runGh([
        resourceType === "pr" ? "pr" : "issue",
        "list",
        "--label",
        label,
        "--repo",
        this.options.repo,
        "--json",
        "number",
        "--limit",
        "100",
      ])
      const parsed = JSON.parse(output) as Array<{ number: number }>
      return parsed.map((r) => r.number)
    } catch {
      return []
    }
  }

  private async runGh(args: readonly string[]): Promise<string> {
    const { stdout } = await execFileAsync("gh", args as string[])
    return stdout.trim()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
