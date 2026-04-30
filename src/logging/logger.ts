export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  timestamp: number
  level: LogLevel
  mode: "baseline" | "signals"
  query?: string
  tool?: string
  file?: string
  charsRead?: number
  fullFileRead?: boolean
  resultsReturned?: number
  signalCharsReturned?: number
  sourceReadAfterSignal?: boolean
  sourceCharsRead?: number
  readRange?: string
  durationMs?: number
  action: string
  details?: Record<string, unknown>
}

export interface LoggerConfig {
  level: LogLevel
  includeTimestamp: boolean
  includeMode: boolean
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: "info",
  includeTimestamp: true,
  includeMode: true,
}

export class Logger {
  private config: LoggerConfig
  private logs: LogEntry[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  debug(message: string, details?: Record<string, unknown>): void {
    this.log("debug", message, details)
  }

  info(message: string, details?: Record<string, unknown>): void {
    this.log("info", message, details)
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.log("warn", message, details)
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.log("error", message, details)
  }

  logBaseline(entry: Omit<LogEntry, "timestamp" | "level" | "mode">): void {
    this.logs.push({
      timestamp: Date.now(),
      level: "info",
      mode: "baseline",
      ...entry,
    })
  }

  logSignal(entry: Omit<LogEntry, "timestamp" | "level" | "mode">): void {
    this.logs.push({
      timestamp: Date.now(),
      level: "info",
      mode: "signals",
      ...entry,
    })
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }

  private log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
    if (this.shouldLog(level)) {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level,
        mode: "signals",
        action: message,
        details,
      }
      this.logs.push(entry)

      if (typeof process !== "undefined" && process.stderr) {
        const prefix = this.config.includeTimestamp
          ? `[${new Date(entry.timestamp).toISOString()}] `
          : ""
        const modePrefix = this.config.includeMode ? `[${entry.mode}] ` : ""
        console.error(`${prefix}${modePrefix}[${level.toUpperCase()}] ${message}`)
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"]
    const configLevel = levels.indexOf(this.config.level)
    const messageLevel = levels.indexOf(level)
    return messageLevel >= configLevel
  }
}

export const logger = new Logger()

export function logBaseline(entry: Omit<LogEntry, "timestamp" | "level" | "mode">): void {
  logger.logBaseline(entry)
}

export function logSignal(entry: Omit<LogEntry, "timestamp" | "level" | "mode">): void {
  logger.logSignal(entry)
}