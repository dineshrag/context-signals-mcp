#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface BenchmarkConfig {
  projectName: string
  projectPath: string
  queriesPath: string
  groundTruthPath: string
  outputPath: string
}

interface BenchmarkQuery {
  id: string
  query: string
  type: "simple" | "multi-hop" | "architectural" | "failure-case"
  category: string
  expected: {
    kind?: string
    fileContains?: string[]
    nameContains?: string
    functionNameContains?: string
    requiresLine: boolean
  }
}

interface GroundTruthEntry {
  queryId: string
  query: string
  expectedFile?: string
  expectedSymbol?: string
  expectedLine?: number
  matchCriteria: Record<string, any>
}

interface BenchmarkResult {
  mode: "baseline" | "context-signals"
  queryId: string
  query: string
  hit: boolean
  charsRead: number
  latencyMs: number
  topResult?: {
    file: string
    name: string
    kind: string
    lineStart?: number
  }
}

interface ComparisonReport {
  runId: string
  timestamp: number
  project: string
  baseline: {
    top3HitRate: number
    avgCharsRead: number
    totalLatencyMs: number
    results: BenchmarkResult[]
  }
  contextSignals: {
    top3HitRate: number
    avgCharsRead: number
    totalLatencyMs: number
    results: BenchmarkResult[]
  }
  comparison: {
    hitRateImprovement: number
    charsSavedPercent: number
    contextSignalsWins: number
    baselineWins: number
  }
}

function generateRunId(): string {
  const chars = "abcdef0123456789"
  let result = ""
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

async function loadQueries(queriesPath: string): Promise<BenchmarkQuery[]> {
  if (!fs.existsSync(queriesPath)) {
    console.error(`Queries file not found: ${queriesPath}`)
    return []
  }
  const content = fs.readFileSync(queriesPath, "utf-8")
  const data = JSON.parse(content)
  return data.queries || []
}

async function loadGroundTruth(gtPath: string): Promise<GroundTruthEntry[]> {
  if (!fs.existsSync(gtPath)) {
    console.error(`Ground truth file not found: ${gtPath}`)
    return []
  }
  const content = fs.readFileSync(gtPath, "utf-8")
  const data = JSON.parse(content)
  return data.groundTruth || []
}

function findFiles(rootPath: string, extensions: string[]): string[] {
  const files: string[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !["node_modules", "venv", ".venv", "__pycache__"].includes(entry.name)) {
          walk(fullPath)
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  }

  walk(rootPath)
  return files
}

function findInContent(files: string[], terms: string[]): { file: string; line: number; text: string }[] {
  const results: { file: string; line: number; text: string }[] = []

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8")
      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lower = line.toLowerCase()
        if (terms.some(term => lower.includes(term))) {
          results.push({ file, line: i + 1, text: line.trim() })
        }
      }
    } catch {}
  }

  return results
}

function matchAgainstGroundTruth(
  result: { file: string; name?: string; kind: string; lineStart?: number },
  groundTruth: GroundTruthEntry
): boolean {
  const criteria = groundTruth.matchCriteria

  if (criteria.kind && result.kind !== criteria.kind) return false

  if (criteria.fileContains) {
    const fileLower = result.file.toLowerCase()
    const match = criteria.fileContains.some((term: string) => fileLower.includes(term.toLowerCase()))
    if (!match) return false
  }

  if (criteria.functionNameContains && result.name) {
    const names = Array.isArray(criteria.functionNameContains)
      ? criteria.functionNameContains
      : [criteria.functionNameContains]
    const nameLower = result.name.toLowerCase()
    if (!names.some((n: string) => nameLower.includes(n.toLowerCase()))) return false
  }

  if (criteria.nameContains && result.name) {
    if (!result.name.toLowerCase().includes(criteria.nameContains.toLowerCase())) return false
  }

  return true
}

