export type LogLevel = "debug" | "info" | "warn" | "error"

export interface Logger {
  debug(message: string, ...args: readonly unknown[]): void
  info(message: string, ...args: readonly unknown[]): void
  warn(message: string, ...args: readonly unknown[]): void
  error(message: string, ...args: readonly unknown[]): void
}

const LEVEL_ORDER: readonly LogLevel[] = ["debug", "info", "warn", "error"]

export function createLogger(level: LogLevel): Logger {
  const minLevel = LEVEL_ORDER.indexOf(level)

  function shouldLog(msgLevel: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(msgLevel) >= minLevel
  }

  return {
    debug(message: string, ...args: readonly unknown[]) {
      if (shouldLog("debug")) console.debug(`[DEBUG] ${message}`, ...args)
    },
    info(message: string, ...args: readonly unknown[]) {
      if (shouldLog("info")) console.info(`[INFO] ${message}`, ...args)
    },
    warn(message: string, ...args: readonly unknown[]) {
      if (shouldLog("warn")) console.warn(`[WARN] ${message}`, ...args)
    },
    error(message: string, ...args: readonly unknown[]) {
      if (shouldLog("error")) console.error(`[ERROR] ${message}`, ...args)
    },
  }
}
