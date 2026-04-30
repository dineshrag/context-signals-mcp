import type { BaselineResult } from "./baseline-runner.js"
import type { SignalsResult } from "./signals-runner.js"
import type { IndexingResult } from "./indexing-runner.js"

export type BenchmarkMetricsMode = "simulated" | "real"

export interface StorageMetrics {
  rawSourceChars: number
  signalChars: number
  reductionPercent: number
  success: boolean
}

export interface QueryContextMetrics {
  baselineAvg: number
  signalsAvg: number
  reductionPercent: number
  success: boolean
}

export interface FullFileReadsMetrics {
  baselineTotal: number
  signalsTotal: number
  reductionPercent: number
  success: boolean
}

export interface ToolCallsMetrics {
  baselineTotal: number
  signalsTotal: number
  reductionPercent: number
  success: boolean
}

export interface AccuracyMetrics {
  baselineAvg: number
  signalsAvg: number
  success: boolean
}

export interface RetrievalMetrics {
  top3HitRate: number
  success: boolean
}

export interface BreakEvenMetrics {
  indexingChars: number
  avgSavingsPerQuery: number
  breakEvenQueries: number
  success: boolean
}

export interface FullMetrics {
  storage: StorageMetrics
  queryContext: QueryContextMetrics
  fullFileReads: FullFileReadsMetrics
  toolCalls: ToolCallsMetrics
  accuracy: AccuracyMetrics
  retrieval: RetrievalMetrics
  breakEven: BreakEvenMetrics
}

export interface RealMetrics {
  storage: StorageMetrics
  queryContext: QueryContextMetrics
  toolCalls: ToolCallsMetrics
  accuracy: AccuracyMetrics
  retrieval: RetrievalMetrics
  breakEven: BreakEvenMetrics
}

export function calculateFullMetrics(
  baseline: BaselineResult,
  signals: SignalsResult,
  indexing: IndexingResult
): FullMetrics {
  const storageReduction = calculateReduction(indexing.rawSourceChars, indexing.signalChars)

  const baselineAvgTokens = baseline.totals.avgTokensPerQuery
  const signalsAvgTokens = signals.totals.avgTokensPerQuery
  const queryContextReduction = calculateReduction(baselineAvgTokens, signalsAvgTokens)

  const baselineFullReads = baseline.queries.reduce((sum, q) => sum + q.simulatedFullReads, 0)
  const signalsFullReads = signals.queries.reduce((sum, q) => sum + q.fullFileReads, 0)
  const fullReadReduction = calculateReduction(baselineFullReads, signalsFullReads)

  const baselineToolCalls = baseline.queries.reduce((sum, q) => sum + q.simulatedToolCalls, 0)
  const signalsSearchCalls = signals.queries.reduce((sum, q) => sum + q.searchCalls, 0)
  const toolCallReduction = calculateReduction(baselineToolCalls, signalsSearchCalls)

  const baselineAccuracy = baseline.totals.avgCorrectness
  const signalsAccuracy = signals.totals.avgCorrectness

  const top3HitRate = signals.totals.top3HitRate

  const avgSavingsPerQuery = baselineAvgTokens - signalsAvgTokens
  const breakEvenQueries = avgSavingsPerQuery > 0
    ? Math.ceil(indexing.rawSourceChars / avgSavingsPerQuery)
    : Infinity

  return {
    storage: {
      rawSourceChars: indexing.rawSourceChars,
      signalChars: indexing.signalChars,
      reductionPercent: storageReduction,
      success: indexing.signalChars < indexing.rawSourceChars,
    },
    queryContext: {
      baselineAvg: baselineAvgTokens,
      signalsAvg: signalsAvgTokens,
      reductionPercent: queryContextReduction,
      success: queryContextReduction >= 20,
    },
    fullFileReads: {
      baselineTotal: baselineFullReads,
      signalsTotal: signalsFullReads,
      reductionPercent: fullReadReduction,
      success: fullReadReduction > 0,
    },
    toolCalls: {
      baselineTotal: baselineToolCalls,
      signalsTotal: signalsSearchCalls,
      reductionPercent: toolCallReduction,
      success: toolCallReduction > 0,
    },
    accuracy: {
      baselineAvg: baselineAccuracy,
      signalsAvg: signalsAccuracy,
      success: signalsAccuracy >= baselineAccuracy - 0.3,
    },
    retrieval: {
      top3HitRate,
      success: top3HitRate >= 70,
    },
    breakEven: {
      indexingChars: indexing.rawSourceChars,
      avgSavingsPerQuery,
      breakEvenQueries: isFinite(breakEvenQueries) ? breakEvenQueries : 999,
      success: breakEvenQueries < 50,
    },
  }
}

