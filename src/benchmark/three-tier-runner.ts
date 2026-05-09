import fs from "fs"
import path from "path"
import { createHash } from "crypto"
import { HybridSearch } from "../retrieval/hybrid.js"
import { computeFinalScore } from "../retrieval/graph-scorer.js"
import { extractQueryIntent } from "../retrieval/query-intent.js"
import type { Signal } from "../types/signal.js"
import type { CallEdge } from "../storage/sql-store.js"

export type BaselineType = "grep" | "bm25" | "context-signals"

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

export interface GroundTruthEntry {
  queryId: string
  query: string
  expectedFile?: string
  expectedSymbol?: string
  expectedLine?: number
  expectedFiles?: string[]
  expectedSymbols?: string[]
  matchCriteria: Record<string, any>
}

export interface ThreeTierResult {
  queryId: string
  query: string
  baseline: BaselineType
  topResult: MatchResult | null
  charsRead: number
  latencyMs: number
  hit: boolean
  score: number
}

export interface MatchResult {
  signalId: string
  file: string
  name: string
  kind: string
  score: number
  matchedOn: string[]
}

export interface BenchmarkRunResult {
  runId: string
  project: string
  timestamp: number
  results: {
    grep: ThreeTierResult[]
    bm25: ThreeTierResult[]
    "context-signals": ThreeTierResult[]
  }
  summary: {
    grepTop3HitRate: number
    bm25Top3HitRate: number
    contextSignalsTop3HitRate: number
    grepAvgCharsRead: number
    bm25AvgCharsRead: number
    contextSignalsAvgCharsRead: number
    contextSignalsWins: number
    bm25Wins: number
    grepWins: number
  }
}

