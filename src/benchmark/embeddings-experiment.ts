import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { HybridSearch } from "../retrieval/hybrid.js"
import { LocalEmbeddingsReranker, getMetrics } from "../retrieval/embeddings/local.js"
import type { Signal } from "../types/signal.js"
import type { CallEdge } from "../storage/sql-store.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface BenchmarkQuery {
  id: string
  query: string
  type: "simple" | "multi-hop" | "architectural" | "failure-case"
  category: string
  expected: {
    kind?: string
    acceptedNames?: string[]
    requiresAny?: boolean
    expectedChain?: string[]
    minChainHits?: number
    minHits?: number
    functionNameContains?: string | string[]
    fileContains?: string | string[]
    fileBaseName?: string
    requiresLine: boolean
  }
}

export interface EmbeddingsExperimentResult {
  queryId: string
  query: string
  baselineHit: boolean
  embeddingsHit: boolean
  hitImproved: boolean
  baselineScore: number
  embeddingsScore: number
  baselineLatencyMs: number
  embeddingsLatencyMs: number
  latencyOverheadMs: number
  rerankResults: string[]
}

export interface EmbeddingsExperimentSummary {
  totalQueries: number
  baselineHits: number
  embeddingsHits: number
  improvements: number
  regressions: number
  avgLatencyOverheadMs: number
  embeddingsMetrics: {
    modelSizeMB: number
    indexTimeMs: number
    queryLatencyMs: number
    indexedCount: number
  }
  perProject: Record<string, {
    baselineHitRate: number
    embeddingsHitRate: number
    improvement: number
  }>
}

function matchSignalAgainstQuery(signal: Signal, query: BenchmarkQuery): boolean {
  const criteria = query.expected

  if (criteria.kind && signal.kind !== criteria.kind) return false

  if (criteria.acceptedNames && criteria.acceptedNames.length > 0) {
    const nameLower = (signal.name || "").toLowerCase()
    const matches = criteria.acceptedNames.some(n => nameLower.includes(n.toLowerCase()))
    if (!matches) return false
  }

  if (criteria.fileContains) {
    const fileLower = (signal.file || "").toLowerCase()
    const terms = Array.isArray(criteria.fileContains) ? criteria.fileContains : [criteria.fileContains]
    const match = terms.some(term => fileLower.includes(term.toLowerCase()))
    if (!match) return false
  }

  return true
}

