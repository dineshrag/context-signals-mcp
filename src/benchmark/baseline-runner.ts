import { readFile, writeFile, readdir } from "fs/promises"
import path from "path"
import type { GroundTruth, GroundTruthQuery } from "./ground-truth.js"

export interface BaselineResult {
  fixture: string
  timestamp: number
  rawSourceChars: number
  fileCount: number
  queries: BaselineQueryResult[]
  totals: BaselineTotals
}

export interface BaselineQueryResult {
  queryId: string
  query: string
  category: string
  difficulty: string
  simulatedToolCalls: number
  simulatedFullReads: number
  simulatedTokens: number
  simulatedCorrectness: number
  simulatedTimeMs: number
}

export interface BaselineTotals {
  totalToolCalls: number
  totalFullReads: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
}

export interface BaselineConfig {
  fixturePath: string
  fixtureName: string
  outputPath?: string
}

const SIMULATED_BASELINE_METRICS = {
  avgToolCallsPerQuery: 8,
  avgFullReadsPerQuery: 4,
  avgTokensPerQuery: 3500,
  avgCorrectnessScore: 2.2,
  avgTimeMs: 4500,
}

export async function runBaseline(config: BaselineConfig): Promise<BaselineResult> {
  const { fixturePath, fixtureName, outputPath } = config

  const sourceStats = await calculateSourceStats(fixturePath)

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

  const queryResults: BaselineQueryResult[] = queries.map(q => ({
    queryId: q.id,
    query: q.query,
    category: q.category,
    difficulty: q.difficulty,
    simulatedToolCalls: Math.round(SIMULATED_BASELINE_METRICS.avgToolCallsPerQuery * (1 + Math.random() * 0.3)),
    simulatedFullReads: Math.round(SIMULATED_BASELINE_METRICS.avgFullReadsPerQuery * (1 + Math.random() * 0.4)),
    simulatedTokens: Math.round(SIMULATED_BASELINE_METRICS.avgTokensPerQuery * (1 + Math.random() * 0.2)),
    simulatedCorrectness: Math.min(3, Math.max(0, SIMULATED_BASELINE_METRICS.avgCorrectnessScore + (Math.random() - 0.5))),
    simulatedTimeMs: Math.round(SIMULATED_BASELINE_METRICS.avgTimeMs * (1 + Math.random() * 0.3)),
  }))

  const totals: BaselineTotals = {
    totalToolCalls: queryResults.reduce((sum, r) => sum + r.simulatedToolCalls, 0),
    totalFullReads: queryResults.reduce((sum, r) => sum + r.simulatedFullReads, 0),
    totalTokens: queryResults.reduce((sum, r) => sum + r.simulatedTokens, 0),
    avgTokensPerQuery: queryResults.length > 0
      ? Math.round(queryResults.reduce((sum, r) => sum + r.simulatedTokens, 0) / queryResults.length)
      : 0,
    avgCorrectness: queryResults.length > 0
      ? parseFloat((queryResults.reduce((sum, r) => sum + r.simulatedCorrectness, 0) / queryResults.length).toFixed(2))
      : 0,
  }

  const result: BaselineResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    rawSourceChars: sourceStats.totalChars,
    fileCount: sourceStats.fileCount,
    queries: queryResults,
    totals,
  }

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

async function calculateSourceStats(dirPath: string): Promise<{ totalChars: number; fileCount: number }> {
  let totalChars = 0
  let fileCount = 0

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build"].includes(entry.name)) {
          continue
        }
        const subStats = await calculateSourceStats(path.join(dirPath, entry.name))
        totalChars += subStats.totalChars
        fileCount += subStats.fileCount
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go"].includes(ext)) {
          const content = await readFile(path.join(dirPath, entry.name), "utf-8")
          totalChars += content.length
          fileCount++
        }
      }
    }
  } catch {
    // Directory may not exist yet
  }

  return { totalChars, fileCount }
}

export async function loadBaseline(fixtureName: string): Promise<BaselineResult | null> {
  const filePath = path.join("benchmarks", "baseline", `${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as BaselineResult
  } catch {
    return null
  }
}

export async function saveBaseline(fixtureName: string, result: BaselineResult): Promise<void> {
  const filePath = path.join("benchmarks", "baseline", `${fixtureName}.json`)
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8")
}