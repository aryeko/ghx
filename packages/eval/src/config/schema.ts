import { z } from "zod"

const ModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

const ProviderBaseSchema = z.object({
  id: z.string().default("opencode"),
  port: z.number().int().positive().default(3001),
})

const ProviderSchema = ProviderBaseSchema.default(ProviderBaseSchema.parse({}))

const ScenariosBaseSchema = z.object({
  set: z.string().optional(),
  ids: z.array(z.string()).optional(),
})

const ScenariosSchema = ScenariosBaseSchema.default(ScenariosBaseSchema.parse({}))

const ExecutionBaseSchema = z.object({
  repetitions: z.number().int().positive().default(5),
  warmup: z.boolean().default(true),
  timeout_default_ms: z.number().int().positive().default(120_000),
})

const ExecutionSchema = ExecutionBaseSchema.default(ExecutionBaseSchema.parse({}))

const OutputBaseSchema = z.object({
  results_dir: z.string().default("results"),
  reports_dir: z.string().default("reports"),
  session_export: z.boolean().default(true),
  log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

const OutputSchema = OutputBaseSchema.default(OutputBaseSchema.parse({}))

const FixturesBaseSchema = z.object({
  repo: z.string().default(""),
  manifest: z.string().default("fixtures/latest.json"),
  seed_if_missing: z.boolean().default(false),
  reseed_between_modes: z.boolean().default(false),
})

const FixturesSchema = FixturesBaseSchema.default(FixturesBaseSchema.parse({}))

export const EvalConfigSchema = z.object({
  modes: z.array(z.string()).min(1),
  scenarios: ScenariosSchema,
  execution: ExecutionSchema,
  output: OutputSchema,
  provider: ProviderSchema,
  models: z.array(ModelSchema).min(1),
  fixtures: FixturesSchema,
})

export type EvalConfig = z.infer<typeof EvalConfigSchema>
export type EvalModel = z.infer<typeof ModelSchema>
