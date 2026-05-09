import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface NavigationTask {
  taskId: string
  query: string
  goal: string
  expectedFiles: string[]
  expectedSymbols: string[]
  successCriteria: {
    maxFileOpens: number
    maxWrongFiles: number
  }
}

export interface NavigationResult {
  taskId: string
  mode: "baseline" | "context-signals"
  query: string
  filesOpened: string[]
  searchCalls: number
  wrongFilesOpened: string[]
  stepsToGroundTruth: number
  topKSuccess: boolean
  topK: number
  timeMs: number
  charsRead: number
  groundTruthFound: boolean
}

export interface NavigationComparison {
  taskId: string
  baseline: NavigationResult
  cs: NavigationResult
  fileOpenReduction: number
  charsReadReduction: number
  stepsReduction: number
}

function loadNavigationTasks(): NavigationTask[] {
  const tasksPath = path.join(__dirname, "..", "..", "benchmarks", "navigation-tasks.json")
  const content = fs.readFileSync(tasksPath, "utf-8")
  const data = JSON.parse(content)
  return data.tasks || []
}

function loadSignals(projectPath: string): any[] {
  const signalsPath = path.join(projectPath, "signals.json")
  if (!fs.existsSync(signalsPath)) return []
  const content = fs.readFileSync(signalsPath, "utf-8")
  const data = JSON.parse(content)
  return data.signals || data
}

function loadAllFiles(projectPath: string): string[] {
  const files: string[] = []
  collectFiles(projectPath, files, [".ts", ".js", ".tsx", ".jsx", ".py"])
  return files
}

function collectFiles(dir: string, files: string[], extensions: string[]): void {
  if (dir.includes("node_modules")) return
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        collectFiles(fullPath, files, extensions)
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  } catch {
  }
}

function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch {
    return ""
  }
}

function checkFileContainsSymbol(filePath: string, symbols: string[], content?: string): boolean {
  const fileContent = content || readFileContent(filePath)
  return symbols.some(s => fileContent.includes(s))
}

function checkFileMatchesExpected(filePath: string, expectedFiles: string[]): boolean {
  const normalizedFile = filePath.replace(/\\/g, "/").toLowerCase()
  return expectedFiles.some(ef => normalizedFile.includes(ef.toLowerCase()))
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase()
}

export function runBaselineNavigation(
  task: NavigationTask,
  projectPath: string,
  files: string[]
): NavigationResult {
  const startTime = Date.now()
  const filesOpened: string[] = []
  const wrongFilesOpened: string[] = []
  let searchCalls = 0
  let charsRead = 0

  const queryTerms = task.query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

  const candidateFiles = files.filter(f => {
    const content = readFileContent(f)
    searchCalls++
    return queryTerms.some(term => content.toLowerCase().includes(term))
  })

  candidateFiles.sort((a, b) => {
    const contentA = readFileContent(a)
    const contentB = readFileContent(b)
    const matchesA = queryTerms.filter(t => contentA.toLowerCase().includes(t)).length
    const matchesB = queryTerms.filter(t => contentB.toLowerCase().includes(t)).length
    return matchesB - matchesA
  })

  let groundTruthFound = false
  let stepsToGroundTruth = -1

  const maxOpens = task.successCriteria.maxFileOpens

  for (let i = 0; i < Math.min(candidateFiles.length, maxOpens + 5); i++) {
    const file = candidateFiles[i]
    if (filesOpened.includes(file)) continue

    filesOpened.push(file)
    const content = readFileContent(file)
    charsRead += content.length

    const containsExpectedFile = checkFileMatchesExpected(file, task.expectedFiles)
    const containsSymbol = checkFileContainsSymbol(file, task.expectedSymbols, content)

    if (containsExpectedFile || containsSymbol) {
      groundTruthFound = true
      if (stepsToGroundTruth === -1) {
        stepsToGroundTruth = filesOpened.length
      }
      break
    }

    if (filesOpened.length >= maxOpens && !groundTruthFound) {
      wrongFilesOpened.push(file)
    }
  }

  const topKFiles = candidateFiles.slice(0, task.successCriteria.maxFileOpens)
  const topKSuccess = topKFiles.some(f =>
    checkFileMatchesExpected(f, task.expectedFiles) ||
    checkFileContainsSymbol(f, task.expectedSymbols)
  )

  return {
    taskId: task.taskId,
    mode: "baseline",
    query: task.query,
    filesOpened,
    searchCalls,
    wrongFilesOpened,
    stepsToGroundTruth: stepsToGroundTruth === -1 ? filesOpened.length : stepsToGroundTruth,
    topKSuccess,
    topK: task.successCriteria.maxFileOpens,
    timeMs: Date.now() - startTime,
    charsRead,
    groundTruthFound,
  }
}

