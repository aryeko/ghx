export interface BaseScenario {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly prompt: string
  readonly timeoutMs: number
  readonly allowedRetries: number
  readonly tags: readonly string[]
  readonly extensions: Readonly<Record<string, unknown>>
}