export function calculateRealMetrics(
  baseline: BaselineResult,
  signals: SignalsResult,
  indexing: IndexingResult
): RealMetrics {
  const storageReduction = calculateReduction(indexing.rawSourceChars, indexing.signalChars)

  const baselineAvgTokens = baseline.totals.avgTokensPerQuery
  const signalsAvgTokens = signals.totals.avgTokensPerQuery
  const queryContextReduction = calculateReduction(baselineAvgTokens, signalsAvgTokens)

  const baselineToolCalls = baseline.queries.reduce((sum, q) => sum + q.simulatedToolCalls, 0)
  const signalsSearchCalls = signals.queries.reduce((sum, q) => sum + q.searchCalls, 0)
  const toolCallReduction = calculateReduction(baselineToolCalls, signalsSearchCalls)

  const baselineAccuracy = baseline.totals.avgCorrectness
  const signalsAccuracy = signals.totals.avgCorrectness

  const top3HitRate = signals.totals.top3HitRate

  const avgSavingsPerQuery = baselineAvgTokens - signalsAvgTokens
  const breakEvenQueries = avgSavingsPerQuery > 0
    ? Math.ceil(indexing.rawSourceChars / avgSavingsPerQuery)
    : Infinity

  return {
    storage: {
      rawSourceChars: indexing.rawSourceChars,
      signalChars: indexing.signalChars,
      reductionPercent: storageReduction,
      success: indexing.signalChars < indexing.rawSourceChars,
    },
    queryContext: {
      baselineAvg: baselineAvgTokens,
      signalsAvg: signalsAvgTokens,
      reductionPercent: queryContextReduction,
      success: queryContextReduction >= 20,
    },
    toolCalls: {
      baselineTotal: baselineToolCalls,
      signalsTotal: signalsSearchCalls,
      reductionPercent: toolCallReduction,
      success: toolCallReduction > 0,
    },
    accuracy: {
      baselineAvg: baselineAccuracy,
      signalsAvg: signalsAccuracy,
      success: signalsAccuracy >= baselineAccuracy - 0.3,
    },
    retrieval: {
      top3HitRate,
      success: top3HitRate >= 70,
    },
    breakEven: {
      indexingChars: indexing.rawSourceChars,
      avgSavingsPerQuery,
      breakEvenQueries: isFinite(breakEvenQueries) ? breakEvenQueries : 999,
      success: breakEvenQueries < 50,
    },
  }
}

function calculateReduction(before: number, after: number): number {
  if (before === 0) return 0
  return Math.round(((before - after) / before) * 100)
}

export function getMetricsSummary(metrics: FullMetrics): string[] {
  const checks: string[] = []

  checks.push(`Storage: ${metrics.storage.reductionPercent}% reduction (${metrics.storage.success ? "PASS" : "FAIL"})`)
  checks.push(`Query Context: ${metrics.queryContext.reductionPercent}% reduction (${metrics.queryContext.success ? "PASS" : "FAIL"})`)
  checks.push(`Full File Reads: ${metrics.fullFileReads.reductionPercent}% reduction (${metrics.fullFileReads.success ? "PASS" : "FAIL"})`)
  checks.push(`Tool Calls: ${metrics.toolCalls.reductionPercent}% reduction (${metrics.toolCalls.success ? "PASS" : "FAIL"})`)
  checks.push(`Accuracy: ${metrics.accuracy.baselineAvg} -> ${metrics.accuracy.signalsAvg} (${metrics.accuracy.success ? "PASS" : "FAIL"})`)
  checks.push(`Retrieval: ${metrics.retrieval.top3HitRate}% Top-3 Hit Rate (${metrics.retrieval.success ? "PASS" : "FAIL"})`)
  checks.push(`Break-even: ${metrics.breakEven.breakEvenQueries} queries (${metrics.breakEven.success ? "PASS" : "FAIL"})`)

  return checks
}

export function getRealMetricsSummary(metrics: RealMetrics): string[] {
  const checks: string[] = []

  checks.push(`Storage: ${metrics.storage.reductionPercent}% reduction (${metrics.storage.success ? "PASS" : "FAIL"})`)
  checks.push(`Query Context: ${metrics.queryContext.reductionPercent}% reduction (${metrics.queryContext.success ? "PASS" : "FAIL"})`)
  checks.push(`Tool Calls: ${metrics.toolCalls.reductionPercent}% reduction (${metrics.toolCalls.success ? "PASS" : "FAIL"})`)
  checks.push(`Accuracy: ${metrics.accuracy.baselineAvg} -> ${metrics.accuracy.signalsAvg} (${metrics.accuracy.success ? "PASS" : "FAIL"})`)
  checks.push(`Retrieval: ${metrics.retrieval.top3HitRate}% Top-3 Hit Rate (${metrics.retrieval.success ? "PASS" : "FAIL"})`)
  checks.push(`Break-even: ${metrics.breakEven.breakEvenQueries} queries (${metrics.breakEven.success ? "PASS" : "FAIL"})`)

  return checks
}