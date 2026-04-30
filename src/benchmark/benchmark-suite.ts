import { runBaseline, loadBaseline, saveBaseline, type BaselineResult } from "./baseline-runner.js"
import { runRealBaseline, loadRealBaseline, type RealBaselineResult } from "./real-baseline-runner.js"
import { runSignalsMeasurement, loadSignalsResult, saveSignalsResult, type SignalsResult } from "./signals-runner.js"
import { runRealSignalsMeasurement, loadRealSignalsResult, saveRealSignalsResult, type RealSignalsResult } from "./real-signals-runner.js"
import { runIndexing, loadIndexingResult, saveIndexingResult, type IndexingResult } from "./indexing-runner.js"
import { calculateFullMetrics, calculateRealMetrics, type FullMetrics, type RealMetrics } from "./metrics-calculator.js"
import { generateBenchmarkReport } from "./report-generator.js"

export type BenchmarkMode = "simulated" | "real"

export interface BenchmarkSuiteConfig {
  fixtureName: string
  fixturePath: string
  outputDir?: string
  mode?: BenchmarkMode
}

export interface BenchmarkSuiteResult {
  fixture: string
  timestamp: number
  baseline: BaselineResult
  indexing: IndexingResult
  signals: SignalsResult
  metrics: FullMetrics | RealMetrics
  passed: boolean
  mode: BenchmarkMode
}

function getBaselineModeLabel(mode: BenchmarkMode): string {
  switch (mode) {
    case "simulated": return "Simulated"
    case "real": return "Real"
  }
}

