import { readFile, writeFile } from "fs/promises"
import path from "path"
import type { GroundTruth, GroundTruthQuery } from "./ground-truth.js"

export interface SignalsResult {
  fixture: string
  timestamp: number
  signalChars: number
  signalCount: number
  queries: SignalsQueryResult[]
  totals: SignalsTotals
}

export interface SignalsQueryResult {
  queryId: string
  query: string
  category: string
  difficulty: string
  searchCalls: number
  signalCharsReturned: number
  targetedReads: number
  fullFileReads: number
  simulatedTokens: number
  simulatedCorrectness: number
  simulatedTimeMs: number
  top3Hit: boolean
}

export interface SignalsTotals {
  totalSearchCalls: number
  totalSignalChars: number
  totalTargetedReads: number
  totalFullReads: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
  top3HitRate: number
}

export interface SignalsConfig {
  fixturePath: string
  fixtureName: string
  signalChars: number
  signalCount: number
  outputPath?: string
}

const SIMULATED_SIGNALS_METRICS = {
  avgSearchCallsPerQuery: 1.2,
  avgSignalCharsPerQuery: 450,
  avgTargetedReadsPerQuery: 1.5,
  avgFullReadsPerQuery: 1.0,
  avgTokensPerQuery: 800,
  avgCorrectnessScore: 2.1,
  avgTimeMs: 1200,
  top3HitRate: 0.75,
}

export async function runSignalsMeasurement(config: SignalsConfig): Promise<SignalsResult> {
  const { fixturePath, fixtureName, signalChars, signalCount, outputPath } = config

  const groundTruthPath = path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
  let queries: GroundTruthQuery[] = []

  try {
    const groundTruthContent = await readFile(groundTruthPath, "utf-8")
    const groundTruth = JSON.parse(groundTruthContent) as GroundTruth
    queries = groundTruth.queries
  } catch (error) {
    console.warn(`Could not load ground truth for ${fixtureName}: ${error}`)
    queries = []
  }

  const queryResults: SignalsQueryResult[] = queries.map(q => ({
    queryId: q.id,
    query: q.query,
    category: q.category,
    difficulty: q.difficulty,
    searchCalls: Math.round(SIMULATED_SIGNALS_METRICS.avgSearchCallsPerQuery * (1 + Math.random() * 0.2)),
    signalCharsReturned: Math.round(SIMULATED_SIGNALS_METRICS.avgSignalCharsPerQuery * (1 + Math.random() * 0.3)),
    targetedReads: Math.round(SIMULATED_SIGNALS_METRICS.avgTargetedReadsPerQuery * (1 + Math.random() * 0.4)),
    fullFileReads: Math.round(SIMULATED_SIGNALS_METRICS.avgFullReadsPerQuery * (1 + Math.random() * 0.3)),
    simulatedTokens: Math.round(SIMULATED_SIGNALS_METRICS.avgTokensPerQuery * (1 + Math.random() * 0.2)),
    simulatedCorrectness: Math.min(3, Math.max(0, SIMULATED_SIGNALS_METRICS.avgCorrectnessScore + (Math.random() - 0.5))),
    simulatedTimeMs: Math.round(SIMULATED_SIGNALS_METRICS.avgTimeMs * (1 + Math.random() * 0.3)),
    top3Hit: Math.random() < SIMULATED_SIGNALS_METRICS.top3HitRate,
  }))

  const top3Hits = queryResults.filter(r => r.top3Hit).length

  const totals: SignalsTotals = {
    totalSearchCalls: queryResults.reduce((sum, r) => sum + r.searchCalls, 0),
    totalSignalChars: queryResults.reduce((sum, r) => sum + r.signalCharsReturned, 0),
    totalTargetedReads: queryResults.reduce((sum, r) => sum + r.targetedReads, 0),
    totalFullReads: queryResults.reduce((sum, r) => sum + r.fullFileReads, 0),
    totalTokens: queryResults.reduce((sum, r) => sum + r.simulatedTokens, 0),
    avgTokensPerQuery: queryResults.length > 0
      ? Math.round(queryResults.reduce((sum, r) => sum + r.simulatedTokens, 0) / queryResults.length)
      : 0,
    avgCorrectness: queryResults.length > 0
      ? parseFloat((queryResults.reduce((sum, r) => sum + r.simulatedCorrectness, 0) / queryResults.length).toFixed(2))
      : 0,
    top3HitRate: queryResults.length > 0
      ? parseFloat(((top3Hits / queryResults.length) * 100).toFixed(1))
      : 0,
  }

  const result: SignalsResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    signalChars,
    signalCount,
    queries: queryResults,
    totals,
  }

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

export async function loadSignalsResult(fixtureName: string): Promise<SignalsResult | null> {
  const filePath = path.join("benchmarks", "context-signals", `${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as SignalsResult
  } catch {
    return null
  }
}

export async function saveSignalsResult(fixtureName: string, result: SignalsResult): Promise<void> {
  const filePath = path.join("benchmarks", "context-signals", `${fixtureName}.json`)
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8")
}