function generateRunId(project: string): string {
  const timestamp = Date.now()
  const input = `${project}::${timestamp}`
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function matchSignalAgainstQuery(signal: Signal, query: BenchmarkQuery): MatchResult | null {
  const criteria = query.expected
  const matchedOn: string[] = []

  if (criteria.kind && signal.kind !== criteria.kind) return null

  if (criteria.acceptedNames && criteria.acceptedNames.length > 0) {
    const nameLower = (signal.name || "").toLowerCase()
    const matches = criteria.acceptedNames.some(n => nameLower.includes(n.toLowerCase()))
    if (matches) matchedOn.push(`acceptedNames:${criteria.acceptedNames.join(',')}`)
    else return null
  }

  if (criteria.fileContains) {
    const fileLower = (signal.file || "").toLowerCase()
    const terms = Array.isArray(criteria.fileContains) ? criteria.fileContains : [criteria.fileContains]
    const match = terms.some(term => fileLower.includes(term.toLowerCase()))
    if (match) matchedOn.push(`fileContains:${terms.join(',')}`)
    else return null
  }

  if (criteria.minHits && criteria.minHits > 0) {
    const nameLower = (signal.name || "").toLowerCase()
    let matchCount = 0
    if (criteria.acceptedNames) {
      for (const name of criteria.acceptedNames) {
        if (nameLower.includes(name.toLowerCase())) matchCount++
      }
    }
    if (matchCount >= criteria.minHits) {
      matchedOn.push(`minHits:${matchCount}/${criteria.minHits}`)
    } else {
      return null
    }
  }

  return {
    signalId: signal.id,
    file: signal.file || "",
    name: signal.name || "",
    kind: signal.kind,
    score: signal.confidence,
    matchedOn,
  }
}

function matchChainAgainstResults(results: Signal[], expectedChain: string[], minChainHits: number): { hit: boolean, matchedChain: string[], charsRead: number } {
  const matchedNames: string[] = []
  let charsRead = 0

  for (const signal of results) {
    const nameLower = (signal.name || "").toLowerCase()
    charsRead += (signal.text?.length || 0)
    for (const chainName of expectedChain) {
      if (nameLower.includes(chainName.toLowerCase()) && !matchedNames.includes(chainName)) {
        matchedNames.push(chainName)
      }
    }
  }

  return {
    hit: matchedNames.length >= minChainHits,
    matchedChain: matchedNames,
    charsRead
  }
}

function simulateGrepBaseline(signals: Signal[], query: BenchmarkQuery): ThreeTierResult {
  const startTime = Date.now()
  const queryTerms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

  if (query.expected.expectedChain) {
    const scoredSignals = signals.map(signal => {
      const textLower = (signal.text || "").toLowerCase()
      const nameLower = (signal.name || "").toLowerCase()
      const fileLower = (signal.file || "").toLowerCase()

      let score = 0
      for (const term of queryTerms) {
        if (textLower.includes(term)) score += 1
        if (nameLower.includes(term)) score += 3
        if (fileLower.includes(term)) score += 2
      }

      return { signal, score }
    })

    scoredSignals.sort((a, b) => b.score - a.score)
    const topResults = scoredSignals.slice(0, 10).map(s => s.signal)

    const chainResult = matchChainAgainstResults(topResults, query.expected.expectedChain, query.expected.minChainHits || 1)
    return {
      queryId: query.id,
      query: query.query,
      baseline: "grep",
      topResult: null,
      charsRead: chainResult.charsRead,
      latencyMs: Date.now() - startTime,
      hit: chainResult.hit,
      score: chainResult.matchedChain.length,
    }
  }

  let bestMatch: MatchResult | null = null
  let charsRead = 0

  const scoredSignals = signals.map(signal => {
    const textLower = (signal.text || "").toLowerCase()
    const nameLower = (signal.name || "").toLowerCase()
    const fileLower = (signal.file || "").toLowerCase()

    let score = 0
    for (const term of queryTerms) {
      if (textLower.includes(term)) score += 1
      if (nameLower.includes(term)) score += 3
      if (fileLower.includes(term)) score += 2
    }

    charsRead += (signal.text?.length || 0)

    return { signal, score }
  })

  scoredSignals.sort((a, b) => b.score - a.score)

  const top3 = scoredSignals.slice(0, 3)
  for (const { signal } of top3) {
    const match = matchSignalAgainstQuery(signal, query)
    if (match) {
      bestMatch = match
      break
    }
  }

  charsRead = Math.min(charsRead, top3.length * 1000)

  return {
    queryId: query.id,
    query: query.query,
    baseline: "grep",
    topResult: bestMatch,
    charsRead,
    latencyMs: Date.now() - startTime,
    hit: bestMatch !== null,
    score: bestMatch?.score || 0,
  }
}

function runBm25Baseline(signals: Signal[], query: BenchmarkQuery): ThreeTierResult {
  const startTime = Date.now()

  if (query.expected.expectedChain) {
    const hybrid = new HybridSearch({
      bm25Weight: 1.0,
      graphWeight: 0,
      metadataWeight: 0,
      localityWeight: 0,
      limit: 10,
    })
    hybrid.index(signals)
    const results = hybrid.search(query.query, { limit: 10 })
    const resultSignals = results.map(r => r as unknown as Signal)
    const chainResult = matchChainAgainstResults(resultSignals, query.expected.expectedChain, query.expected.minChainHits || 1)
    return {
      queryId: query.id,
      query: query.query,
      baseline: "bm25",
      topResult: null,
      charsRead: chainResult.charsRead,
      latencyMs: Date.now() - startTime,
      hit: chainResult.hit,
      score: chainResult.matchedChain.length,
    }
  }

  const hybrid = new HybridSearch({
    bm25Weight: 1.0,
    graphWeight: 0,
    metadataWeight: 0,
    localityWeight: 0,
    limit: 10,
  })

  hybrid.index(signals)
  const results = hybrid.search(query.query, { limit: 10 })

  const bestMatch = results.length > 0
    ? matchSignalAgainstQuery(results[0] as unknown as Signal, query)
    : null

  const charsRead = results.reduce((sum, r) => sum + (r.text?.length || 0), 0)

  return {
    queryId: query.id,
    query: query.query,
    baseline: "bm25",
    topResult: bestMatch,
    charsRead,
    latencyMs: Date.now() - startTime,
    hit: bestMatch !== null,
    score: results[0]?.score || 0,
  }
}

function runContextSignalsBaseline(
  signals: Signal[],
  callEdges: CallEdge[],
  query: BenchmarkQuery
): ThreeTierResult {
  const startTime = Date.now()

  if (query.expected.expectedChain) {
    const hybrid = new HybridSearch({
      bm25Weight: 0.4,
      graphWeight: 0.3,
      metadataWeight: 0.15,
      localityWeight: 0.05,
      lexicalBoostWeight: 0.25,
      limit: 10,
    })
    hybrid.index(signals)
    hybrid.indexCallEdges(callEdges)
    const results = hybrid.search(query.query, { limit: 10 })
    const resultSignals = results.map(r => r as unknown as Signal)
    const chainResult = matchChainAgainstResults(resultSignals, query.expected.expectedChain, query.expected.minChainHits || 1)
    return {
      queryId: query.id,
      query: query.query,
      baseline: "context-signals",
      topResult: null,
      charsRead: chainResult.charsRead,
      latencyMs: Date.now() - startTime,
      hit: chainResult.hit,
      score: chainResult.matchedChain.length,
    }
  }

const hybrid = new HybridSearch({
    bm25Weight: 0.4,
    graphWeight: 0.25,
    metadataWeight: 0.1,
    localityWeight: 0.05,
    lexicalBoostWeight: 0.6,
    limit: 10,
  })

  hybrid.index(signals)
  hybrid.indexCallEdges(callEdges)

  const results = hybrid.search(query.query, { limit: 10 })
  const extended = hybrid.searchWithBreakdown(query.query, { limit: 10 })

  let bestMatch: MatchResult | null = null
  let bestMatchIdx = -1
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const match = matchSignalAgainstQuery(results[i] as unknown as Signal, query)
    if (match) {
      bestMatch = match
      bestMatchIdx = i
      break
    }
  }

  const charsRead = results.reduce((sum, r) => sum + (r.text?.length || 0), 0)

  return {
    queryId: query.id,
    query: query.query,
    baseline: "context-signals",
    topResult: bestMatch,
    charsRead,
    latencyMs: Date.now() - startTime,
    hit: bestMatch !== null,
    score: results[bestMatchIdx]?.score || results[0]?.score || 0,
  }
}

