import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { AnalysisFinding, SessionAnalysisBundle } from "@profiler/types/trace.js"
import type { ScenarioMetadata } from "./report-page.js"

const ANALYZER_ORDER: readonly string[] = [
  "efficiency",
  "tool-pattern",
  "strategy",
  "reasoning",
  "error",
]

const ANALYZER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  efficiency: "Efficiency",
  "tool-pattern": "Tool Patterns",
  strategy: "Strategy",
  reasoning: "Reasoning",
  error: "Errors",
}

const ZERO_VALUES = new Set(["0", "0%", "0.0%", "0 tok", "-", ""])

function isDifferentiating(values: ReadonlyMap<string, string>, modes: readonly string[]): boolean {
  const vals = modes.map((m) => values.get(m) ?? "-")
  const allSame = vals.every((v) => v === vals[0])
  const allZero = vals.every((v) => ZERO_VALUES.has(v))
  return !allSame && !allZero
}

function formatScalar(finding: AnalysisFinding): string {
  switch (finding.type) {
    case "number": {
      const rounded =
        finding.value >= 10 ? Math.round(finding.value) : Number(finding.value.toFixed(1))
      return `${rounded} ${finding.unit}`
    }
    case "ratio":
      return `${(finding.value * 100).toFixed(1)}%`
    case "string":
      return finding.value
    default:
      return ""
  }
}