export function runCSNavigation(
  task: NavigationTask,
  projectPath: string,
  signals: any[],
  limit: number = 10
): NavigationResult {
  const startTime = Date.now()
  const filesOpened: string[] = []
  const wrongFilesOpened: string[] = []
  let searchCalls = 1
  let charsRead = 0

  const queryTerms = task.query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

  const scoredSignals = signals.map(signal => {
    let score = 0
    const nameLower = (signal.name || "").toLowerCase()
    const textLower = (signal.text || "").toLowerCase()
    const tagsLower = (signal.tags || []).join(" ").toLowerCase()

    for (const term of queryTerms) {
      if (nameLower.includes(term)) score += 3
      if (textLower.includes(term)) score += 1
      if (tagsLower.includes(term)) score += 2
      if (signal.file?.toLowerCase().includes(term)) score += 2
    }

    return { signal, score }
  })

  scoredSignals.sort((a, b) => b.score - a.score)
  const topSignals = scoredSignals.slice(0, limit).map(s => s.signal)

  let groundTruthFound = false
  let stepsToGroundTruth = -1

  const maxOpens = task.successCriteria.maxFileOpens

  for (const signal of topSignals) {
    if (filesOpened.length >= maxOpens + 5) break

    const filePath = path.join(projectPath, signal.file)
    if (filesOpened.some(f => normalizeFilePath(f) === normalizeFilePath(filePath))) continue

    if (!fs.existsSync(filePath)) continue

    filesOpened.push(filePath)
    const content = readFileContent(filePath)
    charsRead += content.length

    const containsExpectedFile = checkFileMatchesExpected(filePath, task.expectedFiles)
    const containsSymbol = checkFileContainsSymbol(filePath, task.expectedSymbols, content)

    if (containsExpectedFile || containsSymbol) {
      groundTruthFound = true
      if (stepsToGroundTruth === -1) {
        stepsToGroundTruth = filesOpened.length
      }
      break
    }

    if (filesOpened.length > maxOpens && !groundTruthFound) {
      wrongFilesOpened.push(filePath)
    }
  }

  const topKFiles = topSignals.slice(0, task.successCriteria.maxFileOpens).map(s =>
    path.join(projectPath, s.file)
  )
  const topKSuccess = topKFiles.some(f =>
    checkFileMatchesExpected(f, task.expectedFiles) ||
    checkFileContainsSymbol(f, task.expectedSymbols)
  )

  return {
    taskId: task.taskId,
    mode: "context-signals",
    query: task.query,
    filesOpened,
    searchCalls,
    wrongFilesOpened,
    stepsToGroundTruth: stepsToGroundTruth === -1 ? filesOpened.length : stepsToGroundTruth,
    topKSuccess,
    topK: task.successCriteria.maxFileOpens,
    timeMs: Date.now() - startTime,
    charsRead,
    groundTruthFound,
  }
}

export function runNavigationBenchmark(
  projectName: string,
  projectPath: string
): { baselineResults: NavigationResult[]; csResults: NavigationResult[]; comparisons: NavigationComparison[] } {
  const tasks = loadNavigationTasks().filter(t => t.taskId.startsWith(projectName.split("-")[0] + "-nav"))

  const signals = loadSignals(projectPath)
  const files = loadAllFiles(projectPath)

  console.log(`\n=== ${projectName.toUpperCase()} Navigation Benchmark ===`)
  console.log(`Tasks: ${tasks.length}, Signals: ${signals.length}, Files: ${files.length}`)

  const baselineResults: NavigationResult[] = []
  const csResults: NavigationResult[] = []
  const comparisons: NavigationComparison[] = []

  for (const task of tasks) {
    const baseline = runBaselineNavigation(task, projectPath, files)
    const cs = runCSNavigation(task, projectPath, signals)

    baselineResults.push(baseline)
    csResults.push(cs)

    const fileOpenReduction = baseline.filesOpened.length > 0
      ? ((baseline.filesOpened.length - cs.filesOpened.length) / baseline.filesOpened.length) * 100
      : 0

    const charsReadReduction = baseline.charsRead > 0
      ? ((baseline.charsRead - cs.charsRead) / baseline.charsRead) * 100
      : 0

    const stepsReduction = baseline.stepsToGroundTruth > 0 && cs.stepsToGroundTruth > 0
      ? ((baseline.stepsToGroundTruth - cs.stepsToGroundTruth) / baseline.stepsToGroundTruth) * 100
      : 0

    comparisons.push({
      taskId: task.taskId,
      baseline,
      cs,
      fileOpenReduction,
      charsReadReduction,
      stepsReduction,
    })

    const baselineStatus = baseline.groundTruthFound ? "FOUND" : "MISS"
    const csStatus = cs.groundTruthFound ? "FOUND" : "MISS"
    const improved = baseline.groundTruthFound !== cs.groundTruthFound || cs.filesOpened.length < baseline.filesOpened.length

    console.log(`  ${task.taskId}: baseline=${baselineStatus} (${baseline.filesOpened.length} files), cs=${csStatus} (${cs.filesOpened.length} files) ${improved ? "IMPROVED" : ""}`)
  }

  return { baselineResults, csResults, comparisons }
}