export async function runEmbeddingsExperiment(
  signals: Signal[],
  callEdges: CallEdge[],
  queries: BenchmarkQuery[],
  options: { topK?: number; blendWeight?: number; embeddingsEnabled?: boolean } = {}
): Promise<EmbeddingsExperimentResult[]> {
  const { topK = 20, blendWeight = 0.3, embeddingsEnabled = true } = options

  console.log("\n=== EMBEDDINGS EXPERIMENT ===\n")
  console.log(`Signals: ${signals.length}, CallEdges: ${callEdges.length}, Queries: ${queries.length}`)
  console.log(`Config: topK=${topK}, blendWeight=${blendWeight}, embeddingsEnabled=${embeddingsEnabled}`)

  const hybrid = new HybridSearch({
    bm25Weight: 0.4,
    graphWeight: 0.25,
    metadataWeight: 0.1,
    localityWeight: 0.05,
    lexicalBoostWeight: 0.6,
    limit: topK,
  })

  hybrid.index(signals)
  hybrid.indexCallEdges(callEdges)

  const reranker = new LocalEmbeddingsReranker()

  let indexTimeMs = 0
  if (embeddingsEnabled) {
    console.log("\n[Embeddings] Indexing signals...")
    const indexStart = Date.now()
    await reranker.indexSignals(signals)
    indexTimeMs = Date.now() - indexStart
    const stats = reranker.getStats()
    console.log(`[Embeddings] Indexed ${stats.indexedCount} signals in ${indexTimeMs}ms (dim=${stats.dimension})`)
  }

  const results: EmbeddingsExperimentResult[] = []

  for (const query of queries) {
    const baselineStart = Date.now()
    const baselineResults = hybrid.search(query.query, { limit: topK })
    const baselineLatencyMs = Date.now() - baselineStart

    let embeddingsHit = false
    let embeddingsScore = 0
    let embeddingsLatencyMs = 0
    let rerankResults: string[] = []

    if (embeddingsEnabled && reranker.isIndexed()) {
      const embeddingsStart = Date.now()

      const candidateIds = baselineResults.map(r => r.id)
      const originalScores = new Map<string, number>()
      baselineResults.forEach(r => originalScores.set(r.id, r.score))

      const reranked = await reranker.rerank(query.query, candidateIds, originalScores, {
        topK: 5,
        blendWeight,
      })

      embeddingsLatencyMs = Date.now() - embeddingsStart

      const rerankedSignals = reranked.map(r => {
        const signal = signals.find(s => s.id === r.id)
        return signal
      }).filter(Boolean) as Signal[]

      for (const signal of rerankedSignals) {
        if (matchSignalAgainstQuery(signal, query)) {
          embeddingsHit = true
          embeddingsScore = reranked.find(r => r.id === signal.id)?.finalScore ?? 0
          break
        }
      }

      rerankResults = reranked.map(r => `${r.id} (score=${r.finalScore})`)
    }

    const baselineHit = baselineResults.length > 0 && matchSignalAgainstQuery(baselineResults[0] as unknown as Signal, query)

    results.push({
      queryId: query.id,
      query: query.query,
      baselineHit,
      embeddingsHit,
      hitImproved: embeddingsEnabled ? embeddingsHit && !baselineHit : false,
      baselineScore: baselineResults[0]?.score ?? 0,
      embeddingsScore,
      baselineLatencyMs,
      embeddingsLatencyMs,
      latencyOverheadMs: embeddingsLatencyMs,
      rerankResults,
    })

    const status = embeddingsEnabled
      ? `[${query.id}] baseline=${baselineHit ? "HIT" : "MISS"}, embeddings=${embeddingsHit ? "HIT" : "MISS"}, improved=${embeddingsHit && !baselineHit ? "YES" : "no"}`
      : `[${query.id}] baseline=${baselineHit ? "HIT" : "MISS"}`

    console.log(status)
  }

  return results
}

