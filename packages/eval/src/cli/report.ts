function parseFlag(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1 || idx + 1 >= argv.length) return null
  return argv[idx + 1] ?? null
}

export async function report(argv: readonly string[]): Promise<void> {
  // TODO: Wire to agent-profiler generateReport() when available
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  console.log(`eval report: run-dir=${runDir} (not yet implemented — agent-profiler pending)`)
}
