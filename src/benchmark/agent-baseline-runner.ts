import { readdir, readFile } from "fs/promises"
import path from "path"
import type { GroundTruthQuery } from "./ground-truth.js"

export interface BaselineQueryResult {
  queryId: string
  query: string
  category: string
  difficulty: string
  toolCalls: number
  fullReads: number
  targetedReads: number
  charsRead: number
  estimatedTokens: number
  correctness: number
  timeMs: number
}

export interface BaselineTotals {
  totalToolCalls: number
  totalFullReads: number
  totalCharsRead: number
  totalTokens: number
  avgTokensPerQuery: number
  avgCorrectness: number
}

export interface BaselineResult {
  fixture: string
  timestamp: number
  rawSourceChars: number
  fileCount: number
  queries: BaselineQueryResult[]
  totals: BaselineTotals
}

export interface BaselineConfig {
  fixturePath: string
  fixtureName: string
  outputPath?: string
}

export async function runAgentBaseline(config: BaselineConfig): Promise<BaselineResult> {
  const { fixturePath, fixtureName, outputPath } = config

  const sourceStats = await calculateSourceStats(fixturePath)
  const allFiles = await collectSourceFiles(fixturePath)

  const groundTruthPath = path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
  let queries: GroundTruthQuery[] = []

  try {
    const groundTruthContent = await readFile(groundTruthPath, "utf-8")
    const groundTruth = JSON.parse(groundTruthContent)
    queries = groundTruth.queries
  } catch (error) {
    console.warn(`Could not load ground truth for ${fixtureName}: ${error}`)
    queries = []
  }

  const queryResults: BaselineQueryResult[] = []
  const startTime = Date.now()

  for (const q of queries) {
    const result = await simulateAgentQuery(q, allFiles, fixturePath)
    queryResults.push({
      queryId: q.id,
      query: q.query,
      category: q.category,
      difficulty: q.difficulty,
      ...result
    })
  }

  const totalTimeMs = Date.now() - startTime

  const totals: BaselineTotals = {
    totalToolCalls: queryResults.reduce((sum, r) => sum + r.toolCalls, 0),
    totalFullReads: queryResults.reduce((sum, r) => sum + r.fullReads, 0),
    totalCharsRead: queryResults.reduce((sum, r) => sum + r.charsRead, 0),
    totalTokens: queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0),
    avgTokensPerQuery: queryResults.length > 0
      ? Math.round(queryResults.reduce((sum, r) => sum + r.estimatedTokens, 0) / queryResults.length)
      : 0,
    avgCorrectness: queryResults.length > 0
      ? parseFloat((queryResults.reduce((sum, r) => sum + r.correctness, 0) / queryResults.length).toFixed(2))
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
    const { writeFile } = await import("fs/promises")
    await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

async function simulateAgentQuery(
  query: GroundTruthQuery,
  allFiles: string[],
  fixturePath: string
): Promise<Omit<BaselineQueryResult, 'queryId' | 'query' | 'category' | 'difficulty'>> {
  const startTime = Date.now()

  let toolCalls = 0
  let fullReads = 0
  let targetedReads = 0
  let charsRead = 0
  let correctness = 0

  const searchTerms = extractSearchTerms(query.query)

  toolCalls++
  const relevantFiles = findRelevantFiles(searchTerms, allFiles, query, fixturePath)

  if (relevantFiles.length > 0) {
    targetedReads++
    const topFile = relevantFiles[0]

    const content = await readFile(topFile, "utf-8")
    charsRead += content.length

    const isCorrectFile = checkCorrectFile(topFile, query, fixturePath)
    const isCorrectHandler = checkHandler(content, query)

    if (isCorrectFile && isCorrectHandler) {
      correctness = 3
      fullReads++
      charsRead += content.length
    } else if (isCorrectFile) {
      correctness = 2
      for (const file of relevantFiles.slice(0, 2)) {
        if (file !== topFile) {
          const c = await readFile(file, "utf-8")
          charsRead += c.length
          fullReads++
        }
      }
    } else {
      correctness = 1
      for (const file of relevantFiles.slice(0, 3)) {
        const c = await readFile(file, "utf-8")
        charsRead += c.length
        fullReads++
      }
    }
  } else {
    correctness = 0
    for (const file of allFiles.slice(0, 5)) {
      const content = await readFile(file, "utf-8")
      charsRead += content.length
      fullReads++
    }
  }

  const timeMs = Date.now() - startTime
  const estimatedTokens = Math.round(charsRead / 4)

  return {
    toolCalls,
    fullReads,
    targetedReads,
    charsRead,
    estimatedTokens,
    correctness,
    timeMs,
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

function findRelevantFiles(searchTerms: string[], allFiles: string[], query: GroundTruthQuery, fixturePath: string): string[] {
  return allFiles.filter(file => {
    const fileName = path.basename(file).toLowerCase()
    const relativePath = normalizePath(path.relative(fixturePath, file))

    if (query.expected.file && !relativePath.includes(query.expected.file.toLowerCase())) {
      return false
    }

    return searchTerms.some(term => {
      const cleanTerm = term.replace(/['']/g, "")
      return fileName.includes(cleanTerm) ||
             relativePath.includes(cleanTerm) ||
             fileName.includes(query.query.toLowerCase().split(" ").slice(0, 2).join(" "))
    })
  }).sort((a, b) => {
    const aName = path.basename(a).toLowerCase()
    const bName = path.basename(b).toLowerCase()
    const queryLower = query.query.toLowerCase()

    const aRelevance = searchTerms.filter(t => aName.includes(t)).length +
                      (aName.includes("route") || aName.includes("handler") ? 1 : 0)
    const bRelevance = searchTerms.filter(t => bName.includes(t)).length +
                      (bName.includes("route") || bName.includes("handler") ? 1 : 0)

    return bRelevance - aRelevance
  })
}

function normalizePath(p: string): string {
  return p.split(path.sep).join('/')
}

function checkMatch(content: string, file: string, query: GroundTruthQuery, fixturePath: string): boolean {
  const relativePath = normalizePath(path.relative(fixturePath, file))

  if (query.expected.file && !relativePath.includes(query.expected.file)) {
    return false
  }

  const contentLower = content.toLowerCase()

  if (query.expected.kind === "function" || query.expected.kind === "route") {
    if (query.expected.handler) {
      const handlerLower = query.expected.handler.toLowerCase()
      if (!contentLower.includes(handlerLower)) {
        return false
      }
    }
  }

  if (query.expected.kind === "class" || query.expected.kind === "interface") {
    if (query.expected.handler) {
      const classLower = query.expected.handler.toLowerCase()
      if (!contentLower.includes(`class ${classLower}`) && !contentLower.includes(`interface ${classLower}`)) {
        return false
      }
    }
  }

  if (query.expected.kind === "middleware") {
    if (!contentLower.includes("middleware") && !contentLower.includes("use(")) {
      return false
    }
  }

  return true
}

function checkCorrectFile(file: string, query: GroundTruthQuery, fixturePath: string): boolean {
  const relativePath = normalizePath(path.relative(fixturePath, file))

  if (query.expected.file && !relativePath.includes(query.expected.file)) {
    return false
  }

  return true
}

function checkHandler(content: string, query: GroundTruthQuery): boolean {
  const contentLower = content.toLowerCase()

  if (query.expected.kind === "function" || query.expected.kind === "route") {
    if (query.expected.handler) {
      const handlerLower = query.expected.handler.toLowerCase()
      if (!contentLower.includes(handlerLower)) {
        return false
      }
    }
  }

  if (query.expected.kind === "class" || query.expected.kind === "interface") {
    if (query.expected.handler) {
      const classLower = query.expected.handler.toLowerCase()
      if (!contentLower.includes(`class ${classLower}`) && !contentLower.includes(`interface ${classLower}`)) {
        return false
      }
    }
  }

  if (query.expected.kind === "middleware") {
    if (!contentLower.includes("middleware") && !contentLower.includes("use(")) {
      return false
    }
  }

  return true
}

let fixturePath = ""

async function calculateSourceStats(dirPath: string): Promise<{ totalChars: number; fileCount: number }> {
  fixturePath = dirPath
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
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          const content = await readFile(path.join(dirPath, entry.name), "utf-8")
          totalChars += content.length
          fileCount++
        }
      }
    }
  } catch {
    // Ignore
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
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Ignore
  }

  return files
}

export async function loadBaseline(fixtureName: string): Promise<BaselineResult | null> {
  const filePath = path.join("benchmarks", "baseline", `agent-${fixtureName}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as BaselineResult
  } catch {
    return null
  }
}
