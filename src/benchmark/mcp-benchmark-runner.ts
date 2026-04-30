import { spawn, ChildProcess } from "child_process"
import { readFile, writeFile } from "fs/promises"
import path from "path"
import type { GroundTruthQuery } from "./ground-truth.js"

function normalizePath(p: string): string {
  return p.split(path.sep).join('/')
}

export interface MCPQueryResult {
  queryId: string
  query: string
  category: string
  difficulty: string
  toolCalls: number
  charsRead: number
  estimatedTokens: number
  correctness: number
  timeMs: number
  response?: {
    count: number
    results: Array<{ file: string; line?: number; kind: string; name: string }>
  }
}

export interface MCPTotals {
  totalToolCalls: number
  totalCharsRead: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
  top3HitRate: number
}

export interface MCPResult {
  fixture: string
  timestamp: number
  signalChars: number
  signalCount: number
  queries: MCPQueryResult[]
  totals: MCPTotals
}

export interface MCPConfig {
  fixturePath: string
  fixtureName: string
  outputPath?: string
}

interface Signal {
  kind: string
  name: string
  file: string
  line?: number
  text?: string
}

export async function runMCPBenchmark(config: MCPConfig): Promise<MCPResult> {
  const { fixturePath, fixtureName, outputPath } = config

  const signalsPath = path.join(fixturePath, "signals.json")
  let signals: Signal[] = []
  try {
    const content = await readFile(signalsPath, "utf-8")
    signals = JSON.parse(content)
  } catch {
    console.warn(`Could not load signals from ${signalsPath}`)
  }

  const groundTruthPath = path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
  let queries: GroundTruthQuery[] = []

  try {
    const content = await readFile(groundTruthPath, "utf-8")
    const gt = JSON.parse(content)
    queries = gt.queries
  } catch {
    console.warn(`Could not load ground truth for ${fixtureName}`)
  }

  const queryResults: MCPQueryResult[] = []
  const startTime = Date.now()

  for (const q of queries) {
    const result = await querySignals(q, signals, fixturePath)
    queryResults.push({
      queryId: q.id,
      query: q.query,
      category: q.category,
      difficulty: q.difficulty,
      ...result
    })
  }

  const totalTimeMs = Date.now() - startTime

  const top3Hits = queryResults.filter(r => r.correctness >= 2).length

  const totals: MCPTotals = {
    totalToolCalls: queryResults.reduce((sum, r) => sum + r.toolCalls, 0),
    totalCharsRead: queryResults.reduce((sum, r) => sum + r.charsRead, 0),
    totalTokens: queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0),
    avgTokensPerQuery: queryResults.length > 0
      ? Math.round(queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0) / queryResults.length)
      : 0,
    avgCorrectness: queryResults.length > 0
      ? parseFloat((queryResults.reduce((sum, r) => sum + r.correctness, 0) / queryResults.length).toFixed(2))
      : 0,
    top3HitRate: queryResults.length > 0
      ? parseFloat(((top3Hits / queryResults.length) * 100).toFixed(1))
      : 0,
  }

  const result: MCPResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    signalChars: signals.length * 50,
    signalCount: signals.length,
    queries: queryResults,
    totals,
  }

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

async function querySignals(
  query: GroundTruthQuery,
  signals: Signal[],
  fixturePath: string
): Promise<Omit<MCPQueryResult, 'queryId' | 'query' | 'category' | 'difficulty'>> {
  const startTime = Date.now()

  const searchTerms = extractSearchTerms(query.query)

  const searchResults = signals.filter(sig => {
    const sigText = `${sig.kind} ${sig.name} ${sig.file}`.toLowerCase()
    return searchTerms.some(term => sigText.includes(term))
  }).sort((a, b) => {
    const aText = `${a.kind} ${a.name}`.toLowerCase()
    const bText = `${b.kind} ${b.name}`.toLowerCase()
    const aMatches = searchTerms.filter(t => aText.includes(t)).length
    const bMatches = searchTerms.filter(t => bText.includes(t)).length
    return bMatches - aMatches
  }).slice(0, 5)

  const top3 = searchResults.slice(0, 3)
  let charsRead = 0
  let correctness = 0
  let toolCalls = 1

  if (top3.length > 0) {
    const top = top3[0]
    charsRead = top.text?.length || 50

    const isCorrect = checkSignalCorrectness(top, query, fixturePath)

    if (isCorrect) {
      correctness = 3
    } else if (top3.some(s => checkSignalCorrectness(s, query, fixturePath))) {
      correctness = 2
    } else if (searchResults.length > 0) {
      correctness = 1
    }
  }

  const response = {
    count: searchResults.length,
    results: searchResults.slice(0, 3).map(s => ({
      file: s.file,
      line: s.line,
      kind: s.kind,
      name: s.name
    }))
  }

  const timeMs = Date.now() - startTime
  const estimatedTokens = Math.round(charsRead / 4)

  return {
    toolCalls,
    charsRead,
    estimatedTokens,
    correctness,
    timeMs,
    response
  }
}

function extractSearchTerms(query: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "where", "find", "show", "all", "in", "this", "handler", "endpoint", "route"])
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5)
}

function checkSignalCorrectness(signal: Signal, query: GroundTruthQuery, fixturePath: string): boolean {
  const relativePath = normalizePath(path.relative(fixturePath, signal.file))

  if (query.expected.kind && signal.kind !== query.expected.kind) {
    return false
  }

  if (query.expected.handler) {
    const handlerLower = query.expected.handler.toLowerCase()
    const signalNameLower = signal.name.toLowerCase()
    if (!signalNameLower.includes(handlerLower) && !handlerLower.includes(signalNameLower)) {
      return false
    }
  }

  if (query.expected.file) {
    if (!relativePath.includes(query.expected.file)) {
      return false
    }
  }

  return true
}

export async function loadMCPResult(fixtureName: string): Promise<MCPResult | null> {
  const filePath = path.join("benchmarks", "mcp", `benchmark-${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as MCPResult
  } catch {
    return null
  }
}