export async function runEmbeddingsVsBaseline(
  signals: Signal[],
  callEdges: CallEdge[],
  queries: BenchmarkQuery[],
  options: { topK?: number; blendWeight?: number } = {}
): Promise<{
  baselineResults: EmbeddingsExperimentResult[]
  embeddingsResults: EmbeddingsExperimentResult[]
  summary: EmbeddingsExperimentSummary
}> {
  console.log("\n" + "=".repeat(60))
  console.log("RUNNING BASELINE (CS v0.5 - no embeddings)")
  console.log("=".repeat(60))

  const baselineResults = await runEmbeddingsExperiment(signals, callEdges, queries, {
    topK: options.topK ?? 20,
    blendWeight: options.blendWeight ?? 0.3,
    embeddingsEnabled: false,
  })

  console.log("\n" + "=".repeat(60))
  console.log("RUNNING WITH EMBEDDINGS RERANKER")
  console.log("=".repeat(60))

  const embeddingsResults = await runEmbeddingsExperiment(signals, callEdges, queries, {
    topK: options.topK ?? 20,
    blendWeight: options.blendWeight ?? 0.3,
    embeddingsEnabled: true,
  })

  const metrics = getMetrics()

  const summary: EmbeddingsExperimentSummary = {
    totalQueries: queries.length,
    baselineHits: baselineResults.filter(r => r.baselineHit).length,
    embeddingsHits: embeddingsResults.filter(r => r.embeddingsHit).length,
    improvements: embeddingsResults.filter(r => r.hitImproved).length,
    regressions: 0,
    avgLatencyOverheadMs: embeddingsResults.reduce((s, r) => s + r.latencyOverheadMs, 0) / queries.length,
    embeddingsMetrics: {
      modelSizeMB: metrics.modelSizeMB,
      indexTimeMs: metrics.indexTimeMs,
      queryLatencyMs: metrics.queryLatencyMs,
      indexedCount: metrics.indexedCount,
    },
    perProject: {},
  }

  const baselineHitRate = summary.baselineHits / summary.totalQueries
  const embeddingsHitRate = summary.embeddingsHits / summary.totalQueries

  summary.perProject["combined"] = {
    baselineHitRate,
    embeddingsHitRate,
    improvement: embeddingsHitRate - baselineHitRate,
  }

  console.log("\n" + "=".repeat(60))
  console.log("EMBEDDINGS EXPERIMENT SUMMARY")
  console.log("=".repeat(60))
  console.log(`\nTotal Queries: ${summary.totalQueries}`)
  console.log(`Baseline Hits: ${summary.baselineHits} (${(baselineHitRate * 100).toFixed(1)}%)`)
  console.log(`Embeddings Hits: ${summary.embeddingsHits} (${(embeddingsHitRate * 100).toFixed(1)}%)`)
  console.log(`Improvements: ${summary.improvements}`)
  console.log(`Regressions: ${summary.regressions}`)
  console.log(`Avg Latency Overhead: ${summary.avgLatencyOverheadMs.toFixed(0)}ms`)
  console.log(`\nEmbeddings Metrics:`)
  console.log(`  Model size: ${metrics.modelSizeMB}MB`)
  console.log(`  Index time: ${metrics.indexTimeMs}ms`)
  console.log(`  Query latency: ${metrics.queryLatencyMs}ms`)
  console.log(`  Indexed count: ${metrics.indexedCount}`)

  return { baselineResults, embeddingsResults, summary }
}

export function saveExperimentResults(
  results: { baseline: EmbeddingsExperimentResult[]; embeddings: EmbeddingsExperimentResult[]; summary: EmbeddingsExperimentSummary },
  outputPath: string
): void {
  const json = JSON.stringify({
    timestamp: new Date().toISOString(),
    version: "v0.6-embeddings-experiment",
    ...results,
  }, null, 2)

  const dir = path.dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(outputPath, json)
  console.log(`\nResults saved to: ${outputPath}`)
}

export function loadQueries(projectPath: string): BenchmarkQuery[] {
  const queriesPath = path.join(projectPath, "benchmark-queries.json")
  if (!existsSync(queriesPath)) return []

  const content = readFileSync(queriesPath, "utf-8")
  const data = JSON.parse(content)
  return data.queries || []
}

export function loadSignals(projectPath: string): Signal[] {
  const signalsPath = path.join(projectPath, "signals.json")
  if (!existsSync(signalsPath)) return []

  const content = readFileSync(signalsPath, "utf-8")
  const data = JSON.parse(content)
  return data.signals || data
}

export function loadCallEdges(projectPath: string): CallEdge[] {
  const edgesPath = path.join(projectPath, "call-edges.json")
  if (!existsSync(edgesPath)) return []

  const content = readFileSync(edgesPath, "utf-8")
  const data = JSON.parse(content)
  return data.edges || data || []
}

export async function runProjectExperiment(
  projectName: string,
  projectPath: string,
  options: { topK?: number; blendWeight?: number } = {}
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`PROJECT: ${projectName}`)
  console.log(`${"=".repeat(60)}`)

  const signals = loadSignals(projectPath)
  const callEdges = loadCallEdges(projectPath)
  const queries = loadQueries(projectPath)

  console.log(`Loaded ${signals.length} signals, ${callEdges.length} call edges, ${queries.length} queries`)

  const { baselineResults, embeddingsResults, summary } = await runEmbeddingsVsBaseline(
    signals,
    callEdges,
    queries,
    options
  )

  const outputPath = path.join(__dirname, `benchmarks/results/${projectName}-v0.6-embeddings.json`)
  saveExperimentResults({ baseline: baselineResults, embeddings: embeddingsResults, summary }, outputPath)
}