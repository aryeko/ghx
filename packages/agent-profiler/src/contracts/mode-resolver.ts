export interface ModeConfig {
  readonly environment: Readonly<Record<string, string>>
  readonly systemInstructions: string
  readonly providerOverrides: Readonly<Record<string, unknown>>
}

export interface ModeResolver {
  resolve(mode: string): Promise<ModeConfig>
}
