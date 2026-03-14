import type { Mock } from "vitest"

/**
 * Configures a mocked `execFile` to return sequential results.
 * Each call to the mock returns the next result in the array.
 */
export function mockExecFileResults(
  mockedExecFile: Mock,
  results: readonly { readonly stdout: string; readonly stderr: string }[],
): void {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      error: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error(`Unexpected call #${callIndex}`), "", "")
      return
    }
    callback(null, result.stdout, result.stderr)
  })
}