export function printNavigationSummary(
  baselineResults: NavigationResult[],
  csResults: NavigationResult[],
  comparisons: NavigationComparison[]
): void {
  const avgFileOpensBaseline = baselineResults.reduce((s, r) => s + r.filesOpened.length, 0) / baselineResults.length
  const avgFileOpensCS = csResults.reduce((s, r) => s + r.filesOpened.length, 0) / csResults.length

  const avgCharsBaseline = baselineResults.reduce((s, r) => s + r.charsRead, 0) / baselineResults.length
  const avgCharsCS = csResults.reduce((s, r) => s + r.charsRead, 0) / csResults.length

  const avgStepsBaseline = baselineResults.reduce((s, r) => s + r.stepsToGroundTruth, 0) / baselineResults.length
  const avgStepsCS = csResults.reduce((s, r) => s + r.stepsToGroundTruth, 0) / csResults.length

  const top5Baseline = baselineResults.filter(r => r.topKSuccess).length / baselineResults.length
  const top5CS = csResults.filter(r => r.topKSuccess).length / csResults.length

  const foundBaseline = baselineResults.filter(r => r.groundTruthFound).length / baselineResults.length
  const foundCS = csResults.filter(r => r.groundTruthFound).length / csResults.length

  const fileOpenReduction = avgFileOpensBaseline > 0
    ? ((avgFileOpensBaseline - avgFileOpensCS) / avgFileOpensBaseline) * 100
    : 0

  console.log("\n" + "=".repeat(50))
  console.log("NAVIGATION BENCHMARK SUMMARY")
  console.log("=".repeat(50))
  console.log(`\nAvg File Opens: baseline=${avgFileOpensBaseline.toFixed(1)}, cs=${avgFileOpensCS.toFixed(1)} (${fileOpenReduction.toFixed(0)}% reduction)`)
  console.log(`Avg Chars Read: baseline=${avgCharsBaseline.toFixed(0)}, cs=${avgCharsCS.toFixed(0)}`)
  console.log(`Avg Steps to Ground Truth: baseline=${avgStepsBaseline.toFixed(1)}, cs=${avgStepsCS.toFixed(1)}`)
  console.log(`Top-5 Success Rate: baseline=${(top5Baseline * 100).toFixed(0)}%, cs=${(top5CS * 100).toFixed(0)}%`)
  console.log(`Ground Truth Found: baseline=${(foundBaseline * 100).toFixed(0)}%, cs=${(foundCS * 100).toFixed(0)}%`)
}

export function saveNavigationResults(
  projectName: string,
  baselineResults: NavigationResult[],
  csResults: NavigationResult[],
  comparisons: NavigationComparison[]
): void {
  const outputDir = path.join(__dirname, "..", "results", `${projectName}-v0.7-navigation`)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const data = {
    project: projectName,
    version: "v0.7-navigation-benchmark",
    timestamp: new Date().toISOString(),
    baselineResults,
    csResults,
    comparisons,
    summary: {
      avgFileOpensBaseline: baselineResults.reduce((s, r) => s + r.filesOpened.length, 0) / baselineResults.length,
      avgFileOpensCS: csResults.reduce((s, r) => s + r.filesOpened.length, 0) / csResults.length,
      avgCharsBaseline: baselineResults.reduce((s, r) => s + r.charsRead, 0) / baselineResults.length,
      avgCharsCS: csResults.reduce((s, r) => s + r.charsRead, 0) / csResults.length,
      fileOpenReduction: (baselineResults.reduce((s, r) => s + r.filesOpened.length, 0) / baselineResults.length) > 0
        ? ((baselineResults.reduce((s, r) => s + r.filesOpened.length, 0) / baselineResults.length -
            csResults.reduce((s, r) => s + r.filesOpened.length, 0) / csResults.length) /
            (baselineResults.reduce((s, r) => s + r.filesOpened.length, 0) / baselineResults.length)) * 100
        : 0,
    },
  }

  fs.writeFileSync(path.join(outputDir, "results.json"), JSON.stringify(data, null, 2))
  console.log(`\nResults saved to: ${outputDir}`)
}