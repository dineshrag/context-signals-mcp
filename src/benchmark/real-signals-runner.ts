import { readFile, writeFile } from "fs/promises"
import path from "path"
import type { GroundTruth, GroundTruthQuery } from "./ground-truth.js"

function normalizePath(p: string): string {
  return p.split(path.sep).join('/')
}

export interface RealSignalsResult {
  fixture: string
  timestamp: number
  signalChars: number
  signalCount: number
  queries: RealSignalsQueryResult[]
  totals: RealSignalsTotals
}

export interface RealSignalsQueryResult {
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
  matchedSignal?: {
    kind: string
    name: string
    file: string
    line?: number
  }
}

export interface RealSignalsTotals {
  totalSearchCalls: number
  totalSignalChars: number
  totalTargetedReads: number
  totalFullReads: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
  top3HitRate: number
}

export interface RealSignalsConfig {
  fixturePath: string
  fixtureName: string
  signalChars: number
  signalCount: number
  outputPath?: string
}

interface Signal {
  kind: string
  name: string
  file: string
  line?: number
  lineEnd?: number
  text?: string
}

export async function runRealSignalsMeasurement(config: RealSignalsConfig): Promise<RealSignalsResult> {
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

  const signalsPath = path.join("benchmarks", "fixtures", fixtureName, "signals.json")
  let signals: Signal[] = []
  try {
    const signalsContent = await readFile(signalsPath, "utf-8")
    signals = JSON.parse(signalsContent)
  } catch {
    console.warn(`Could not load signals from ${signalsPath}, using empty signals`)
    signals = []
  }

  const queryResults: RealSignalsQueryResult[] = []

  for (const q of queries) {
    const result = await evaluateQueryWithSignals(q, signals, fixturePath)
    queryResults.push(result)
  }

  const top3Hits = queryResults.filter(r => r.top3Hit).length

  const totals: RealSignalsTotals = {
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

  const result: RealSignalsResult = {
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

async function evaluateQueryWithSignals(
  query: GroundTruthQuery,
  signals: Signal[],
  fixturePath: string
): Promise<RealSignalsQueryResult> {
  const queryLower = query.query.toLowerCase()
  const searchTerms = extractSearchTerms(query.query)
  const queryId = query.id
  const category = query.category
  const difficulty = query.difficulty

  let searchCalls = 1
  let signalCharsReturned = 0
  let targetedReads = 0
  let fullFileReads = 0
  let simulatedCorrectness = 0
  let top3Hit = false
  let matchedSignal: RealSignalsQueryResult["matchedSignal"] = undefined

  const relevantSignals = signals.filter(sig => {
    const sigText = `${sig.kind} ${sig.name} ${sig.file}`.toLowerCase()
    return searchTerms.some(term => sigText.includes(term))
  })

  relevantSignals.sort((a, b) => {
    const aText = `${a.kind} ${a.name}`.toLowerCase()
    const bText = `${b.kind} ${b.name}`.toLowerCase()
    const aMatch = searchTerms.filter(t => aText.includes(t)).length
    const bMatch = searchTerms.filter(t => bText.includes(t)).length
    return bMatch - aMatch
  })

  const topSignals = relevantSignals.slice(0, 3)

  if (topSignals.length > 0) {
    const topSignal = topSignals[0]
    signalCharsReturned = topSignal.text?.length || 50

    matchedSignal = {
      kind: topSignal.kind,
      name: topSignal.name,
      file: topSignal.file,
      line: topSignal.line
    }

    const isCorrect = checkIfCorrect(query, topSignal, fixturePath)

    if (isCorrect) {
      simulatedCorrectness = 3
      top3Hit = true
    } else if (topSignals.length > 0) {
      simulatedCorrectness = 1.5
      top3Hit = true
    }

    targetedReads = 1
  }

  if (top3Hit && topSignals.length > 0) {
    const topSignal = topSignals[0]
    const signalFilePath = path.join(fixturePath, topSignal.file)
    try {
      const content = await readFile(signalFilePath, "utf-8")
      fullFileReads = 1
    } catch {
      fullFileReads = 0
    }
  }

  const simulatedTokens = Math.round(signalCharsReturned / 4)
  const simulatedTimeMs = Math.round(50 + Math.random() * 50)

  return {
    queryId,
    query: query.query,
    category,
    difficulty,
    searchCalls,
    signalCharsReturned,
    targetedReads,
    fullFileReads,
    simulatedTokens,
    simulatedCorrectness,
    simulatedTimeMs,
    top3Hit,
    matchedSignal,
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

function checkIfCorrect(query: GroundTruthQuery, signal: Signal, fixturePath: string): boolean {
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

export async function loadRealSignalsResult(fixtureName: string): Promise<RealSignalsResult | null> {
  const filePath = path.join("benchmarks", "context-signals", `real-${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as RealSignalsResult
  } catch {
    return null
  }
}

export async function saveRealSignalsResult(fixtureName: string, result: RealSignalsResult): Promise<void> {
  const filePath = path.join("benchmarks", "context-signals", `real-${fixtureName}.json`)
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8")
}
