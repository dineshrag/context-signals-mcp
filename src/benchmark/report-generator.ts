import type { BaselineResult } from "./baseline-runner.js"
import type { SignalsResult } from "./signals-runner.js"
import type { IndexingResult } from "./indexing-runner.js"
import type { FullMetrics } from "./metrics-calculator.js"

export interface BenchmarkReport {
  fixture: string
  timestamp: number
  passed: boolean
  metrics: FullMetrics
  summary: {
    storageReduction: string
    queryContextReduction: string
    accuracyChange: string
    retrievalQuality: string
    breakEvenQueries: number
  }
}

export function generateBenchmarkReport(
  fixtureName: string,
  baseline: BaselineResult,
  indexing: IndexingResult,
  signals: SignalsResult,
  metrics: FullMetrics
): string {
  const passedChecks = [
    metrics.storage.success,
    metrics.queryContext.success,
    metrics.fullFileReads.success,
    metrics.toolCalls.success,
    metrics.accuracy.success,
    metrics.retrieval.success,
    metrics.breakEven.success,
  ].filter(Boolean).length

  const totalChecks = 7
  const overallPassed = passedChecks === totalChecks

  const report = `# Benchmark Report: ${fixtureName}

## Summary

**Status:** ${overallPassed ? "PASSED" : "FAILED"}
**Checks Passed:** ${passedChecks}/${totalChecks}
**Generated:** ${new Date().toISOString()}

## Metrics

### A. Storage Efficiency
| Metric | Value |
|--------|-------|
| Raw Source Chars | ${metrics.storage.rawSourceChars.toLocaleString()} |
| Signal Chars | ${metrics.storage.signalChars.toLocaleString()} |
| Reduction | ${metrics.storage.reductionPercent}% |
| Success | ${metrics.storage.success ? "YES" : "NO"} |

### B. Query Context Reduction
| Metric | Value |
|--------|-------|
| Baseline Avg | ${metrics.queryContext.baselineAvg.toLocaleString()} chars |
| Signals Avg | ${metrics.queryContext.signalsAvg.toLocaleString()} chars |
| Reduction | ${metrics.queryContext.reductionPercent}% |
| Success | ${metrics.queryContext.success ? "YES" : "NO"} |

### C. Full File Reads
| Metric | Value |
|--------|-------|
| Baseline | ${metrics.fullFileReads.baselineTotal} |
| Signals | ${metrics.fullFileReads.signalsTotal} |
| Reduction | ${metrics.fullFileReads.reductionPercent}% |
| Success | ${metrics.fullFileReads.success ? "YES" : "NO"} |

### D. Tool Calls
| Metric | Value |
|--------|-------|
| Baseline | ${metrics.toolCalls.baselineTotal} |
| Signals | ${metrics.toolCalls.signalsTotal} |
| Reduction | ${metrics.toolCalls.reductionPercent}% |
| Success | ${metrics.toolCalls.success ? "YES" : "NO"} |

### E. Accuracy
| Metric | Value |
|--------|-------|
| Baseline Avg | ${metrics.accuracy.baselineAvg.toFixed(2)}/3 |
| Signals Avg | ${metrics.accuracy.signalsAvg.toFixed(2)}/3 |
| Success | ${metrics.accuracy.success ? "YES" : "NO"} |

### F. Retrieval Quality (Top-3 Hit Rate)
| Metric | Value |
|--------|-------|
| Hit Rate | ${metrics.retrieval.top3HitRate}% |
| Success | ${metrics.retrieval.top3HitRate >= 70 ? "YES" : "NO"} |

### G. Break-Even Analysis
| Metric | Value |
|--------|-------|
| Indexing Cost | ${metrics.breakEven.indexingChars.toLocaleString()} chars |
| Avg Savings/Query | ${metrics.breakEven.avgSavingsPerQuery.toFixed(0)} chars |
| Break-Even Queries | ${metrics.breakEven.breakEvenQueries} |
| Success | ${metrics.breakEven.success ? "YES" : "NO"} |

## Decision Check

All checks must pass:

- [${metrics.storage.success ? "x" : " "}] Storage: signalChars < rawSourceChars
- [${metrics.queryContext.success ? "x" : " "}] Query context reduced by >= 20%
- [${metrics.fullFileReads.success ? "x" : " "}] Full file reads reduced
- [${metrics.toolCalls.success ? "x" : " "}] Tool calls reduced
- [${metrics.accuracy.success ? "x" : " "}] Accuracy not significantly worse
- [${metrics.retrieval.success ? "x" : " "}] Top-3 hit rate >= 70%
- [${metrics.breakEven.success ? "x" : " "}] Break-even < 50 queries

## Raw Data

### Indexing
\`\`\`json
${JSON.stringify(indexing, null, 2)}
\`\`\`

### Baseline Totals
\`\`\`json
${JSON.stringify(baseline.totals, null, 2)}
\`\`\`

### Signals Totals
\`\`\`json
${JSON.stringify(signals.totals, null, 2)}
\`\`\`

---
*Generated: ${new Date().toISOString()}*
`

  return report
}

export function formatBenchmarkReport(report: BenchmarkReport): string {
  return generateBenchmarkReport(
    report.fixture,
    { timestamp: report.timestamp, totals: { avgCorrectness: 0 } } as BaselineResult,
    { rawSourceChars: report.metrics.storage.rawSourceChars, signalChars: report.metrics.storage.signalChars, filesScanned: 0, storageReductionPercent: report.metrics.storage.reductionPercent } as IndexingResult,
    { totals: { avgTokensPerQuery: report.metrics.queryContext.signalsAvg, top3HitRate: report.metrics.retrieval.top3HitRate, avgCorrectness: 0 } } as SignalsResult,
    report.metrics
  )
}

export function generateJsonReport(
  fixtureName: string,
  baseline: BaselineResult,
  indexing: IndexingResult,
  signals: SignalsResult,
  metrics: FullMetrics
): BenchmarkReport {
  return {
    fixture: fixtureName,
    timestamp: Date.now(),
    passed: Object.values(metrics).every(m => m.success),
    metrics,
    summary: {
      storageReduction: `${metrics.storage.reductionPercent}%`,
      queryContextReduction: `${metrics.queryContext.reductionPercent}%`,
      accuracyChange: `${metrics.accuracy.baselineAvg.toFixed(2)} -> ${metrics.accuracy.signalsAvg.toFixed(2)}`,
      retrievalQuality: `${metrics.retrieval.top3HitRate}%`,
      breakEvenQueries: metrics.breakEven.breakEvenQueries,
    },
  }
}