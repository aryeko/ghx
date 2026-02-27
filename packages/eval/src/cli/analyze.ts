function parseFlag(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1 || idx + 1 >= argv.length) return null
  return argv[idx + 1] ?? null
}

export async function analyze(argv: readonly string[]): Promise<void> {
  // TODO: Wire to agent-profiler analyze pipeline when available
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  console.log(`eval analyze: run-dir=${runDir} (not yet implemented — agent-profiler pending)`)
}
