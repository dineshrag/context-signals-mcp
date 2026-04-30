import type { BenchmarkResult } from "../types/benchmark.js"
import type { RunnerResult } from "./runner.js"
import type { BenchmarkMetrics } from "./metrics.js"

export interface BenchmarkReportData {
  timestamp: number
  version: string
  summary: {
    totalQueries: number
    correct: number
    accuracyPercent: number
    storageReductionPercent: number
    breakEvenQueries: number
  }
  metrics: BenchmarkMetrics
  results: BenchmarkResult
  recommendations: string[]
}

export function generateReport(
  runnerResult: RunnerResult,
  metrics: BenchmarkMetrics
): BenchmarkReportData {
  const recommendations: string[] = []

  if (metrics.storageEfficiency.success) {
    recommendations.push("Storage efficiency is good - signals are smaller than raw source")
  } else {
    recommendations.push("Warning: signals are larger than raw source - review extraction")
  }

  if (metrics.queryAccuracy.success) {
    recommendations.push("Query accuracy meets threshold (>=70%)")
  } else {
    recommendations.push("Query accuracy below threshold - improve extraction or retrieval")
  }

  if (metrics.retrievalQuality.success) {
    recommendations.push("Retrieval quality is good - correct results appear in top-k")
  } else {
    recommendations.push("Retrieval quality needs improvement - consider boosting relevant fields")
  }

  if (runnerResult.breakEvenQueries > 0 && runnerResult.breakEvenQueries <= 10) {
    recommendations.push(`Break-even at ${runnerResult.breakEvenQueries} queries - favorable for repeated use`)
  } else if (runnerResult.breakEvenQueries > 10) {
    recommendations.push(`Break-even at ${runnerResult.breakEvenQueries} queries - may not offset indexing cost`)
  }

  return {
    timestamp: Date.now(),
    version: "1.0.0",
    summary: {
      totalQueries: runnerResult.queriesRun,
      correct: runnerResult.correct,
      accuracyPercent: runnerResult.accuracyPercent,
      storageReductionPercent: runnerResult.signalChars > 0
        ? Math.round(((runnerResult.baselineChars - runnerResult.signalChars) / runnerResult.baselineChars) * 100)
        : 0,
      breakEvenQueries: runnerResult.breakEvenQueries,
    },
    metrics,
    results: runnerResult,
    recommendations,
  }
}

export function formatReport(report: BenchmarkReportData): string {
  const lines: string[] = [
    "# Benchmark Report",
    "",
    `**Generated:** ${new Date(report.timestamp).toISOString()}`,
    `**Version:** ${report.version}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Queries | ${report.summary.totalQueries} |`,
    `| Correct | ${report.summary.correct} |`,
    `| Accuracy | ${report.summary.accuracyPercent}% |`,
    `| Storage Reduction | ${report.summary.storageReductionPercent}% |`,
    `| Break-even Queries | ${report.summary.breakEvenQueries} |`,
    "",
    "## Metrics",
    "",
    `| Metric | Value | Success |`,
    `|--------|-------|---------|`,
    `| Storage Efficiency | ${report.metrics.storageEfficiency.reductionPercent}% | ${report.metrics.storageEfficiency.success ? "Yes" : "No"} |`,
    `| Query Accuracy | ${report.metrics.queryAccuracy.accuracyPercent}% | ${report.metrics.queryAccuracy.success ? "Yes" : "No"} |`,
    `| Retrieval Quality (Top-3) | ${report.metrics.retrievalQuality.top3Correct}/${report.metrics.retrievalQuality.total} | ${report.metrics.retrievalQuality.success ? "Yes" : "No"} |`,
    "",
    "## Recommendations",
    "",
    ...report.recommendations.map(r => `- ${r}`),
  ]

  return lines.join("\n")
}

export function saveReport(report: BenchmarkReportData, filePath: string): void {
  const fs = require("fs")
  const formatted = formatReport(report)
  fs.writeFileSync(filePath, formatted, "utf-8")
}

export function saveJsonReport(report: BenchmarkReportData, filePath: string): void {
  const fs = require("fs")
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8")
}