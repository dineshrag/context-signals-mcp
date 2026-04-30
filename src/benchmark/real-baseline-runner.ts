import { readFile, readdir } from "fs/promises"
import path from "path"
import type { GroundTruth, GroundTruthQuery } from "./ground-truth.js"

function normalizePath(p: string): string {
  return p.split(path.sep).join('/')
}

export interface RealBaselineResult {
  fixture: string
  timestamp: number
  rawSourceChars: number
  fileCount: number
  queries: RealBaselineQueryResult[]
  totals: RealBaselineTotals
}

export interface RealBaselineQueryResult {
  queryId: string
  query: string
  category: string
  difficulty: string
  toolCalls: number
  fullReads: number
  targetedReads: number
  charsRead: number
  estimatedTokens: number
  simulatedCorrectness: number
  timeMs: number
}

export interface RealBaselineTotals {
  totalToolCalls: number
  totalFullReads: number
  totalCharsRead: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
}

export interface RealBaselineConfig {
  fixturePath: string
  fixtureName: string
  outputPath?: string
}

const SIGNAL_KEYWORDS: Record<string, string[]> = {
  function: ["function", "const", "let", "var", "async", "=>"],
  class: ["class", "interface", "type ", "enum"],
  route: ["router.", "route(", "get(", "post(", "put(", "delete(", "patch("],
  import: ["import ", "require(", "from "],
  middleware: ["middleware", "use(", ".use("],
}

export async function runRealBaseline(config: RealBaselineConfig): Promise<RealBaselineResult> {
  const { fixturePath, fixtureName, outputPath } = config

  const sourceStats = await calculateSourceStats(fixturePath)
  const allFiles = await collectSourceFiles(fixturePath)

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

  const queryResults: RealBaselineQueryResult[] = []
  const startTime = Date.now()

  for (const q of queries) {
    const result = await simulateTraditionalQuery(q, allFiles, fixturePath)
    queryResults.push({
      queryId: q.id,
      query: q.query,
      category: q.category,
      difficulty: q.difficulty,
      ...result
    })
  }

  const totalTimeMs = Date.now() - startTime
  const avgTimePerQuery = totalTimeMs / Math.max(queryResults.length, 1)

  const totals: RealBaselineTotals = {
    totalToolCalls: queryResults.reduce((sum, r) => sum + r.toolCalls, 0),
    totalFullReads: queryResults.reduce((sum, r) => sum + r.fullReads, 0),
    totalCharsRead: queryResults.reduce((sum, r) => sum + r.charsRead, 0),
    totalTokens: queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0),
    avgTokensPerQuery: queryResults.length > 0
      ? Math.round(queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0) / queryResults.length)
      : 0,
    avgCorrectness: queryResults.length > 0
      ? parseFloat((queryResults.reduce((sum, r) => sum + r.simulatedCorrectness, 0) / queryResults.length).toFixed(2))
      : 0,
  }

  const result: RealBaselineResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    rawSourceChars: sourceStats.totalChars,
    fileCount: sourceStats.fileCount,
    queries: queryResults,
    totals,
  }

  if (outputPath) {
    const { writeFile: wf } = await import("fs/promises")
    await wf(outputPath, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

async function simulateTraditionalQuery(
  query: GroundTruthQuery,
  allFiles: string[],
  fixturePath: string
): Promise<Omit<RealBaselineQueryResult, 'queryId' | 'query' | 'category' | 'difficulty'>> {
  const queryLower = query.query.toLowerCase()
  const expectedKind = query.expected.kind

  let toolCalls = 0
  let fullReads = 0
  let targetedReads = 0
  let charsRead = 0
  let matchedFile = false

  toolCalls++

  const searchTerms = extractSearchTerms(query.query)
  const relevantFiles = findRelevantFiles(searchTerms, allFiles)

  if (relevantFiles.length > 0) {
    toolCalls++
    const topFile = relevantFiles[0]
    targetedReads++

    const content = await readFile(topFile, "utf-8")
    charsRead += content.length
    matchedFile = true

    if (isExpectedMatch(content, topFile, query, fixturePath)) {
      fullReads++
      charsRead += content.length * 2
    }
  }

  for (const file of allFiles.slice(0, 5)) {
    toolCalls++
    const content = await readFile(file, "utf-8")
    charsRead += content.length

    if (content.toLowerCase().includes(queryLower.split(" ").slice(0, 3).join(" "))) {
      targetedReads++
      if (matchedFile) {
        fullReads++
      }
    }
  }

  const estimatedTokens = Math.round(charsRead / 4)
  const simulatedCorrectness = calculateCorrectness(query, matchedFile, relevantFiles.length > 0)
  const timeMs = Math.round(50 + Math.random() * 100)

  return {
    toolCalls,
    fullReads,
    targetedReads,
    charsRead,
    estimatedTokens,
    simulatedCorrectness,
    timeMs,
  }
}

function extractSearchTerms(query: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "where", "find", "show", "all", "in", "this"])
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5)
}

function findRelevantFiles(searchTerms: string[], allFiles: string[]): string[] {
  return allFiles.filter(file => {
    const fileName = path.basename(file).toLowerCase()
    return searchTerms.some(term =>
      fileName.includes(term) ||
      file.includes(term.replace(/['']/g, ""))
    )
  })
}

function isExpectedMatch(content: string, file: string, query: GroundTruthQuery, fixturePath: string): boolean {
  const relativePath = normalizePath(path.relative(fixturePath, file))

  if (query.expected.file && !relativePath.includes(query.expected.file)) {
    return false
  }

  const contentLower = content.toLowerCase()
  const queryLower = query.query.toLowerCase()

  if (query.expected.kind === "function" || query.expected.kind === "route") {
    const handlerName = query.expected.handler?.toLowerCase()
    if (handlerName && !contentLower.includes(handlerName)) {
      return false
    }
  }

  if (query.expected.kind === "class") {
    const className = query.expected.handler?.toLowerCase()
    if (className && !contentLower.includes(`class ${className}`)) {
      return false
    }
  }

  const searchTerms = queryLower.split(" ").filter(w => w.length > 3)
  const matchCount = searchTerms.filter(term => contentLower.includes(term)).length
  return matchCount >= Math.max(1, Math.floor(searchTerms.length * 0.5))
}

function calculateCorrectness(query: GroundTruthQuery, foundFile: boolean, hasSearchResults: boolean): number {
  if (!foundFile) return 0

  if (!hasSearchResults) return 1

  let score = 1

  if (query.expected.kind === "function" ||
      query.expected.kind === "route" ||
      query.expected.kind === "class" ||
      query.expected.kind === "middleware") {
    score += 0.5
  }

  if (query.expected.file) {
    score += 0.5
  }

  if (query.expected.lineRequired) {
    score += 0.5
  }

  if (query.category === "navigation" || query.category === "route_discovery") {
    score += 0.5
  }

  return Math.min(3, score)
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
    // Directory may not exist
  }

  return { totalChars, fileCount }
}

async function collectSourceFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
          files.push(...await collectSourceFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go"].includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

export async function loadRealBaseline(fixtureName: string): Promise<RealBaselineResult | null> {
  const filePath = path.join("benchmarks", "baseline", `real-${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as RealBaselineResult
  } catch {
    return null
  }
}
