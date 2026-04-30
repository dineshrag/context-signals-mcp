export interface BenchmarkMetrics {
  storageEfficiency: {
    rawSourceChars: number
    signalChars: number
    reductionPercent: number
    success: boolean
  }
  tokenReduction: {
    baselineTokens: number
    signalTokens: number
    reductionPercent: number
    success: boolean
  }
  toolCallReduction: {
    baselineCalls: number
    signalCalls: number
    reductionPercent: number
    success: boolean
  }
  queryAccuracy: {
    correct: number
    total: number
    accuracyPercent: number
    success: boolean
  }
  retrievalQuality: {
    top3Correct: number
    top5Correct: number
    total: number
    success: boolean
  }
  indexingCost: {
    durationMs: number
    rawCharsScanned: number
    signalsProduced: number
    success: boolean
  }
}

export interface DetailedMetrics {
  byKind: Record<string, { count: number; avgScore: number }>
  byFramework: Record<string, { count: number; avgScore: number }>
  byLanguage: Record<string, { count: number; avgScore: number }>
}

export function calculateMetrics(
  baselineChars: number,
  signalChars: number,
  baselineCalls: number,
  signalCalls: number,
  queryResults: Array<{ correct: boolean; score: number; resultsCount: number }>
): BenchmarkMetrics {
  const total = queryResults.length
  const correct = queryResults.filter(r => r.correct).length

  const top3Correct = queryResults.filter((r, i) => i < 3 && r.correct).length
  const top5Correct = queryResults.filter((r, i) => i < 5 && r.correct).length

  return {
    storageEfficiency: {
      rawSourceChars: baselineChars,
      signalChars: signalChars,
      reductionPercent: baselineChars > 0
        ? Math.round(((baselineChars - signalChars) / baselineChars) * 100)
        : 0,
      success: signalChars < baselineChars,
    },
    tokenReduction: {
      baselineTokens: baselineChars,
      signalTokens: signalChars,
      reductionPercent: baselineChars > 0
        ? Math.round(((baselineChars - signalChars) / baselineChars) * 100)
        : 0,
      success: signalChars < baselineChars,
    },
    toolCallReduction: {
      baselineCalls,
      signalCalls,
      reductionPercent: baselineCalls > 0
        ? Math.round(((baselineCalls - signalCalls) / baselineCalls) * 100)
        : 0,
      success: signalCalls < baselineCalls,
    },
    queryAccuracy: {
      correct,
      total,
      accuracyPercent: Math.round((correct / total) * 100),
      success: correct / total >= 0.7,
    },
    retrievalQuality: {
      top3Correct,
      top5Correct,
      total,
      success: top3Correct / total >= 0.6 || top5Correct / total >= 0.8,
    },
    indexingCost: {
      durationMs: 0,
      rawCharsScanned: baselineChars,
      signalsProduced: signalChars,
      success: true,
    },
  }
}

export function aggregateDetailedMetrics(
  queryResults: Array<{ correct: boolean; score: number; resultsCount: number }>,
  signals: Array<{ kind?: string; framework?: string; language?: string }>
): DetailedMetrics {
  const byKind: DetailedMetrics["byKind"] = {}
  const byFramework: DetailedMetrics["byFramework"] = {}
  const byLanguage: DetailedMetrics["byLanguage"] = {}

  for (const signal of signals) {
    if (signal.kind) {
      if (!byKind[signal.kind]) {
        byKind[signal.kind] = { count: 0, avgScore: 0 }
      }
      byKind[signal.kind].count++
    }
    if (signal.framework) {
      if (!byFramework[signal.framework]) {
        byFramework[signal.framework] = { count: 0, avgScore: 0 }
      }
      byFramework[signal.framework].count++
    }
    if (signal.language) {
      if (!byLanguage[signal.language]) {
        byLanguage[signal.language] = { count: 0, avgScore: 0 }
      }
      byLanguage[signal.language].count++
    }
  }

  return { byKind, byFramework, byLanguage }
}