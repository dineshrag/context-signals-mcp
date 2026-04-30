import { runAgentBaseline, loadBaseline, type BaselineResult } from "./agent-baseline-runner.js"
import { runMCPBenchmark, loadMCPResult, type MCPResult } from "./mcp-benchmark-runner.js"
import { runIndexing, loadIndexingResult, type IndexingResult } from "./indexing-runner.js"
import { readFile, writeFile } from "fs/promises"
import path from "path"

export type BenchmarkMode = "agent" | "mcp"

export interface BenchmarkConfig {
  fixtureName: string
  fixturePath: string
  outputDir?: string
}

export interface MetricResult {
  label: string
  baseline: number
  mcp: number
  reduction: number
  success: boolean
}

export interface ComparisonResult {
  fixture: string
  timestamp: number
  mode: BenchmarkMode
  baseline: BaselineResult
  mcp: MCPResult
  indexing: IndexingResult
  metrics: {
    storageReduction: MetricResult
    queryContext: MetricResult
    toolCalls: MetricResult
    accuracy: MetricResult
    top3HitRate: MetricResult
    breakEven: MetricResult
  }
  passed: boolean
}

export async function runComparison(config: BenchmarkConfig): Promise<ComparisonResult> {
  const { fixtureName, fixturePath, outputDir } = config

  console.log(`\n=== Benchmark Comparison: ${fixtureName} ===`)
  console.log(`Baseline: Agent simulation (no MCP)`)
  console.log(`MCP: signals_search via MCP\n`)

  console.log(`Phase 1: Running agent baseline (no MCP)...`)
  const baseline = await runAgentBaseline({
    fixtureName,
    fixturePath,
    outputPath: outputDir ? `${outputDir}/baseline-agent-${fixtureName}.json` : undefined,
  })
  console.log(`  Baseline: ${baseline.totals.totalCharsRead} chars, ${baseline.totals.avgTokensPerQuery} tokens/query, ${baseline.totals.avgCorrectness} correctness\n`)

  console.log(`Phase 2: Running MCP benchmark (with MCP)...`)
  const mcp = await runMCPBenchmark({
    fixtureName,
    fixturePath,
    outputPath: outputDir ? `${outputDir}/mcp-${fixtureName}.json` : undefined,
  })
  console.log(`  MCP: ${mcp.totals.totalCharsRead} chars, ${mcp.totals.avgTokensPerQuery} tokens/query, ${mcp.totals.avgCorrectness} correctness\n`)

  console.log(`Phase 3: Calculating metrics...`)

  const baselineChars = baseline.totals.totalCharsRead
  const mcpChars = mcp.totals.totalCharsRead
  const charsReduction = baselineChars > 0 ? Math.round(((baselineChars - mcpChars) / baselineChars) * 100) : 0

  const baselineTokens = baseline.totals.avgTokensPerQuery
  const mcpTokens = mcp.totals.avgTokensPerQuery
  const tokensReduction = baselineTokens > 0 ? Math.round(((baselineTokens - mcpTokens) / baselineTokens) * 100) : 0

  const baselineToolCalls = baseline.totals.totalToolCalls
  const mcpToolCalls = mcp.totals.totalToolCalls
  const toolCallsReduction = baselineToolCalls > 0 ? Math.round(((baselineToolCalls - mcpToolCalls) / baselineToolCalls) * 100) : 0

  const baselineCorrectness = baseline.totals.avgCorrectness
  const mcpCorrectness = mcp.totals.avgCorrectness
  const accuracyMaintained = mcpCorrectness >= baselineCorrectness - 0.3

  const top3HitRate = mcp.totals.top3HitRate
  const avgSavings = baselineTokens - mcpTokens
  const indexingCost = baselineChars
  const breakEvenQueries = avgSavings > 0 ? Math.ceil(indexingCost / avgSavings) : 999

  const metrics = {
    storageReduction: {
      label: "Storage Reduction",
      baseline: baseline.rawSourceChars,
      mcp: mcp.signalChars,
      reduction: Math.round(((baseline.rawSourceChars - mcp.signalChars) / baseline.rawSourceChars) * 100),
      success: mcp.signalChars < baseline.rawSourceChars
    },
    queryContext: {
      label: "Query Context",
      baseline: baselineTokens,
      mcp: mcpTokens,
      reduction: tokensReduction,
      success: tokensReduction >= 20
    },
    toolCalls: {
      label: "Tool Calls",
      baseline: baselineToolCalls,
      mcp: mcpToolCalls,
      reduction: toolCallsReduction,
      success: toolCallsReduction > 0
    },
    accuracy: {
      label: "Accuracy",
      baseline: baselineCorrectness,
      mcp: mcpCorrectness,
      reduction: 0,
      success: accuracyMaintained
    },
    top3HitRate: {
      label: "Top-3 Hit Rate",
      baseline: 0,
      mcp: top3HitRate,
      reduction: top3HitRate,
      success: top3HitRate >= 70
    },
    breakEven: {
      label: "Break-Even",
      baseline: 0,
      mcp: breakEvenQueries,
      reduction: 0,
      success: breakEvenQueries < 50
    }
  }

  const passed = metrics.storageReduction.success &&
                 metrics.queryContext.success &&
                 metrics.toolCalls.success &&
                 metrics.accuracy.success &&
                 metrics.top3HitRate.success &&
                 metrics.breakEven.success

  console.log(`\n  Query Context: ${baselineTokens} -> ${mcpTokens} (${tokensReduction}% reduction) ${metrics.queryContext.success ? "✓" : "✗"}`)
  console.log(`  Tool Calls: ${baselineToolCalls} -> ${mcpToolCalls} (${toolCallsReduction}% reduction) ${metrics.toolCalls.success ? "✓" : "✗"}`)
  console.log(`  Accuracy: ${baselineCorrectness} -> ${mcpCorrectness} ${metrics.accuracy.success ? "✓" : "✗"}`)
  console.log(`  Top-3 Hit Rate: ${top3HitRate}% ${metrics.top3HitRate.success ? "✓" : "✗"}`)
  console.log(`  Break-Even: ${breakEvenQueries} queries ${metrics.breakEven.success ? "✓" : "✗"}\n`)
  console.log(`  RESULT: ${passed ? "PASSED" : "FAILED"}\n`)

  const result: ComparisonResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    mode: "mcp",
    baseline,
    mcp,
    indexing: { fixture: fixtureName, timestamp: Date.now(), filesScanned: baseline.fileCount, filesSkipped: 0, rawSourceChars: baseline.rawSourceChars, signalChars: mcp.signalChars, signalCount: mcp.signalCount, storageReductionPercent: metrics.storageReduction.reduction, scanDurationMs: 0, signalsByKind: {}, signalsByLanguage: {}, lspAvailable: false, byKind: {}, byLanguage: {}, byFramework: {} },
    metrics,
    passed,
  }

  if (outputDir) {
    await writeFile(`${outputDir}/comparison-${fixtureName}.json`, JSON.stringify(result, null, 2), "utf-8")
  }

  return result
}

export async function runAllComparisons(fixtures: string[], outputDir?: string): Promise<void> {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`BENCHMARK COMPARISON: Agent vs MCP`)
  console.log(`${"=".repeat(60)}`)

  for (const fixture of fixtures) {
    const fixturePath = path.join("benchmarks", "fixtures", fixture)
    await runComparison({ fixtureName: fixture, fixturePath, outputDir })
  }
}

export { loadBaseline } from "./agent-baseline-runner.js"
export { loadMCPResult } from "./mcp-benchmark-runner.js"
