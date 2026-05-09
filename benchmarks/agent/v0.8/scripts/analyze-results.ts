import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface AgentResult {
  taskId: string
  mode: "no-mcp" | "cs-deterministic" | "cs-embeddings"
  runNumber: number
  filesOpened: string[]
  wrongFilesOpened: string[]
  searchLoops: number
  toolCalls: number
  mcpCalls: number
  charsRead: number
  tokensUsed: number
  timeMs: number
  taskSuccess: boolean
  expectedFilesFound: string[]
  expectedSymbolsFound: string[]
}

interface Task {
  taskId: string
  question: string
  expectedFiles: string[]
  expectedSymbols: string[]
  successCriteria: {
    minExpectedFilesFound: number
    minExpectedSymbolsFound: number
    maxWrongFiles: number
  }
}

interface ComparisonResult {
  mode: string
  taskSuccessRate: number
  avgFilesOpened: number
  avgWrongFiles: number
  avgCharsRead: number
  avgMcpCalls: number
  avgTimeMs: number
  improvementVsBaseline: {
    taskSuccessDelta: number
    wrongFilesReduction: number
    charsReadReduction: number
  }
}

export function loadResults(resultsDir: string): AgentResult[] {
  const results: AgentResult[] = []

  if (!existsSync(resultsDir)) {
    console.error(`Results directory not found: ${resultsDir}`)
    return results
  }

  const runDirs = readdirSync(resultsDir).filter(d => d.startsWith("run-"))

  for (const runDir of runDirs) {
    const resultPath = path.join(resultsDir, runDir, "agent-results.json")
    if (existsSync(resultPath)) {
      const data = JSON.parse(readFileSync(resultPath, "utf-8"))
      results.push(...(data.results || []))
    }
  }

  return results
}

export function loadTasks(): Task[] {
  const tasksPath = path.join(__dirname, "..", "tasks", "v0.8-tasks.json")
  return JSON.parse(readFileSync(tasksPath, "utf-8")).tasks
}

export function analyzeResults(results: AgentResult[]): Map<string, ComparisonResult> {
  const modes = ["no-mcp", "cs-deterministic", "cs-embeddings"]
  const comparisons = new Map<string, ComparisonResult>()

  for (const mode of modes) {
    const modeResults = results.filter(r => r.mode === mode)
    if (modeResults.length === 0) continue

    const taskSuccessRate = modeResults.filter(r => r.taskSuccess).length / modeResults.length
    const avgFilesOpened = modeResults.reduce((s, r) => s + r.filesOpened.length, 0) / modeResults.length
    const avgWrongFiles = modeResults.reduce((s, r) => s + r.wrongFilesOpened.length, 0) / modeResults.length
    const avgCharsRead = modeResults.reduce((s, r) => s + r.charsRead, 0) / modeResults.length
    const avgMcpCalls = modeResults.reduce((s, r) => s + r.mcpCalls, 0) / modeResults.length
    const avgTimeMs = modeResults.reduce((s, r) => s + r.timeMs, 0) / modeResults.length

    const baselineResults = results.filter(r => r.mode === "no-mcp")
    const baselineSuccessRate = baselineResults.length > 0
      ? baselineResults.filter(r => r.taskSuccess).length / baselineResults.length
      : 0
    const baselineAvgWrong = baselineResults.length > 0
      ? baselineResults.reduce((s, r) => s + r.wrongFilesOpened.length, 0) / baselineResults.length
      : 0
    const baselineAvgChars = baselineResults.length > 0
      ? baselineResults.reduce((s, r) => s + r.charsRead, 0) / baselineResults.length
      : 0

    const wrongFilesReduction = baselineAvgWrong > 0
      ? ((baselineAvgWrong - avgWrongFiles) / baselineAvgWrong) * 100
      : 0

    comparisons.set(mode, {
      mode,
      taskSuccessRate,
      avgFilesOpened,
      avgWrongFiles,
      avgCharsRead,
      avgMcpCalls,
      avgTimeMs,
      improvementVsBaseline: {
        taskSuccessDelta: taskSuccessRate - baselineSuccessRate,
        wrongFilesReduction,
        charsReadReduction: baselineAvgChars > 0
          ? ((baselineAvgChars - avgCharsRead) / baselineAvgChars) * 100
          : 0,
      },
    })
  }

  return comparisons
}

