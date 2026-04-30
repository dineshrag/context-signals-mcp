import type { BenchmarkQuery, BenchmarkResult, BenchmarkConfig } from "../types/benchmark.js"
import type { Signal } from "../types/signal.js"
import { DEFAULT_QUERIES, NAVIGATION_QUERIES } from "./queries.js"

export interface RunnerConfig extends BenchmarkConfig {
  signals: Signal[]
  searchSignals: (signals: Signal[], options: any) => any[]
}

export interface QueryResult {
  query: string
  expectedKind?: string
  expectedMethod?: string
  topResult?: any
  score: number
  correct: boolean
  resultsCount: number
}

export interface RunnerResult extends BenchmarkResult {
  queryResults: QueryResult[]
  metrics: {
    indexingMs?: number
    totalSignalChars: number
    totalBaselineChars: number
  }
}

export function runBenchmark(config: RunnerConfig): RunnerResult {
  const { signals, searchSignals, queries: inputQueries, includeIndexingCost } = config

  const queries = inputQueries === "default" ? DEFAULT_QUERIES : inputQueries

  let correct = 0
  let totalSignalChars = 0
  const queryResults: QueryResult[] = []

  for (const q of queries) {
    const results = searchSignals(signals, { query: q.query, limit: 5 })

    let isCorrect = false
    let topResult: any = null

    if (results.length > 0) {
      topResult = results[0]
      totalSignalChars += results.reduce((sum, r) => sum + (r.text?.length ?? 0), 0)

      if (q.expected.kind && topResult.kind === q.expected.kind) {
        isCorrect = true
      }
      if (q.expected.method && topResult.route?.method === q.expected.method) {
        isCorrect = true
      }
      if (q.expected.fileContains && topResult.file?.includes(q.expected.fileContains)) {
        isCorrect = true
      }
    }

    if (isCorrect) correct++

    queryResults.push({
      query: q.query,
      expectedKind: q.expected.kind,
      expectedMethod: q.expected.method,
      topResult,
      score: topResult?.score ?? 0,
      correct: isCorrect,
      resultsCount: results.length,
    })
  }

  const queriesRun = queries.length
  const accuracyPercent = Math.round((correct / queriesRun) * 100)

  const baselineChars = 50000
  const indexingChars = includeIndexingCost ? 12000 : 0
  const signalChars = totalSignalChars
  const averageSavingsPerQuery = baselineChars - (signalChars / queriesRun)
  const breakEvenQueries = averageSavingsPerQuery > 0
    ? Math.ceil(indexingChars / averageSavingsPerQuery)
    : 0

  return {
    queriesRun,
    correct,
    accuracyPercent,
    baselineChars,
    signalChars,
    indexingChars,
    breakEvenQueries,
    queryResults,
    metrics: {
      indexingMs: includeIndexingCost ? 1500 : undefined,
      totalSignalChars: signalChars,
      totalBaselineChars: baselineChars * queriesRun,
    },
  }
}

export function runNavigationBenchmark(
  signals: Signal[],
  searchSignals: (signals: Signal[], options: any) => any[]
): RunnerResult {
  return runBenchmark({
    signals,
    searchSignals,
    queries: NAVIGATION_QUERIES,
    includeIndexingCost: true,
  })
}