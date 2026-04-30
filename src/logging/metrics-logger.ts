import { logger, type LogEntry } from "./logger.js"

export interface Metrics {
  totalQueries: number
  totalSignalChars: number
  totalBaselineChars: number
  signalQueries: number
  baselineQueries: number
  averageSignalCharsPerQuery: number
  averageBaselineCharsPerQuery: number
  storageReductionPercent: number
  breakEvenQueries: number
}

export interface QueryMetrics {
  query: string
  mode: "baseline" | "signals"
  charsRead: number
  resultsReturned: number
  sourceReadAfterSignal: boolean
  durationMs: number
}

export class MetricsLogger {
  private queryLogs: QueryMetrics[] = []
  private baselineCharsTotal: number = 0
  private signalCharsTotal: number = 0

  logQuery(metrics: QueryMetrics): void {
    this.queryLogs.push(metrics)

    if (metrics.mode === "baseline") {
      this.baselineCharsTotal += metrics.charsRead
    } else {
      this.signalCharsTotal += metrics.charsRead
    }

    logger.logSignal({
      query: metrics.query,
      tool: "signals_search",
      charsRead: metrics.charsRead,
      resultsReturned: metrics.resultsReturned,
      sourceReadAfterSignal: metrics.sourceReadAfterSignal,
      durationMs: metrics.durationMs,
      action: "query_executed",
    })
  }

  logIndexing(durationMs: number, filesScanned: number, signalsCreated: number, rawSourceChars: number, signalChars: number): void {
    logger.info("indexing_completed", {
      durationMs,
      filesScanned,
      signalsCreated,
      rawSourceChars,
      signalChars,
      storageReductionPercent: rawSourceChars > 0
        ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
        : 0,
    })
  }

  getMetrics(): Metrics {
    const signalQueries = this.queryLogs.filter(q => q.mode === "signals").length
    const baselineQueries = this.queryLogs.filter(q => q.mode === "baseline").length
    const totalQueries = this.queryLogs.length

    const averageSignalCharsPerQuery = signalQueries > 0
      ? Math.round(this.signalCharsTotal / signalQueries)
      : 0

    const averageBaselineCharsPerQuery = baselineQueries > 0
      ? Math.round(this.baselineCharsTotal / baselineQueries)
      : 0

    const storageReductionPercent = this.baselineCharsTotal > 0
      ? Math.round(((this.baselineCharsTotal - this.signalCharsTotal) / this.baselineCharsTotal) * 100)
      : 0

    const averageSavingsPerQuery = averageBaselineCharsPerQuery - averageSignalCharsPerQuery
    const indexingChars = 12000
    const breakEvenQueries = averageSavingsPerQuery > 0
      ? Math.ceil(indexingChars / averageSavingsPerQuery)
      : 0

    return {
      totalQueries,
      totalSignalChars: this.signalCharsTotal,
      totalBaselineChars: this.baselineCharsTotal,
      signalQueries,
      baselineQueries,
      averageSignalCharsPerQuery,
      averageBaselineCharsPerQuery,
      storageReductionPercent,
      breakEvenQueries,
    }
  }

  getQueryLogs(): QueryMetrics[] {
    return [...this.queryLogs]
  }

  clear(): void {
    this.queryLogs = []
    this.baselineCharsTotal = 0
    this.signalCharsTotal = 0
  }

  getLogs(): LogEntry[] {
    return logger.getLogs()
  }
}

export const metricsLogger = new MetricsLogger()

export function logQuery(metrics: QueryMetrics): void {
  metricsLogger.logQuery(metrics)
}

export function logIndexing(durationMs: number, filesScanned: number, signalsCreated: number, rawSourceChars: number, signalChars: number): void {
  metricsLogger.logIndexing(durationMs, filesScanned, signalsCreated, rawSourceChars, signalChars)
}

export function getMetrics(): Metrics {
  return metricsLogger.getMetrics()
}