export function printAnalysis(comparisons: Map<string, ComparisonResult>): void {
  console.log("\n" + "=".repeat(60))
  console.log("v0.8 AGENT BENCHMARK ANALYSIS")
  console.log("=".repeat(60))

  const baseline = comparisons.get("no-mcp")
  const csDet = comparisons.get("cs-deterministic")
  const csEmb = comparisons.get("cs-embeddings")

  if (!baseline) {
    console.log("\nNo baseline results found.")
    return
  }

  console.log("\n📊 MODE COMPARISON:")
  console.log("-" .repeat(60))
  console.log(`| Metric              | No MCP    | CS Det.  | CS Emb.  |`)
  console.log(`|---------------------|-----------|----------|----------|`)
  console.log(`| Task Success Rate   | ${(baseline.taskSuccessRate * 100).toFixed(0).padStart(7)}%   | ${csDet ? (csDet.taskSuccessRate * 100).toFixed(0).toFixed(0).padStart(7) + "%" : "N/A".padStart(8)} | ${csEmb ? (csEmb.taskSuccessRate * 100).toFixed(0).toFixed(0).padStart(7) + "%" : "N/A".padStart(8)} |`)
  console.log(`| Avg Files Opened    | ${baseline.avgFilesOpened.toFixed(1).padStart(7)}   | ${csDet ? csDet.avgFilesOpened.toFixed(1).padStart(8) : "N/A".padStart(8)} | ${csEmb ? csEmb.avgFilesOpened.toFixed(1).padStart(8) : "N/A".padStart(8)} |`)
  console.log(`| Avg Wrong Files     | ${baseline.avgWrongFiles.toFixed(1).padStart(7)}   | ${csDet ? csDet.avgWrongFiles.toFixed(1).padStart(8) : "N/A".padStart(8)} | ${csEmb ? csEmb.avgWrongFiles.toFixed(1).padStart(8) : "N/A".padStart(8)} |`)
  console.log(`| Avg Chars Read      | ${baseline.avgCharsRead.toFixed(0).padStart(7)}   | ${csDet ? csDet.avgCharsRead.toFixed(0).padStart(8) : "N/A".padStart(8)} | ${csEmb ? csEmb.avgCharsRead.toFixed(0).padStart(8) : "N/A".padStart(8)} |`)
  console.log(`| Avg MCP Calls       | ${baseline.avgMcpCalls.toFixed(1).padStart(7)}   | ${csDet ? csDet.avgMcpCalls.toFixed(1).padStart(8) : "N/A".padStart(8)} | ${csEmb ? csEmb.avgMcpCalls.toFixed(1).padStart(8) : "N/A".padStart(8)} |`)

  console.log("\n📈 IMPROVEMENT vs BASELINE:")
  console.log("-" .repeat(60))

  for (const [mode, result] of comparisons) {
    if (mode === "no-mcp") continue

    const successDelta = (result.improvementVsBaseline.taskSuccessDelta * 100).toFixed(1)
    const wrongReduction = result.improvementVsBaseline.wrongFilesReduction.toFixed(0)
    const charsReduction = result.improvementVsBaseline.charsReadReduction.toFixed(0)

    const successSymbol = result.improvementVsBaseline.taskSuccessDelta >= 0 ? "✅" : "❌"
    const wrongSymbol = result.improvementVsBaseline.wrongFilesReduction >= 25 ? "✅" : "⚠️"
    const charsSymbol = result.improvementVsBaseline.charsReadReduction >= 25 ? "✅" : "⚠️"

    console.log(`\n${mode.toUpperCase()} vs no-MCP:`)
    console.log(`  Task Success: ${successSymbol} ${successDelta > 0 ? "+" : ""}${successDelta}%`)
    console.log(`  Wrong Files Reduction: ${wrongSymbol} ${wrongReduction}%`)
    console.log(`  Chars Read Reduction: ${charsSymbol} ${charsReduction}%`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("🎯 GO/NO-GO DECISION:")
  console.log("=".repeat(60))

  const csDetResult = comparisons.get("cs-deterministic")
  if (csDetResult) {
    const wrongReduction = csDetResult.improvementVsBaseline.wrongFilesReduction
    const successDelta = csDetResult.improvementVsBaseline.taskSuccessDelta

    if (wrongReduction >= 25 && successDelta >= 0) {
      console.log("  ✅ GO - CS shows >= 25% wrong file reduction with same/better success")
    } else if (wrongReduction >= 15 && successDelta >= -0.05) {
      console.log("  ⚠️ MARGINAL - CS shows partial improvement, consider embeddings")
    } else {
      console.log("  ❌ NO-GO - CS does not meet >= 25% wrong file reduction threshold")
    }
  }

  console.log("\n" + "=".repeat(60))
}

export function saveAnalysis(
  comparisons: Map<string, ComparisonResult>,
  outputPath: string
): void {
  const analysis = Object.fromEntries(comparisons)
  writeFileSync(outputPath, JSON.stringify({ analysis, timestamp: new Date().toISOString() }, null, 2))
  console.log(`\nAnalysis saved to: ${outputPath}`)
}

if (require.main === import.meta.url) {
  const resultsDir = process.argv[2] || path.join(__dirname, "..", "results")
  const outputPath = process.argv[3] || path.join(__dirname, "..", "results", "analysis.json")

  console.log(`Loading results from: ${resultsDir}`)
  const results = loadResults(resultsDir)
  console.log(`Loaded ${results.length} results`)

  if (results.length === 0) {
    console.log("No results found. Run the benchmark first.")
    process.exit(1)
  }

  const comparisons = analyzeResults(results)
  printAnalysis(comparisons)
  saveAnalysis(comparisons, outputPath)
}