export async function runBenchmarkSuite(config: BenchmarkSuiteConfig): Promise<BenchmarkSuiteResult> {
  const { fixtureName, fixturePath, outputDir, mode = "simulated" } = config

  console.log(`\n=== Running benchmark suite for ${fixtureName} ===`)
  console.log(`Mode: ${getBaselineModeLabel(mode)}\n`)

  console.log(`Phase 1: Running baseline measurement (${mode})...`)
  let baseline: BaselineResult

  if (mode === "real") {
    const realResult = await runRealBaseline({
      fixtureName,
      fixturePath,
      outputPath: outputDir ? `${outputDir}/baseline-real-${fixtureName}.json` : undefined,
    })
    baseline = {
      fixture: realResult.fixture,
      timestamp: realResult.timestamp,
      rawSourceChars: realResult.rawSourceChars,
      fileCount: realResult.fileCount,
      queries: realResult.queries.map(q => ({
        queryId: q.queryId,
        query: q.query,
        category: q.category,
        difficulty: q.difficulty,
        simulatedToolCalls: q.toolCalls,
        simulatedFullReads: q.fullReads,
        simulatedTokens: q.estimatedTokens,
        simulatedCorrectness: q.simulatedCorrectness,
        simulatedTimeMs: q.timeMs,
      })),
      totals: {
        totalToolCalls: realResult.totals.totalToolCalls,
        totalFullReads: realResult.totals.totalFullReads,
        totalTokens: realResult.totals.totalTokens,
        avgTokensPerQuery: realResult.totals.avgTokensPerQuery,
        avgCorrectness: realResult.totals.avgCorrectness,
      },
    }
    console.log(`  Baseline: ${baseline.totals.totalTokens} total tokens, ${baseline.totals.avgCorrectness} avg correctness`)
  } else {
    baseline = await runBaseline({
      fixtureName,
      fixturePath,
      outputPath: outputDir ? `${outputDir}/baseline-${fixtureName}.json` : undefined,
    })
    console.log(`  Baseline: ${baseline.totals.totalTokens} total tokens, ${baseline.totals.avgCorrectness} avg correctness`)
  }

  console.log(`\nPhase 2: Running Context Signals indexing...`)
  const indexing = await runIndexing({
    fixtureName,
    fixturePath,
  })
  console.log(`  Indexing: ${indexing.filesScanned} files, ${indexing.signalCount} signals extracted`)
  console.log(`  Storage: ${indexing.signalChars} signal chars / ${indexing.rawSourceChars} raw chars (${indexing.storageReductionPercent}% reduction)\n`)

  console.log(`Phase 3: Running Context Signals measurement (${mode})...`)
  let signals: SignalsResult

  if (mode === "real") {
    const realSignals = await runRealSignalsMeasurement({
      fixtureName,
      fixturePath,
      signalChars: indexing.signalChars,
      signalCount: indexing.signalCount,
      outputPath: outputDir ? `${outputDir}/signals-real-${fixtureName}.json` : undefined,
    })
    signals = {
      fixture: realSignals.fixture,
      timestamp: realSignals.timestamp,
      signalChars: realSignals.signalChars,
      signalCount: realSignals.signalCount,
      queries: realSignals.queries.map(q => ({
        queryId: q.queryId,
        query: q.query,
        category: q.category,
        difficulty: q.difficulty,
        searchCalls: q.searchCalls,
        signalCharsReturned: q.signalCharsReturned,
        targetedReads: q.targetedReads,
        fullFileReads: q.fullFileReads,
        simulatedTokens: q.simulatedTokens,
        simulatedCorrectness: q.simulatedCorrectness,
        simulatedTimeMs: q.simulatedTimeMs,
        top3Hit: q.top3Hit,
      })),
      totals: {
        totalSearchCalls: realSignals.totals.totalSearchCalls,
        totalSignalChars: realSignals.totals.totalSignalChars,
        totalTargetedReads: realSignals.totals.totalTargetedReads,
        totalFullReads: realSignals.totals.totalFullReads,
        totalTokens: realSignals.totals.totalTokens,
        avgTokensPerQuery: realSignals.totals.avgTokensPerQuery,
        avgCorrectness: realSignals.totals.avgCorrectness,
        top3HitRate: realSignals.totals.top3HitRate,
      },
    }
    console.log(`  Signals: ${signals.totals.totalTokens} total tokens, ${signals.totals.top3HitRate}% top-3 hit rate`)
  } else {
    signals = await runSignalsMeasurement({
      fixtureName,
      fixturePath,
      signalChars: indexing.signalChars,
      signalCount: indexing.signalCount,
      outputPath: outputDir ? `${outputDir}/signals-${fixtureName}.json` : undefined,
    })
    console.log(`  Signals: ${signals.totals.totalTokens} total tokens, ${signals.totals.top3HitRate}% top-3 hit rate (simulated)`)
  }

  console.log(`\nPhase 4: Calculating metrics...`)

  let metrics: FullMetrics | RealMetrics
  let passed: boolean

  if (mode === "real") {
    const realMetrics = calculateRealMetrics(baseline, signals, indexing)
    metrics = realMetrics
    console.log(`\n  Storage reduction:     ${realMetrics.storage.reductionPercent}%`)
    console.log(`  Query context:        ${realMetrics.queryContext.baselineAvg} -> ${realMetrics.queryContext.signalsAvg} (${realMetrics.queryContext.reductionPercent}% reduction)`)
    console.log(`  Tool calls:            ${realMetrics.toolCalls.baselineTotal} -> ${realMetrics.toolCalls.signalsTotal} (${realMetrics.toolCalls.reductionPercent}% reduction)`)
    console.log(`  Accuracy:              ${realMetrics.accuracy.baselineAvg} -> ${realMetrics.accuracy.signalsAvg} (tolerance: >= ${(realMetrics.accuracy.baselineAvg - 0.3).toFixed(2)})`)
    console.log(`  Top-3 hit rate:       ${realMetrics.retrieval.top3HitRate}%`)
    console.log(`  Break-even:           ${realMetrics.breakEven.breakEvenQueries} queries\n`)
    passed = realMetrics.storage.success &&
             realMetrics.queryContext.success &&
             realMetrics.toolCalls.success &&
             realMetrics.accuracy.success &&
             realMetrics.retrieval.success &&
             realMetrics.breakEven.success
  } else {
    const fullMetrics = calculateFullMetrics(baseline, signals, indexing)
    metrics = fullMetrics
    console.log(`\n  Storage reduction:     ${fullMetrics.storage.reductionPercent}%`)
    console.log(`  Query context:        ${fullMetrics.queryContext.baselineAvg} -> ${fullMetrics.queryContext.signalsAvg} (${fullMetrics.queryContext.reductionPercent}% reduction)`)
    console.log(`  Full file reads:       ${fullMetrics.fullFileReads.baselineTotal} -> ${fullMetrics.fullFileReads.signalsTotal} (${fullMetrics.fullFileReads.reductionPercent}%)`)
    console.log(`  Tool calls:            ${fullMetrics.toolCalls.baselineTotal} -> ${fullMetrics.toolCalls.signalsTotal} (${fullMetrics.toolCalls.reductionPercent}% reduction)`)
    console.log(`  Accuracy:              ${fullMetrics.accuracy.baselineAvg} -> ${fullMetrics.accuracy.signalsAvg} (tolerance: >= ${(fullMetrics.accuracy.baselineAvg - 0.3).toFixed(2)})`)
    console.log(`  Top-3 hit rate:       ${fullMetrics.retrieval.top3HitRate}%`)
    console.log(`  Break-even:           ${fullMetrics.breakEven.breakEvenQueries} queries\n`)
    passed = fullMetrics.storage.success &&
             fullMetrics.queryContext.success &&
             fullMetrics.fullFileReads.success &&
             fullMetrics.toolCalls.success &&
             fullMetrics.accuracy.success &&
             fullMetrics.retrieval.success &&
             fullMetrics.breakEven.success
  }

  console.log(`Overall result: ${passed ? "PASSED" : "FAILED"}\n`)

  const result: BenchmarkSuiteResult = {
    fixture: fixtureName,
    timestamp: Date.now(),
    baseline,
    indexing,
    signals,
    metrics,
    passed,
    mode,
  }

  if (outputDir) {
    const { writeFile } = await import("fs/promises")
    await writeFile(`${outputDir}/report-${mode}-${fixtureName}.json`, JSON.stringify({
      fixture: fixtureName,
      timestamp: Date.now(),
      mode,
      passed,
      metrics
    }, null, 2), "utf-8")
  }

  return result
}

export { runBaseline, loadBaseline, saveBaseline } from "./baseline-runner.js"
export { runRealBaseline, loadRealBaseline } from "./real-baseline-runner.js"
export { runSignalsMeasurement, loadSignalsResult, saveSignalsResult } from "./signals-runner.js"
export { runRealSignalsMeasurement, loadRealSignalsResult, saveRealSignalsResult } from "./real-signals-runner.js"
export { runIndexing, loadIndexingResult, saveIndexingResult } from "./indexing-runner.js"

export { runBenchmark, runNavigationBenchmark } from "./runner.js"
export { calculateFullMetrics, calculateRealMetrics, type FullMetrics, type RealMetrics } from "./metrics-calculator.js"
export { generateBenchmarkReport } from "./report-generator.js"