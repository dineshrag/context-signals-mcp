import type { BenchmarkConfig, BenchmarkResult } from "../types/benchmark.js"
import type { Signal } from "../types/signal.js"

export interface BenchmarkOutput extends BenchmarkResult {}

export async function handleBenchmark(
  input: BenchmarkConfig,
  context: {
    signalStore: any
    searchSignals: (signals: Signal[], options: any) => any[]
  }
): Promise<BenchmarkOutput> {
  const { signalStore, searchSignals } = context

  const signals = await signalStore.load()

  const defaultQueries = [
    { query: "Where is the main app initialized?", expected: { kind: "function" } },
    { query: "Show all routes in this project", expected: { kind: "route" } },
    { query: "Where is the login handler?", expected: { kind: "function" } },
    { query: "Find the upload route", expected: { kind: "route" } },
    { query: "Find POST /upload", expected: { kind: "route", method: "POST" } },
    { query: "Show middleware chain", expected: { kind: "middleware" } },
    { query: "Where is error handling defined?", expected: { kind: "function" } },
    { query: "What imports are used in the main app file?", expected: { kind: "import" } },
    { query: "Where is the API endpoint defined?", expected: { kind: "route" } },
    { query: "Find the main service/model/controller definition", expected: { kind: "class" } },
  ]

  const queries = input.queries === "default" ? defaultQueries : input.queries
  let correct = 0
  let signalChars = 0
  const details: BenchmarkResult["details"] = []

  for (const q of queries) {
    const results = searchSignals(signals, { query: q.query, limit: 5 })

    let isCorrect = false
    if (results.length > 0) {
      const top = results[0]
      if (q.expected.kind && top.kind === q.expected.kind) {
        isCorrect = true
      }
      if (q.expected.method && top.route?.method === q.expected.method) {
        isCorrect = true
      }
    }

    if (isCorrect) correct++
    signalChars += results.reduce((sum, r) => sum + r.text.length, 0)
    details?.push({ query: q.query, score: results[0]?.score ?? 0, correct: isCorrect })
  }

  const queriesRun = queries.length
  const accuracyPercent = Math.round((correct / queriesRun) * 100)
  const baselineChars = 50000
  const indexingChars = 12000
  const breakEvenQueries = Math.ceil(indexingChars / Math.max(baselineChars - signalChars, 1))

  return {
    queriesRun,
    correct,
    accuracyPercent,
    baselineChars,
    signalChars,
    indexingChars,
    breakEvenQueries,
    details,
  }
}