function aggregateScalarByMode(
  bundles: readonly SessionAnalysisBundle[],
  analyzer: string,
  findingKey: string,
  modes: readonly string[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>()

  for (const mode of modes) {
    const modeBundles = bundles.filter((b) => b.mode === mode)
    const findings: AnalysisFinding[] = []

    for (const bundle of modeBundles) {
      const analyzerResult = bundle.results[analyzer]
      if (!analyzerResult) continue
      const finding = analyzerResult.findings[findingKey]
      if (finding) findings.push(finding)
    }

    if (findings.length === 0) {
      result.set(mode, "-")
      continue
    }

    const first = findings[0]
    if (!first) {
      result.set(mode, "-")
      continue
    }

    if (first.type === "number" || first.type === "ratio") {
      const values = findings.map((f) => (f.type === "number" || f.type === "ratio" ? f.value : 0))
      const stats = computeDescriptive(values)
      const medianFinding: AnalysisFinding =
        first.type === "ratio"
          ? { type: "ratio", value: stats.median, label: first.label }
          : { type: "number", value: stats.median, unit: first.unit }
      result.set(mode, formatScalar(medianFinding))
    } else if (first.type === "string") {
      const counts = new Map<string, number>()
      for (const f of findings) {
        if (f.type === "string") {
          counts.set(f.value, (counts.get(f.value) ?? 0) + 1)
        }
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
      const top = sorted[0]
      result.set(mode, top ? top[0] : "-")
    } else {
      result.set(mode, "-")
    }
  }

  return result
}

function aggregateListByMode(
  bundles: readonly SessionAnalysisBundle[],
  analyzer: string,
  findingKey: string,
  modes: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, readonly string[]>()

  for (const mode of modes) {
    const modeBundles = bundles.filter((b) => b.mode === mode)
    const merged = new Set<string>()

    for (const bundle of modeBundles) {
      const analyzerResult = bundle.results[analyzer]
      if (!analyzerResult) continue
      const finding = analyzerResult.findings[findingKey]
      if (finding?.type === "list") {
        for (const v of finding.values) {
          merged.add(v)
        }
      }
    }

    result.set(mode, [...merged])
  }

  return result
}

function aggregateTableByMode(
  bundles: readonly SessionAnalysisBundle[],
  analyzer: string,
  findingKey: string,
  modes: readonly string[],
): ReadonlyMap<
  string,
  { readonly headers: readonly string[]; readonly rows: readonly string[][] }
> {
  const result = new Map<
    string,
    { readonly headers: readonly string[]; readonly rows: readonly string[][] }
  >()

  for (const mode of modes) {
    const modeBundles = bundles.filter((b) => b.mode === mode)
    let headers: readonly string[] = []
    const allRows: string[][] = []
    const seenRows = new Set<string>()

    for (const bundle of modeBundles) {
      const analyzerResult = bundle.results[analyzer]
      if (!analyzerResult) continue
      const finding = analyzerResult.findings[findingKey]
      if (finding?.type === "table") {
        if (headers.length === 0) {
          headers = finding.headers
        }
        for (const row of finding.rows) {
          const key = row.join("|")
          if (!seenRows.has(key)) {
            seenRows.add(key)
            allRows.push([...row])
          }
        }
      }
    }

    result.set(mode, { headers, rows: allRows })
  }

  return result
}

function collectAnalyzerNames(bundles: readonly SessionAnalysisBundle[]): readonly string[] {
  const seen = new Set<string>()
  for (const bundle of bundles) {
    for (const name of Object.keys(bundle.results)) {
      seen.add(name)
    }
  }

  const ordered = ANALYZER_ORDER.filter((a) => seen.has(a))
  for (const name of seen) {
    if (!ordered.includes(name)) {
      ordered.push(name)
    }
  }
  return ordered
}

function collectFindingKeys(
  bundles: readonly SessionAnalysisBundle[],
  analyzer: string,
): readonly string[] {
  const seen = new Set<string>()
  for (const bundle of bundles) {
    const result = bundle.results[analyzer]
    if (!result) continue
    for (const key of Object.keys(result.findings)) {
      seen.add(key)
    }
  }
  return [...seen]
}

function getFindingType(
  bundles: readonly SessionAnalysisBundle[],
  analyzer: string,
  findingKey: string,
): AnalysisFinding["type"] | undefined {
  for (const bundle of bundles) {
    const result = bundle.results[analyzer]
    if (!result) continue
    const finding = result.findings[findingKey]
    if (finding) return finding.type
  }
  return undefined
}

function renderAnalyzerSection(
  analyzerName: string,
  scenarioBundles: readonly SessionAnalysisBundle[],
  modes: readonly string[],
): readonly string[] {
  const findingKeys = collectFindingKeys(scenarioBundles, analyzerName)
  if (findingKeys.length === 0) return []

  const displayName = ANALYZER_DISPLAY_NAMES[analyzerName] ?? analyzerName
  const lines: string[] = []

  const scalarRows: Array<{ key: string; values: ReadonlyMap<string, string> }> = []
  const listBlocks: Array<{ key: string; values: ReadonlyMap<string, readonly string[]> }> = []
  const tableBlocks: Array<{
    key: string
    values: ReadonlyMap<
      string,
      { readonly headers: readonly string[]; readonly rows: readonly string[][] }
    >
  }> = []

  for (const key of findingKeys) {
    const findingType = getFindingType(scenarioBundles, analyzerName, key)
    if (!findingType) continue

    if (findingType === "number" || findingType === "ratio" || findingType === "string") {
      const values = aggregateScalarByMode(scenarioBundles, analyzerName, key, modes)
      if (isDifferentiating(values, modes)) {
        scalarRows.push({ key, values })
      }
    } else if (findingType === "list") {
      const values = aggregateListByMode(scenarioBundles, analyzerName, key, modes)
      const hasContent = modes.some((m) => (values.get(m) ?? []).length > 0)
      if (hasContent) {
        listBlocks.push({ key, values })
      }
    } else if (findingType === "table") {
      const values = aggregateTableByMode(scenarioBundles, analyzerName, key, modes)
      const hasContent = modes.some((m) => (values.get(m)?.rows ?? []).length > 0)
      if (hasContent) {
        tableBlocks.push({ key, values })
      }
    }
  }

  if (scalarRows.length === 0 && listBlocks.length === 0 && tableBlocks.length === 0) {
    return []
  }

  lines.push(`### ${displayName}`, "")

  if (scalarRows.length > 0) {
    const header = ["| Metric", ...modes.map((m) => `| ${m}`), "|"].join(" ")
    const sep = ["| ---", ...modes.map(() => "| ---"), "|"].join(" ")
    lines.push(header, sep)

    for (const { key, values } of scalarRows) {
      const cells = modes.map((m) => `| ${values.get(m) ?? "-"}`)
      lines.push(`| ${key} ${cells.join(" ")} |`)
    }

    lines.push("")
  }

  for (const { key, values } of listBlocks) {
    lines.push("<details>", `<summary>${key}</summary>`, "")
    for (const mode of modes) {
      const items = (values.get(mode) ?? []).filter((item) => item.trim().length > 0)
      if (items.length > 0) {
        lines.push(`**${mode}:** ${items.join(", ")}`)
      }
    }
    lines.push("", "</details>", "")
  }

  for (const { key, values } of tableBlocks) {
    lines.push("<details>", `<summary>${key}</summary>`, "")
    for (const mode of modes) {
      const data = values.get(mode)
      if (!data || data.rows.length === 0) continue
      lines.push(`**${mode}:**`, "")
      lines.push(`| ${data.headers.join(" | ")} |`)
      lines.push(`| ${data.headers.map(() => "---").join(" | ")} |`)
      for (const row of data.rows) {
        lines.push(`| ${row.join(" | ")} |`)
      }
      lines.push("")
    }
    lines.push("</details>", "")
  }

  return lines
}

export function generateAnalysisPage(
  analysisResults: readonly SessionAnalysisBundle[],
  scenarioMetadata?: readonly ScenarioMetadata[],
): string {
  if (analysisResults.length === 0) {
    return ["# Session Analysis", "", "No session analysis data available."].join("\n")
  }

  const metadataMap = new Map((scenarioMetadata ?? []).map((s) => [s.id, s]))
  const scenarioIds = [...new Set(analysisResults.map((b) => b.scenarioId))]
  const allModes = [...new Set(analysisResults.map((b) => b.mode))]

  const lines: string[] = ["# Session Analysis", ""]

  for (const scenarioId of scenarioIds) {
    const scenarioBundles = analysisResults.filter((b) => b.scenarioId === scenarioId)
    const meta = metadataMap.get(scenarioId)

    lines.push(`## ${meta?.name ?? scenarioId}`, "")

    if (meta?.description) {
      lines.push(`> ${meta.description}`, "")
    }

    const modes = allModes.filter((m) => scenarioBundles.some((b) => b.mode === m))
    const analyzerNames = collectAnalyzerNames(scenarioBundles)

    let hasContent = false
    for (const analyzerName of analyzerNames) {
      const section = renderAnalyzerSection(analyzerName, scenarioBundles, modes)
      if (section.length > 0) {
        lines.push(...section)
        hasContent = true
      }
    }

    if (!hasContent) {
      lines.push("No notable differences across modes.", "")
    }
  }

  return lines.join("\n")
}