export async function runThreeTierComparison(
  project: string,
  signals: Signal[],
  callEdges: CallEdge[],
  queries: BenchmarkQuery[]
): Promise<BenchmarkRunResult> {
  const runId = generateRunId(project)
  const timestamp = Date.now()

  const results: BenchmarkRunResult["results"] = {
    grep: [],
    bm25: [],
    "context-signals": [],
  }

  for (const query of queries) {
    results.grep.push(simulateGrepBaseline(signals, query))
    results.bm25.push(runBm25Baseline(signals, query))
    results["context-signals"].push(runContextSignalsBaseline(signals, callEdges, query))
  }

  function calcTop3HitRate(r: ThreeTierResult[]) {
    return r.filter(x => x.hit).length / r.length
  }

  function calcAvgChars(r: ThreeTierResult[]) {
    return r.reduce((s, x) => s + x.charsRead, 0) / r.length
  }

  function countWins(r: ThreeTierResult[], allResults: { grep: ThreeTierResult[], bm25: ThreeTierResult[], "context-signals": ThreeTierResult[] }) {
    let wins = 0
    for (let i = 0; i < r.length; i++) {
      const others = [allResults.grep[i], allResults.bm25[i], allResults["context-signals"][i]]
      const maxScore = Math.max(...others.map(o => o.score))
      if (r[i].score >= maxScore && r[i].hit) wins++
    }
    return wins
  }

  const summary: BenchmarkRunResult["summary"] = {
    grepTop3HitRate: calcTop3HitRate(results.grep),
    bm25Top3HitRate: calcTop3HitRate(results.bm25),
    contextSignalsTop3HitRate: calcTop3HitRate(results["context-signals"]),
    grepAvgCharsRead: calcAvgChars(results.grep),
    bm25AvgCharsRead: calcAvgChars(results.bm25),
    contextSignalsAvgCharsRead: calcAvgChars(results["context-signals"]),
    contextSignalsWins: countWins(results["context-signals"], results),
    bm25Wins: countWins(results.bm25, results),
    grepWins: countWins(results.grep, results),
  }

  return {
    runId,
    project,
    timestamp,
    results,
    summary,
  }
}

export function loadQueries(projectPath: string): BenchmarkQuery[] {
  const queriesPath = path.join(projectPath, "benchmark-queries.json")
  if (!fs.existsSync(queriesPath)) return []

  const content = fs.readFileSync(queriesPath, "utf-8")
  const data = JSON.parse(content)
  return data.queries || []
}

export function loadGroundTruth(projectPath: string): GroundTruthEntry[] {
  const gtPath = path.join(projectPath, "ground-truth.json")
  if (!fs.existsSync(gtPath)) return []

  const content = fs.readFileSync(gtPath, "utf-8")
  const data = JSON.parse(content)
  return data.groundTruth || []
}

export function generateReport(result: BenchmarkRunResult): string {
  const lines: string[] = [
    `# Benchmark Report: ${result.project}`,
    ``,
    `**Run ID:** ${result.runId}`,
    `**Timestamp:** ${new Date(result.timestamp).toISOString()}`,
    ``,
    `## Top-3 Hit Rate Comparison`,
    ``,
    `| Baseline | Top-3 Hit Rate |`,
    `|----------|---------------|`,
    `| Grep | ${(result.summary.grepTop3HitRate * 100).toFixed(1)}% |`,
    `| BM25 | ${(result.summary.bm25Top3HitRate * 100).toFixed(1)}% |`,
    `| Context Signals | ${(result.summary.contextSignalsTop3HitRate * 100).toFixed(1)}% |`,
    ``,
    `## Average Chars Read`,
    ``,
    `| Baseline | Avg Chars Read |`,
    `|----------|----------------|`,
    `| Grep | ${result.summary.grepAvgCharsRead.toFixed(0)} |`,
    `| BM25 | ${result.summary.bm25AvgCharsRead.toFixed(0)} |`,
    `| Context Signals | ${result.summary.contextSignalsAvgCharsRead.toFixed(0)} |`,
    ``,
    `## Win Counts`,
    ``,
    `| Baseline | Wins |`,
    `|----------|------|`,
    `| Grep | ${result.summary.grepWins} |`,
    `| BM25 | ${result.summary.bm25Wins} |`,
    `| Context Signals | ${result.summary.contextSignalsWins} |`,
    ``,
  ]

  return lines.join("\n")
}