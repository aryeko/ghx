import { z } from "zod"

export const commandSchema = z.object({
  command: z.array(z.string().min(1)).min(1),
  env: z.record(z.string(), z.string()).optional(),
})

export const benchmarkBaseSchema = z.object({
  command: z.array(z.string().min(1)).min(1),
  repetitions: z.number().int().positive(),
  scenarioSet: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export const benchmarkVariantSchema = z.object({
  mode: z.enum(["ghx", "agent_direct"]),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export const suiteRunnerConfigSchema = z.object({
  fixtures: z
    .object({
      setup: z
        .object({
          cleanup: commandSchema.optional(),
          seed: commandSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  benchmark: z.object({
    base: benchmarkBaseSchema,
    ghx: benchmarkVariantSchema,
    direct: benchmarkVariantSchema,
  }),
  reporting: z.object({
    analysis: z.object({
      report: commandSchema,
      gate: commandSchema.optional(),
    }),
  }),
  cwd: z.string().min(1).optional(),
})

export type CommandConfig = z.infer<typeof commandSchema>
export type BenchmarkBaseConfig = z.infer<typeof benchmarkBaseSchema>
export type BenchmarkVariantConfig = z.infer<typeof benchmarkVariantSchema>
export type SuiteRunnerConfig = z.infer<typeof suiteRunnerConfigSchema>