async function runBaselineMode(
  config: BenchmarkConfig,
  queries: BenchmarkQuery[],
  groundTruth: GroundTruthEntry[]
): Promise<{ results: BenchmarkResult[], charsRead: number, latencyMs: number }> {
  console.log("\n📊 Running BASELINE mode (grep + file reads)...")
  console.log(`   Project: ${config.projectName}`)
  console.log(`   Path: ${config.projectPath}`)

  const pythonFiles = findFiles(config.projectPath, [".py"])
  const tsFiles = findFiles(config.projectPath, [".ts", ".tsx", ".js", ".jsx"])
  const allFiles = [...pythonFiles, ...tsFiles]

  console.log(`   Files found: ${allFiles.length}`)

  const results: BenchmarkResult[] = []
  let totalChars = 0
  let totalLatency = 0

  for (const query of queries) {
    const startTime = Date.now()
    const queryTerms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    const matches = findInContent(allFiles, queryTerms)

    const top3 = matches.slice(0, 3)

    let charsRead = 0
    for (const match of top3) {
      try {
        const content = fs.readFileSync(match.file, "utf-8")
        charsRead += content.length
      } catch {}
    }

    const gt = groundTruth.find(g => g.queryId === query.id)
    let hit = false
    let topResult: BenchmarkResult["topResult"] | undefined

    if (top3.length > 0 && gt) {
      const top = top3[0]
      topResult = { file: top.file, name: "", kind: "function", lineStart: top.line }

      const matchedFile = top.file.replace(/\\/g, "/").split("/").pop() || ""

      hit = matchAgainstGroundTruth(
        { file: matchedFile, kind: "function", lineStart: top.line },
        gt
      )
    }

    const result: BenchmarkResult = {
      mode: "baseline",
      queryId: query.id,
      query: query.query,
      hit,
      charsRead,
      latencyMs: Date.now() - startTime,
      topResult,
    }

    results.push(result)
    totalChars += charsRead
    totalLatency += result.latencyMs

    const status = hit ? "✅ HIT" : "❌ MISS"
    console.log(`   ${query.id}: ${status} (${result.latencyMs}ms, ${charsRead} chars)`)
  }

  return { results, charsRead: totalChars, latencyMs: totalLatency }
}

async function runContextSignalsMode(
  config: BenchmarkConfig,
  queries: BenchmarkQuery[],
  groundTruth: GroundTruthEntry[]
): Promise<{ results: BenchmarkResult[], charsRead: number, latencyMs: number }> {
  console.log("\n🎯 Running CONTEXT SIGNALS mode...")

  try {
    const { HybridSearch } = await import("../retrieval/hybrid.js")
    const { createSignal } = await import("../types/signal.js")

    console.log("   Loading signals from store...")

    const signalsPath = path.join(config.projectPath, "signals.json")
    if (!fs.existsSync(signalsPath)) {
      console.log("   ⚠️  signals.json not found. Run signals_scan first.")
      return { results: [], charsRead: 0, latencyMs: 0 }
    }

    const signalsData = JSON.parse(fs.readFileSync(signalsPath, "utf-8"))
    const signals = signalsData.signals || []

    console.log(`   Signals loaded: ${signals.length}`)

    const search = new HybridSearch({
      bm25Weight: 0.4,
      graphWeight: 0.3,
      metadataWeight: 0.2,
      localityWeight: 0.1,
      limit: 10,
    })

    search.index(signals)

    const results: BenchmarkResult[] = []
    let totalChars = 0
    let totalLatency = 0

    for (const query of queries) {
      const startTime = Date.now()

      const searchResults = search.search(query.query, { limit: 3 })

      const charsRead = searchResults.reduce((sum: number, r: any) => sum + (r.text?.length || 0), 0)

      const gt = groundTruth.find(g => g.queryId === query.id)
      let hit = false
      let topResult: BenchmarkResult["topResult"] | undefined

      if (searchResults.length > 0 && gt) {
        const top = searchResults[0]
        const resolved = { file: top.file || "", name: top.name || "", kind: top.kind, lineStart: top.lineStart }
        topResult = resolved

        hit = matchAgainstGroundTruth(resolved, gt)
      }

      const result: BenchmarkResult = {
        mode: "context-signals",
        queryId: query.id,
        query: query.query,
        hit,
        charsRead,
        latencyMs: Date.now() - startTime,
        topResult,
      }

      results.push(result)
      totalChars += charsRead
      totalLatency += result.latencyMs

      const status = hit ? "✅ HIT" : "❌ MISS"
      console.log(`   ${query.id}: ${status} (${result.latencyMs}ms, ${charsRead} chars)`)
    }

    return { results, charsRead: totalChars, latencyMs: totalLatency }
  } catch (error) {
    console.error("   Error running context signals mode:", error)
    return { results: [], charsRead: 0, latencyMs: 0 }
  }
}

