import { parse as parseYaml } from "yaml"
import type { EvalConfig } from "./schema.js"
import { EvalConfigSchema } from "./schema.js"

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...raw }

  const repetitions = process.env["PROFILER_REPETITIONS"]
  if (repetitions !== undefined) {
    result["execution"] = {
      ...((result["execution"] as Record<string, unknown>) ?? {}),
      repetitions: Number(repetitions),
    }
  }

  const warmup = process.env["PROFILER_WARMUP"]
  if (warmup !== undefined) {
    result["execution"] = {
      ...((result["execution"] as Record<string, unknown>) ?? {}),
      warmup: warmup === "true",
    }
  }

  const logLevel = process.env["PROFILER_LOG_LEVEL"]
  if (logLevel !== undefined) {
    result["output"] = {
      ...((result["output"] as Record<string, unknown>) ?? {}),
      log_level: logLevel,
    }
  }

  const modes = process.env["PROFILER_MODES"]
  if (modes !== undefined) {
    result["modes"] = modes.split(",").map((s) => s.trim())
  }

  const providerPort = process.env["EVAL_PROVIDER_PORT"]
  if (providerPort !== undefined) {
    result["provider"] = {
      ...((result["provider"] as Record<string, unknown>) ?? {}),
      port: Number(providerPort),
    }
  }

  const providerId = process.env["EVAL_PROVIDER_ID"]
  if (providerId !== undefined) {
    result["provider"] = {
      ...((result["provider"] as Record<string, unknown>) ?? {}),
      id: providerId,
    }
  }

  const model = process.env["EVAL_MODEL"]
  if (model !== undefined) {
    result["models"] = [{ id: model, label: model }]
  }

  return result
}

export function loadEvalConfig(yamlContent: string): EvalConfig {
  const raw = parseYaml(yamlContent) as Record<string, unknown>
  const withEnv = applyEnvOverrides(raw)
  return EvalConfigSchema.parse(withEnv)
}