function generateReport(report: ComparisonReport): string {
  const lines: string[] = [
    "# Benchmark Comparison Report",
    "",
    `**Run ID:** ${report.runId}`,
    `**Project:** ${report.project}`,
    `**Date:** ${new Date(report.timestamp).toISOString()}`,
    "",
    "## Top-3 Hit Rate",
    "",
    "| Mode | Hit Rate |",
    "|------|----------|",
    `| Baseline (grep) | ${(report.baseline.top3HitRate * 100).toFixed(1)}% |`,
    `| Context Signals | ${(report.contextSignals.top3HitRate * 100).toFixed(1)}% |`,
    "",
    "## Average Chars Read",
    "",
    "| Mode | Avg Chars |",
    "|------|----------|",
    `| Baseline | ${report.baseline.avgCharsRead.toFixed(0)} |`,
    `| Context Signals | ${report.contextSignals.avgCharsRead.toFixed(0)} |`,
    "",
    "## Win Counts",
    "",
    "| Mode | Wins |",
    "|------|------|",
    `| Baseline | ${report.comparison.baselineWins} |`,
    `| Context Signals | ${report.comparison.contextSignalsWins} |`,
    "",
    "## Improvement",
    "",
    `| Metric | Value |`,
    `|-------|-------|`,
    `| Hit Rate Improvement | ${(report.comparison.hitRateImprovement * 100).toFixed(1)}% |`,
    `| Chars Saved | ${report.comparison.charsSavedPercent.toFixed(1)}% |`,
    "",
    "## Per-Query Results",
    "",
    "| Query | Baseline | Context Signals | Winner |",
    "|-------|----------|-----------------|--------|",
  ]

  for (let i = 0; i < report.baseline.results.length; i++) {
    const b = report.baseline.results[i]
    const cs = report.contextSignals.results[i]
    const csHit = cs?.hit || false
    const winner = b.hit && !csHit ? "BASELINE" : !b.hit && csHit ? "CS" : "TIE"
    lines.push(`| ${b.queryId} | ${b.hit ? "HIT" : "MISS"} | ${csHit ? "HIT" : "MISS"} | ${winner} |`)
  }

  return lines.join("\n")
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Benchmark Runner for Context Signals MCP

Usage:
  node dist/benchmark/run-benchmarks.js --project <name> --path <path> --mode <mode>

Options:
  --project <name>     Project name (flask, fastapi, drf, litellm, or custom)
  --path <path>         Path to project directory
  --mode <mode>         Mode: baseline, context-signals, or comparison
  --output <path>       Output path for results (default: ./benchmarks/results)

Example:
  node dist/benchmark/run-benchmarks.js \\
    --project flask \\
    --path ./benchmarks/projects/flask \\
    --mode comparison \\
    --output ./benchmarks/results/flask-001
`)
    process.exit(0)
  }

  const projectArg = args.find((a, i) => args[i] === "--project")
  const pathArg = args.find((a, i) => args[i] === "--path")
  const modeArg = args.find((a, i) => args[i] === "--mode")
  const outputArg = args.find((a, i) => args[i] === "--output")

  const projectName = projectArg ? args[args.indexOf(projectArg) + 1] : "flask"
  const projectPath = pathArg ? args[args.indexOf(pathArg) + 1] : "./benchmarks/projects/flask"
  const mode = modeArg ? args[args.indexOf(modeArg) + 1] : "comparison"
  const outputPath = outputArg ? args[args.indexOf(outputArg) + 1] : "./benchmarks/results"

  const queriesPath = path.join(projectPath, "benchmark-queries.json")
  const groundTruthPath = path.join(projectPath, "ground-truth.json")

  console.log("=".repeat(60))
  console.log("Context Signals MCP - Benchmark Runner")
  console.log("=".repeat(60))
  console.log(`Project: ${projectName}`)
  console.log(`Path: ${projectPath}`)
  console.log(`Mode: ${mode}`)

  if (!fs.existsSync(projectPath)) {
    console.error(`\n❌ Project path not found: ${projectPath}`)
    process.exit(1)
  }

  const queries = await loadQueries(queriesPath)
  const groundTruth = await loadGroundTruth(groundTruthPath)

  if (queries.length === 0) {
    console.error("\n❌ No queries loaded. Check benchmark-queries.json")
    process.exit(1)
  }

  console.log(`\n📋 Loaded ${queries.length} queries`)

  const config: BenchmarkConfig = {
    projectName,
    projectPath,
    queriesPath,
    groundTruthPath,
    outputPath,
  }

  let baselineResults: { results: BenchmarkResult[], charsRead: number, latencyMs: number } = {
    results: [],
    charsRead: 0,
    latencyMs: 0
  }
  let contextSignalsResults: { results: BenchmarkResult[], charsRead: number, latencyMs: number } = {
    results: [],
    charsRead: 0,
    latencyMs: 0
  }

  if (mode === "baseline" || mode === "comparison") {
    baselineResults = await runBaselineMode(config, queries, groundTruth)
  }

  if (mode === "context-signals" || mode === "comparison") {
    contextSignalsResults = await runContextSignalsMode(config, queries, groundTruth)
  }

  const baselineHitRate = baselineResults.results.filter(r => r.hit).length / baselineResults.results.length
  const csHitRate = contextSignalsResults.results.length > 0
    ? contextSignalsResults.results.filter(r => r.hit).length / contextSignalsResults.results.length
    : 0

  const baselineAvgChars = baselineResults.results.length > 0
    ? baselineResults.charsRead / baselineResults.results.length
    : 0
  const csAvgChars = contextSignalsResults.results.length > 0
    ? contextSignalsResults.charsRead / contextSignalsResults.results.length
    : 0

  let baselineWins = 0
  let csWins = 0

  for (let i = 0; i < baselineResults.results.length; i++) {
    const bHit = baselineResults.results[i].hit
    const csHit = contextSignalsResults.results[i]?.hit || false
    if (bHit && !csHit) baselineWins++
    if (!bHit && csHit) csWins++
  }

  const report: ComparisonReport = {
    runId: generateRunId(),
    timestamp: Date.now(),
    project: projectName,
    baseline: {
      top3HitRate: baselineHitRate,
      avgCharsRead: baselineAvgChars,
      totalLatencyMs: baselineResults.latencyMs,
      results: baselineResults.results,
    },
    contextSignals: {
      top3HitRate: csHitRate,
      avgCharsRead: csAvgChars,
      totalLatencyMs: contextSignalsResults.latencyMs,
      results: contextSignalsResults.results,
    },
    comparison: {
      hitRateImprovement: csHitRate - baselineHitRate,
      charsSavedPercent: baselineAvgChars > 0 ? ((baselineAvgChars - csAvgChars) / baselineAvgChars) * 100 : 0,
      contextSignalsWins: csWins,
      baselineWins: baselineWins,
    },
  }

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true })
  }

  const reportContent = generateReport(report)
  const reportPath = path.join(outputPath, "report.md")
  fs.writeFileSync(reportPath, reportContent, "utf-8")

  const jsonPath = path.join(outputPath, "results.json")
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8")

  console.log("\n" + "=".repeat(60))
  console.log("RESULTS SUMMARY")
  console.log("=".repeat(60))
  console.log(`\nTop-3 Hit Rate:`)
  console.log(`  Baseline: ${(baselineHitRate * 100).toFixed(1)}%`)
  console.log(`  Context Signals: ${(csHitRate * 100).toFixed(1)}%`)

  console.log(`\nAverage Chars Read:`)
  console.log(`  Baseline: ${baselineAvgChars.toFixed(0)}`)
  console.log(`  Context Signals: ${csAvgChars.toFixed(0)}`)

  console.log(`\nWin Counts:`)
  console.log(`  Baseline wins: ${baselineWins}`)
  console.log(`  Context Signals wins: ${csWins}`)

  console.log(`\n📄 Report saved to: ${reportPath}`)
  console.log(`📊 JSON results saved to: ${jsonPath}`)
}

main().catch(console.error)